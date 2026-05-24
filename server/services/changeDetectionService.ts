/**
 * Change detection for a single user watch area. Uses real Elemental article
 * events when available and falls back to synthetic placeholders when not.
 */

import { categoriesForInterests } from '~/utils/yottalert/interests';
import {
    canonicalTopicLabelsForCategories,
    canonicalTopicLabelForCategory,
} from '~/utils/yottalert/eventCategories';
import type {
    AlertEntityRef,
    AlertEvidenceRef,
    AlertEventRef,
    AlertRelationshipRef,
    WatchArea,
    WatchSuppressionList,
} from '~/utils/yottalert/types';
import { elementalApiClient } from './elementalApiClient';
import { elementalEventsClient } from './elementalEventsClient';

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

function slugify(s?: string): string {
    return (s || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function nowIso(): string {
    return new Date().toISOString();
}

function nowMinusMinutes(min: number): string {
    return new Date(Date.now() - min * 60_000).toISOString();
}

async function gatherEntitiesForArea(area: WatchArea): Promise<AlertEntityRef[]> {
    const out: AlertEntityRef[] = [];
    const seen = new Set<string>();
    const push = (neid: string | undefined, name: string | undefined) => {
        const key = neid || name;
        if (!key || !name) return;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ neid: neid || `local-${name}`, name });
    };

    if (area.geographyNeid || area.geographyLabel) {
        push(area.geographyNeid, area.geographyLabel);
    }

    if (area.geographyLabel && elementalApiClient.isConfigured()) {
        const hits = await elementalApiClient.searchEntitiesByName(area.geographyLabel, {
            maxResults: 5,
        });
        for (const h of hits) push(h.neid, h.name);
    }

    if (area.geographyCode && elementalApiClient.isConfigured() && out.length < 5) {
        const hits = await elementalApiClient.searchEntitiesByName(area.geographyCode, {
            maxResults: 5 - out.length,
        });
        for (const h of hits) push(h.neid, h.name);
    }

    return out;
}

function makeSyntheticEvents(area: WatchArea, entities: AlertEntityRef[]): AlertEventRef[] {
    const categories = categoriesForInterests(area.interests);
    const cat = categories[0] ?? 'local_news';
    const canonical = canonicalTopicLabelForCategory(cat);
    const labels = [
        {
            offset: 18,
            title: `${canonical} reported${entities[0] ? ` near ${entities[0].name}` : ''}`,
        },
        {
            offset: 96,
            title: `Earlier ${canonical} flagged in watched ${area.geographyLabel}`,
        },
    ];
    return labels.map((l, i) => ({
        id: `${area.id}-evt-${i}`,
        title: l.title,
        type: canonical,
        geography: area.geographyLabel,
        occurredAt: nowMinusMinutes(l.offset),
        confidence: 0.5,
        source: 'synthetic',
        status: 'historical',
    }));
}

async function gatherEventsForArea(
    area: WatchArea,
    entities: AlertEntityRef[],
    apiConfigured: boolean
): Promise<AlertEventRef[]> {
    if (!apiConfigured) return makeSyntheticEvents(area, entities);

    const sinceMs = 30 * 24 * 60 * 60 * 1000;
    const limit = 5;

    try {
        const categories = categoriesForInterests(area.interests);
        const geoNeid = area.geographyNeid ?? entities[0]?.neid;
        const rawEvents = await elementalEventsClient.fetchCategoryAnchoredEvents(
            canonicalTopicLabelsForCategories(categories),
            {
                geoNeid,
                sinceMs,
                limit,
            }
        );

        const realEvents = rawEvents.map((event) =>
            elementalEventsClient.toAlertEventRef(event, area.geographyLabel)
        );
        if (realEvents.length) return realEvents;
    } catch (error) {
        console.warn('[changeDetectionService] gatherEventsForRule failed', error);
    }

    return makeSyntheticEvents(area, entities);
}

