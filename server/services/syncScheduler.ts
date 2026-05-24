/**
 * Sync runner (PRD §7 / §12 step 4 + step 11).
 *
 * `runSyncForWatchArea()` is called by the manual `POST /api/yottalert/watch-area/check-now`
 * route today; a cron-driven sweep can call `runScheduledSync()` later.
 *
 * Each run:
 *   1. Records a `SyncRun` row.
 *   2. Calls `changeDetectionService.detectChanges()`.
 *   3. Filters candidates below the watch area's `minimumConfidence`.
 *   4. Scores survivors via `alertScoringService`.
 *   5. Composes explanations via `alertExplanationService`.
 *   6. Persists the resulting `YottalertAlert` rows.
 *   7. Updates the watch area's last-seen cursors.
 */

import type { SyncRun, WatchArea, YottalertAlert } from '~/utils/yottalert/types';
import { changeDetectionService } from './changeDetectionService';
import { alertExplanationService } from './alertExplanationService';
import { alertScoringService } from './alertScoringService';
import { provenanceService } from './provenanceService';
import { yottalertStore } from './yottalertStore';

function randomId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface RunOutcome {
    syncRun: SyncRun;
    created: YottalertAlert[];
}

export async function runSyncForWatchArea(watchArea: WatchArea): Promise<RunOutcome> {
    const startedAt = new Date().toISOString();
    const syncRun: SyncRun = {
        id: randomId('sync'),
        organizationId: 'default-org',
        watchAreaId: watchArea.id,
        status: 'running',
        startedAt,
        objectsChecked: 0,
        candidateAlertsCreated: 0,
        errors: [],
    };

    try {
        const signal = await yottalertStore.getWatchFeedbackSignal(watchArea.id);
        const suppression = await yottalertStore.getWatchSuppressionList(watchArea.id);
        const candidates = await changeDetectionService.detectChanges(watchArea, suppression);
        syncRun.objectsChecked = candidates.reduce(
            (acc, c) => acc + c.entities.length + c.events.length + c.relationships.length,
            0
        );

        const created: YottalertAlert[] = [];
        for (const candidate of candidates) {
            if (candidate.confidence < watchArea.minimumConfidence) continue;

            const isNew = !watchArea.lastSeenEntityIds.some((id) =>
                candidate.elementalEntityIds.includes(id)
            );

            const baseScoring = alertScoringService.scoreCandidate({
                watchArea,
                candidate: { ...candidate, isNew },
                suppression,
            });
            const scoring = alertScoringService.applyFeedbackAdjustment(baseScoring, signal);

            const provenanceStatus = provenanceService.rollupProvenanceStatus(candidate.evidence);

            const explanation = alertExplanationService.composeExplanation({
                watchArea,
                severity: scoring.severity,
                score: scoring.score,
                confidence: candidate.confidence,
                geographyLabel: candidate.geographyLabel,
                entities: candidate.entities,
                events: candidate.events,
                relationships: candidate.relationships,
                elementalEntityCount: candidate.elementalEntityIds.length,
                sourceCount: candidate.evidence.length,
            });

            const alert: YottalertAlert = {
                id: randomId('alert'),
                watchAreaId: watchArea.id,
                title: explanation.title,
                summary: explanation.summary,
                whyItMatters: explanation.whyItMatters,
                whatChanged: explanation.whatChanged,
                suggestedNextStep: explanation.suggestedNextStep,
                geographyLabel: candidate.geographyLabel,
                severity: scoring.severity,
                score: scoring.score,
                scoreBreakdown: scoring.breakdown,
                feedbackAdjustment: scoring.feedbackAdjustment,
                confidence: provenanceService.rollupConfidence(candidate.evidence),
                createdAt: new Date().toISOString(),
                sourceCount: candidate.evidence.length,
                provenanceStatus,
                status: 'new',
                elementalEntityIds: candidate.elementalEntityIds,
                elementalEventIds: candidate.elementalEventIds,
                elementalRelationshipIds: candidate.elementalRelationshipIds,
                elementalObjectIds: candidate.elementalObjectIds,
                entities: candidate.entities,
                events: candidate.events,
                relationships: candidate.relationships,
                evidence: candidate.evidence,
            };

            await yottalertStore.saveAlert(alert);
            created.push(alert);
        }

        const seenEntities = new Set(watchArea.lastSeenEntityIds);
        const seenEvents = new Set(watchArea.lastSeenEventIds);
        const seenRelationships = new Set(watchArea.lastSeenRelationshipIds);
        for (const c of created) {
            c.elementalEntityIds.forEach((id) => seenEntities.add(id));
            c.elementalEventIds.forEach((id) => seenEvents.add(id));
            c.elementalRelationshipIds.forEach((id) => seenRelationships.add(id));
        }

        const updatedWatchArea: WatchArea = {
            ...watchArea,
            lastCheckedAt: new Date().toISOString(),
            lastAlertedAt: created.length ? new Date().toISOString() : watchArea.lastAlertedAt,
            lastSeenEntityIds: [...seenEntities].slice(-200),
            lastSeenEventIds: [...seenEvents].slice(-200),
            lastSeenRelationshipIds: [...seenRelationships].slice(-200),
            updatedAt: new Date().toISOString(),
        };
        await yottalertStore.saveWatchArea(updatedWatchArea);

        syncRun.status = 'completed';
        syncRun.completedAt = new Date().toISOString();
        syncRun.candidateAlertsCreated = created.length;
        await yottalertStore.saveSyncRun(syncRun);

        return { syncRun, created };
    } catch (err) {
        syncRun.status = 'failed';
        syncRun.completedAt = new Date().toISOString();
        syncRun.errors.push(err instanceof Error ? err.message : String(err));
        await yottalertStore.saveSyncRun(syncRun);
        return { syncRun, created: [] };
    }
}

export const syncScheduler = { runSyncForWatchArea };
export type SyncScheduler = typeof syncScheduler;
