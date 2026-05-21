/**
 * Source + confidence rollup (PRD §5.9). Until the Elemental provenance
 * endpoints are wired, we derive a `ProvenanceStatus` from the evidence
 * we *do* have on the alert.
 */

import type { AlertEvidenceRef, ProvenanceStatus, YottalertAlert } from '~/utils/yottalert/types';

export function rollupProvenanceStatus(evidence: AlertEvidenceRef[]): ProvenanceStatus {
    if (!evidence.length) return 'unavailable';
    const withSource = evidence.filter((e) => e.elementalSourceId || e.sourceUrl);
    if (withSource.length === evidence.length) return 'complete';
    if (withSource.length > 0) return 'partial';
    return 'unavailable';
}

export function rollupConfidence(evidence: AlertEvidenceRef[]): number {
    if (!evidence.length) return 0.6;
    const sum = evidence.reduce(
        (acc, e) => acc + (Number.isFinite(e.confidence) ? e.confidence : 0.6),
        0
    );
    return Number((sum / evidence.length).toFixed(2));
}

export function evidenceSummary(alert: YottalertAlert): string {
    if (!alert.evidence.length) {
        return 'Provenance unavailable — Elemental returned no source evidence for this candidate.';
    }
    const types = new Set(alert.evidence.map((e) => e.evidenceType));
    return `${alert.evidence.length} source${alert.evidence.length === 1 ? '' : 's'} (${[...types].join(', ')}).`;
}

export const provenanceService = { rollupProvenanceStatus, rollupConfidence, evidenceSummary };
export type ProvenanceService = typeof provenanceService;
