/**
 * Six-component scoring (PRD §5.7).
 *
 * Each factor is independently computed in 0..1 and then combined as a
 * geometric mean × 100 so a low factor pulls the overall score down,
 * matching the brief's product-of-factors formulation. Severity bands
 * (§5.7) are mapped from the final integer score.
 */

import type { AlertRule, ScoreBreakdown, Severity, YottalertAlert } from '~/utils/yottalert/types';
import { severityForScore } from '~/utils/yottalert/severity';

interface ScoreInputs {
    rule: AlertRule;
    candidate: Pick<
        YottalertAlert,
        | 'confidence'
        | 'sourceCount'
        | 'elementalEntityIds'
        | 'elementalEventIds'
        | 'elementalRelationshipIds'
        | 'geographyLabel'
    > & { isNew?: boolean; recencyMinutes?: number };
}

function clamp01(n: number): number {
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

function relevance(inputs: ScoreInputs): number {
    const { rule, candidate } = inputs;
    const matches =
        Number(Boolean(candidate.geographyLabel && rule.structuredRule.geography?.name)) +
        Number(candidate.elementalEntityIds.length > 0) +
        Number(candidate.elementalEventIds.length > 0) +
        Number(candidate.elementalRelationshipIds.length > 0);
    return clamp01(0.35 + 0.18 * matches);
}

function novelty(inputs: ScoreInputs): number {
    const { candidate, rule } = inputs;
    if (candidate.isNew === false) return 0.4;
    const lastCheck = rule.lastCheckedAt ? new Date(rule.lastCheckedAt).getTime() : null;
    if (!lastCheck) return 0.85;
    const ageHours = (Date.now() - lastCheck) / 3_600_000;
    return clamp01(0.5 + Math.min(0.5, ageHours / 48));
}

function localSignificance(inputs: ScoreInputs): number {
    const hasGeo = Boolean(inputs.candidate.geographyLabel);
    const ruleHasGeo = Boolean(inputs.rule.structuredRule.geography?.name);
    if (hasGeo && ruleHasGeo) return 0.9;
    if (hasGeo) return 0.75;
    if (ruleHasGeo) return 0.55;
    return 0.5;
}

function entityImportance(inputs: ScoreInputs): number {
    const count = inputs.candidate.elementalEntityIds.length;
    if (!count) return 0.4;
    return clamp01(0.5 + 0.08 * count);
}

function confidenceFactor(inputs: ScoreInputs): number {
    const raw = inputs.candidate.confidence;
    if (!Number.isFinite(raw)) return 0.6;
    return clamp01(raw);
}

function urgency(inputs: ScoreInputs): number {
    const mins = inputs.candidate.recencyMinutes ?? 60;
    if (mins <= 30) return 0.95;
    if (mins <= 180) return 0.85;
    if (mins <= 720) return 0.7;
    if (mins <= 1440) return 0.55;
    return 0.4;
}

export interface ScoreResult {
    score: number;
    severity: Severity;
    breakdown: ScoreBreakdown;
}

export function scoreCandidate(inputs: ScoreInputs): ScoreResult {
    const breakdown01: ScoreBreakdown = {
        relevance: relevance(inputs),
        novelty: novelty(inputs),
        localSignificance: localSignificance(inputs),
        entityImportance: entityImportance(inputs),
        confidence: confidenceFactor(inputs),
        urgency: urgency(inputs),
    };
    const product = Object.values(breakdown01).reduce((acc, v) => acc * Math.max(v, 0.01), 1);
    const geom = Math.pow(product, 1 / 6);
    const score = Math.round(geom * 100);
    return {
        score,
        severity: severityForScore(score),
        breakdown: Object.fromEntries(
            Object.entries(breakdown01).map(([k, v]) => [k, Math.round(v * 100)])
        ) as ScoreBreakdown,
    };
}

export const alertScoringService = { scoreCandidate };
export type AlertScoringService = typeof alertScoringService;
