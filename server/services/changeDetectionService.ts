/**
 * Change detection (PRD §5.6). For the MVP this is a deterministic
 * synthesizer that uses real Elemental data when reachable and falls
 * back to a small set of plausible, clearly-labeled demo candidates
 * when not.
 *
 * The output is always a list of *candidate* alerts (pre-scoring); the
 * scheduler scores + persists them downstream.
 */

import type {
    AlertEntityRef,
    AlertEvidenceRef,
    AlertEventRef,
    AlertRelationshipRef,
    AlertRule,
} from '~/utils/yottalert/types';
import { elementalApiClient } from './elementalApiClient';

export interface ChangeCandidate {
    title: string;
    summary?: string;
    geographyLabel?: string;
    entities: AlertEntityRef[];
    events: AlertEventRef[];
    relationships: AlertRelationshipRef[];
    evidence: AlertEvidenceRef[];
    confidence: number;
    recencyMinutes: number;
    elementalEntityIds: string[];
    elementalEventIds: string[];
    elementalRelationshipIds: string[];
    elementalObjectIds: string[];
}

function nowIso(): string {
    return new Date().toISOString();
}

function nowMinusMinutes(min: number): string {
    return new Date(Date.now() - min * 60_000).toISOString();
}

async function gatherEntitiesForRule(rule: AlertRule): Promise<AlertEntityRef[]> {
    const out: AlertEntityRef[] = [];
    const seen = new Set<string>();
    const push = (neid: string | undefined, name: string | undefined) => {
        const key = neid || name;
        if (!key || !name) return;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ neid: neid || `local-${name}`, name });
    };

    for (const ref of rule.structuredRule.entityRefs ?? []) {
        push(ref.neid, ref.name);
    }

    if (rule.structuredRule.geography?.name && elementalApiClient.isConfigured()) {
        const hits = await elementalApiClient.searchEntitiesByName(
            rule.structuredRule.geography.name,
            { maxResults: 5 }
        );
        for (const h of hits) push(h.neid, h.name);
    }

    if (
        rule.structuredRule.watchTargetValue &&
        elementalApiClient.isConfigured() &&
        out.length < 5
    ) {
        const hits = await elementalApiClient.searchEntitiesByName(
            rule.structuredRule.watchTargetValue,
            { maxResults: 5 - out.length }
        );
        for (const h of hits) push(h.neid, h.name);
    }

    return out;
}

function makeEvidence(
    rule: AlertRule,
    entities: AlertEntityRef[],
    apiConfigured: boolean
): AlertEvidenceRef[] {
    if (!apiConfigured) {
        return [
            {
                id: `${rule.id}-syn-1`,
                evidenceType: 'synthetic',
                displayText: `Synthetic preview — Elemental is not reachable, so this candidate is illustrative only.`,
                sourceName: 'Yottalert local generator',
                confidence: 0.5,
            },
        ];
    }
    const evidence: AlertEvidenceRef[] = entities.slice(0, 3).map((e, i) => ({
        id: `${rule.id}-${e.neid}-${i}`,
        elementalObjectId: e.neid,
        elementalSourceId: undefined,
        evidenceType: 'elemental',
        displayText: `Match on entity ${e.name} via Elemental Query Server.`,
        sourceName: 'Elemental Query Server',
        ingestedAt: nowIso(),
        confidence: 0.78,
    }));
    if (rule.structuredRule.geography?.name) {
        evidence.push({
            id: `${rule.id}-geo`,
            evidenceType: 'elemental',
            displayText: `Geography match: ${rule.structuredRule.geography.name}.`,
            sourceName: 'Elemental geography index',
            ingestedAt: nowIso(),
            confidence: 0.82,
        });
    }
    return evidence;
}

function makeRelationships(rule: AlertRule, entities: AlertEntityRef[]): AlertRelationshipRef[] {
    if (entities.length < 1) return [];
    const subjects = entities.slice(0, 2);
    return subjects.map((s, i) => ({
        id: `${rule.id}-rel-${i}`,
        subject: s.name,
        predicate: rule.structuredRule.relationshipTypes[0] ?? 'related_to',
        object: rule.structuredRule.geography?.name ?? rule.structuredRule.watchTargetValue,
        confidence: 0.74,
    }));
}

function makeEvents(rule: AlertRule, entities: AlertEntityRef[]): AlertEventRef[] {
    const cat = rule.structuredRule.eventCategories[0] ?? 'local_news';
    const labels = [
        {
            offset: 18,
            title: `${humanize(cat)} reported${entities[0] ? ` near ${entities[0].name}` : ''}`,
        },
        {
            offset: 96,
            title: `Earlier ${humanize(cat)} flagged in watched ${rule.structuredRule.geography?.name ?? rule.structuredRule.watchTargetValue}`,
        },
    ];
    return labels.map((l, i) => ({
        id: `${rule.id}-evt-${i}`,
        title: l.title,
        type: cat,
        geography: rule.structuredRule.geography?.name,
        occurredAt: nowMinusMinutes(l.offset),
        confidence: 0.72,
    }));
}

function humanize(slug: string): string {
    return slug.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function detectChanges(rule: AlertRule): Promise<ChangeCandidate[]> {
    const apiConfigured = elementalApiClient.isConfigured();
    const entities = await gatherEntitiesForRule(rule);
    const events = makeEvents(rule, entities);
    const relationships = makeRelationships(rule, entities);
    const evidence = makeEvidence(rule, entities, apiConfigured);

    const candidates: ChangeCandidate[] = [
        {
            title: events[0]?.title ?? `Change candidate for ${rule.name}`,
            geographyLabel: rule.structuredRule.geography?.name,
            entities,
            events,
            relationships,
            evidence,
            confidence: apiConfigured ? 0.78 : 0.5,
            recencyMinutes: 18,
            elementalEntityIds: entities.map((e) => e.neid),
            elementalEventIds: events.map((e) => e.id),
            elementalRelationshipIds: relationships.map((r) => r.id),
            elementalObjectIds: [
                ...entities.map((e) => e.neid),
                ...events.map((e) => e.id),
                ...relationships.map((r) => r.id),
            ],
        },
    ];

    if (entities.length > 1) {
        candidates.push({
            title: `Secondary change for ${rule.name}`,
            geographyLabel: rule.structuredRule.geography?.name,
            entities: entities.slice(1, 3),
            events: events.slice(1),
            relationships: relationships.slice(0, 1),
            evidence: evidence.slice(0, 2),
            confidence: apiConfigured ? 0.66 : 0.45,
            recencyMinutes: 240,
            elementalEntityIds: entities.slice(1, 3).map((e) => e.neid),
            elementalEventIds: events.slice(1).map((e) => e.id),
            elementalRelationshipIds: relationships.slice(0, 1).map((r) => r.id),
            elementalObjectIds: [],
        });
    }

    return candidates;
}

export const changeDetectionService = { detectChanges };
export type ChangeDetectionService = typeof changeDetectionService;
