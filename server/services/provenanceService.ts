/**
 * Source + confidence rollup (PRD §5.9). Until the Elemental provenance
 * endpoints are wired, we derive a `ProvenanceStatus` from the evidence
 * we *do* have on the alert.
 */

import type {
    AlertEvidenceRef,
    ProvenanceRecord,
    ProvenanceStatus,
    YottalertAlert,
} from '~/utils/yottalert/types';
import { elementalApiClient } from './elementalApiClient';
import { elementalMcpClient } from './elementalMcpClient';
import { yottalertStore } from './yottalertStore';

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

function inferObjectType(objectId: string): ProvenanceRecord['objectType'] {
    if (objectId.startsWith('NE')) return 'entity';
    if (objectId.includes('rel')) return 'relationship';
    if (objectId.includes('evt')) return 'event';
    if (objectId.includes('src') || objectId.includes('source')) return 'source';
    return 'unknown';
}

function fromEvidence(
    objectId: string,
    status: ProvenanceStatus,
    alerts: YottalertAlert[]
): ProvenanceRecord {
    const relatedAlerts = alerts.map((a) => ({
        alertId: a.id,
        alertTitle: a.title,
        createdAt: a.createdAt,
    }));
    const primaryAlert = alerts[0];
    const matchedEvidence =
        primaryAlert?.evidence.find(
            (e) =>
                e.elementalSourceId === objectId ||
                e.elementalObjectId === objectId ||
                e.id === objectId
        ) ?? primaryAlert?.evidence[0];

    const sourceName = matchedEvidence?.sourceName;
    const sourceUrl = matchedEvidence?.sourceUrl;
    const sourceType = matchedEvidence?.evidenceType ?? 'elemental';

    return {
        objectId,
        objectType: inferObjectType(objectId),
        sourceDocument: sourceName
            ? { name: sourceName, url: sourceUrl, type: sourceType }
            : undefined,
        ingestedAt: matchedEvidence?.ingestedAt,
        publishedAt: matchedEvidence?.publishedAt,
        extractedClaim: matchedEvidence?.displayText,
        entityResolutionConfidence: matchedEvidence?.confidence,
        relationshipConfidence: matchedEvidence?.confidence,
        eventExtractionConfidence: matchedEvidence?.confidence,
        geographyResolutionConfidence: matchedEvidence?.confidence,
        elementalObjectIds: [
            ...new Set(alerts.flatMap((a) => a.elementalObjectIds).filter((id) => !!id)),
        ],
        relatedAlerts,
        status,
    };
}

function objectMatchesAlert(alert: YottalertAlert, objectId: string): boolean {
    if (
        alert.elementalObjectIds.includes(objectId) ||
        alert.elementalEntityIds.includes(objectId) ||
        alert.elementalEventIds.includes(objectId) ||
        alert.elementalRelationshipIds.includes(objectId)
    ) {
        return true;
    }
    return alert.evidence.some(
        (e) =>
            e.elementalSourceId === objectId ||
            e.elementalObjectId === objectId ||
            e.id === objectId
    );
}

export async function getProvenanceForObject(objectId: string): Promise<ProvenanceRecord> {
    if (!objectId) {
        return {
            objectId: '',
            objectType: 'unknown',
            elementalObjectIds: [],
            relatedAlerts: [],
            status: 'unavailable',
        };
    }

    try {
        const mcp = await elementalMcpClient.getProvenanceForObject(objectId);
        if (mcp) {
            return {
                objectId,
                objectType: inferObjectType(objectId),
                sourceDocument: mcp.sourceDocument
                    ? {
                          name: mcp.sourceDocument.name ?? 'Elemental source',
                          url: mcp.sourceDocument.url,
                          type: mcp.sourceDocument.type ?? 'elemental',
                      }
                    : undefined,
                ingestedAt: mcp.ingestedAt,
                publishedAt: mcp.publishedAt,
                extractedClaim: mcp.extractedClaim,
                entityResolutionConfidence: mcp.entityResolutionConfidence,
                relationshipConfidence: mcp.relationshipConfidence,
                eventExtractionConfidence: mcp.eventExtractionConfidence,
                geographyResolutionConfidence: mcp.geographyResolutionConfidence,
                elementalObjectIds: mcp.elementalObjectIds ?? [objectId],
                relatedAlerts: [],
                status: 'complete',
            };
        }
    } catch {
        // Fall through to API + local alert evidence.
    }

    try {
        const api = await elementalApiClient.fetchProvenance(objectId);
        if (api) {
            return {
                objectId,
                objectType: inferObjectType(objectId),
                sourceDocument: api.sourceDocument
                    ? {
                          name: api.sourceDocument.name ?? 'Elemental source',
                          url: api.sourceDocument.url,
                          type: api.sourceDocument.type ?? 'elemental',
                      }
                    : undefined,
                ingestedAt: api.ingestedAt,
                publishedAt: api.publishedAt,
                extractedClaim: api.extractedClaim,
                entityResolutionConfidence: api.entityResolutionConfidence,
                relationshipConfidence: api.relationshipConfidence,
                eventExtractionConfidence: api.eventExtractionConfidence,
                geographyResolutionConfidence: api.geographyResolutionConfidence,
                elementalObjectIds: api.elementalObjectIds ?? [objectId],
                relatedAlerts: [],
                status: 'complete',
            };
        }
    } catch {
        // Fall through to local alert evidence fallback.
    }

    const alerts = await yottalertStore.listAlerts();
    const matched = alerts.filter((a) => objectMatchesAlert(a, objectId));
    if (matched.length) {
        const evidence = matched.flatMap((a) => a.evidence);
        return fromEvidence(objectId, rollupProvenanceStatus(evidence), matched);
    }

    return {
        objectId,
        objectType: inferObjectType(objectId),
        elementalObjectIds: [objectId],
        relatedAlerts: [],
        status: 'unavailable',
    };
}

export const provenanceService = {
    rollupProvenanceStatus,
    rollupConfidence,
    evidenceSummary,
    getProvenanceForObject,
};
export type ProvenanceService = typeof provenanceService;