function makeEvidence(
    area: WatchArea,
    entities: AlertEntityRef[],
    events: AlertEventRef[],
    apiConfigured: boolean
): AlertEvidenceRef[] {
    if (!apiConfigured || events.every((event) => event.source === 'synthetic')) {
        return [
            {
                id: `${area.id}-syn-1`,
                evidenceType: 'synthetic',
                displayText: `Synthetic preview — Elemental is not reachable, so this candidate is illustrative only.`,
                sourceName: 'Yottalert local generator',
                confidence: 0.5,
            },
        ];
    }
    const evidence: AlertEvidenceRef[] = entities.slice(0, 3).map((e, i) => ({
        id: `${area.id}-${e.neid}-${i}`,
        elementalObjectId: e.neid,
        elementalSourceId: undefined,
        evidenceType: 'elemental',
        displayText: `Match on entity ${e.name} via Elemental Query Server.`,
        sourceName: 'Elemental Query Server',
        ingestedAt: nowIso(),
        confidence: 0.78,
    }));

    for (const [index, event] of events.slice(0, 3).entries()) {
        evidence.push({
            id: `${area.id}-event-${index}`,
            elementalObjectId: event.id,
            elementalSourceId: event.id,
            evidenceType: 'elemental',
            displayText: event.title,
            sourceName: event.publication?.name ?? 'Elemental article graph',
            sourceUrl: event.url,
            publishedAt: event.occurredAt,
            ingestedAt: nowIso(),
            confidence: event.confidence,
        });
    }

    if (area.geographyLabel) {
        evidence.push({
            id: `${area.id}-geo`,
            evidenceType: 'elemental',
            displayText: `Geography match: ${area.geographyLabel}.`,
            sourceName: 'Elemental geography index',
            ingestedAt: nowIso(),
            confidence: 0.82,
        });
    }
    return evidence;
}

function makeRelationships(area: WatchArea, entities: AlertEntityRef[]): AlertRelationshipRef[] {
    if (entities.length < 1) return [];
    const subjects = entities.slice(0, 2);
    return subjects.map((s, i) => ({
        id: `${area.id}-rel-${i}`,
        subject: s.name,
        predicate: 'located_in',
        object: area.geographyLabel,
        confidence: 0.74,
    }));
}

export async function detectChanges(
    area: WatchArea,
    suppression?: WatchSuppressionList | null
): Promise<ChangeCandidate[]> {
    const apiConfigured = elementalApiClient.isConfigured();
    const entities = await gatherEntitiesForArea(area);
    const events = await gatherEventsForArea(area, entities, apiConfigured);
    const relationships = makeRelationships(area, entities);
    const evidence = makeEvidence(area, entities, events, apiConfigured);
    const recencyMinutes = Math.min(
        ...events
            .map((event) =>
                event.occurredAt ? (Date.now() - Date.parse(event.occurredAt)) / 60_000 : 1440
            )
            .filter((value) => Number.isFinite(value))
    );

    const elementalEventIds = events
        .filter((event) => event.source === 'elemental')
        .map((event) => event.id);

    const candidates: ChangeCandidate[] = [
        {
            title: events[0]?.title ?? `Change candidate for ${area.geographyLabel}`,
            geographyLabel: area.geographyLabel,
            entities,
            events,
            relationships,
            evidence,
            confidence: apiConfigured ? 0.78 : 0.5,
            recencyMinutes: Number.isFinite(recencyMinutes) ? recencyMinutes : 18,
            elementalEntityIds: entities.map((e) => e.neid),
            elementalEventIds,
            elementalRelationshipIds: relationships.map((r) => r.id),
            elementalObjectIds: [
                ...entities.map((e) => e.neid),
                ...elementalEventIds,
                ...relationships.map((r) => r.id),
            ],
        },
    ];

    if (entities.length > 1 || events.length > 2) {
        const secondaryEvents = events.slice(1, 3);
        candidates.push({
            title: secondaryEvents[0]?.title ?? `Secondary change for ${area.geographyLabel}`,
            geographyLabel: area.geographyLabel,
            entities: entities.slice(1, 3),
            events: secondaryEvents,
            relationships: relationships.slice(0, 1),
            evidence: evidence.slice(0, 3),
            confidence: apiConfigured ? 0.66 : 0.45,
            recencyMinutes: 240,
            elementalEntityIds: entities.slice(1, 3).map((e) => e.neid),
            elementalEventIds: secondaryEvents
                .filter((event) => event.source === 'elemental')
                .map((event) => event.id),
            elementalRelationshipIds: relationships.slice(0, 1).map((r) => r.id),
            elementalObjectIds: [
                ...entities.slice(1, 3).map((e) => e.neid),
                ...secondaryEvents
                    .filter((event) => event.source === 'elemental')
                    .map((event) => event.id),
                ...relationships.slice(0, 1).map((r) => r.id),
            ],
        });
    }

    if (!suppression) return candidates;

    return candidates.filter((candidate) => {
        const suppressedEntityHit = suppression.suppressedEntityIds.some((id) =>
            candidate.elementalEntityIds.includes(id)
        );
        const suppressedGeoHit =
            !!candidate.geographyLabel &&
            suppression.suppressedGeographySlugs.includes(slugify(candidate.geographyLabel));
        return !suppressedEntityHit && !suppressedGeoHit;
    });
}

export const changeDetectionService = { detectChanges };
export type ChangeDetectionService = typeof changeDetectionService;
