/**
 * Sync runner (PRD §7 / §12 step 4 + step 11).
 *
 * `runSyncForRule()` is called by the manual `POST /api/yottalert/alert-rules/:id/check-now`
 * route today; a cron-driven sweep can call `runScheduledSync()` later.
 *
 * Each run:
 *   1. Records a `SyncRun` row.
 *   2. Calls `changeDetectionService.detectChanges()`.
 *   3. Filters candidates below the rule's `minimumConfidence`.
 *   4. Scores survivors via `alertScoringService`.
 *   5. Composes explanations via `alertExplanationService`.
 *   6. Persists the resulting `YottalertAlert` rows.
 *   7. Updates the rule's last-seen cursors.
 */

import type { AlertRule, SyncRun, YottalertAlert } from '~/utils/yottalert/types';
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

export async function runSyncForRule(rule: AlertRule): Promise<RunOutcome> {
    const startedAt = new Date().toISOString();
    const syncRun: SyncRun = {
        id: randomId('sync'),
        organizationId: rule.organizationId,
        alertRuleId: rule.id,
        status: 'running',
        startedAt,
        objectsChecked: 0,
        candidateAlertsCreated: 0,
        errors: [],
    };

    try {
        const candidates = await changeDetectionService.detectChanges(rule);
        syncRun.objectsChecked = candidates.reduce(
            (acc, c) => acc + c.entities.length + c.events.length + c.relationships.length,
            0
        );

        const created: YottalertAlert[] = [];
        for (const candidate of candidates) {
            if (candidate.confidence < rule.minimumConfidence) continue;

            const isNew = !rule.lastSeenEntityIds.some((id) =>
                candidate.elementalEntityIds.includes(id)
            );

            const scoring = alertScoringService.scoreCandidate({
                rule,
                candidate: { ...candidate, isNew },
            });

            const provenanceStatus = provenanceService.rollupProvenanceStatus(candidate.evidence);

            const explanation = alertExplanationService.composeExplanation({
                rule,
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
                alertRuleId: rule.id,
                title: explanation.title,
                summary: explanation.summary,
                whyItMatters: explanation.whyItMatters,
                whatChanged: explanation.whatChanged,
                suggestedNextStep: explanation.suggestedNextStep,
                geographyLabel: candidate.geographyLabel,
                severity: scoring.severity,
                score: scoring.score,
                scoreBreakdown: scoring.breakdown,
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

        const seenEntities = new Set(rule.lastSeenEntityIds);
        const seenEvents = new Set(rule.lastSeenEventIds);
        const seenRelationships = new Set(rule.lastSeenRelationshipIds);
        for (const c of created) {
            c.elementalEntityIds.forEach((id) => seenEntities.add(id));
            c.elementalEventIds.forEach((id) => seenEvents.add(id));
            c.elementalRelationshipIds.forEach((id) => seenRelationships.add(id));
        }

        const updatedRule: AlertRule = {
            ...rule,
            lastCheckedAt: new Date().toISOString(),
            lastAlertedAt: created.length ? new Date().toISOString() : rule.lastAlertedAt,
            lastSeenEntityIds: [...seenEntities].slice(-200),
            lastSeenEventIds: [...seenEvents].slice(-200),
            lastSeenRelationshipIds: [...seenRelationships].slice(-200),
            updatedAt: new Date().toISOString(),
        };
        await yottalertStore.saveAlertRule(updatedRule);

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

export const syncScheduler = { runSyncForRule };
export type SyncScheduler = typeof syncScheduler;
