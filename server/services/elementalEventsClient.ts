import { useRuntimeConfig } from '#imports';

import type { AlertEventRef } from '~/utils/yottalert/types';
import { elementalFetch } from '~/server/utils/elementalFetch';
import { elementalApiClient } from './elementalApiClient';
import { getSchemaIds } from './elementalSchemaCache';

interface PropertyValueRow {
    eid?: string;
    // `pid` may arrive as a string (large int64 preserved by `elementalFetch`)
    // or as a JS number (small ids that fit in 53 bits). Always coerce via
    // `String(...)` before using as a key or interpolating into a payload.
    pid?: number | string;
    value?: unknown;
    recorded_at?: string;
    attributes?: Record<string, unknown>;
}

interface RawPropertyMap {
    [pid: string]: PropertyValueRow[];
}

interface GalaxyQuad {
    source?: string;
    // `pid` may be a string (bigint preserved by `elementalFetch`) or a number.
    pid?: number | string;
    property?: string;
    destination?: string;
    dest_type?: string;
    time?: string;
}

interface GalaxyEntityInfo {
    neid?: string;
    flavor?: string;
    flavorName?: string;
}

interface GalaxyNeighborsResponse {
    neighbors?: string[];
}

export interface RawEvent {
    articleNeid: string;
    title: string;
    type: string;
    occurredAt?: string;
    sourceUrl?: string;
    sourceName?: string;
    trustworthiness?: number;
    sentiment?: number;
    sentimentReasoning?: string;
    tone?: string;
    titleFactuality?: string;
    publicationName?: string;
    publicationNeid?: string;
    actors: Array<{ neid: string; name: string; sentiment?: number }>;
    rawValues: Record<string, string | number | null>;
}

function gatewayBase(): { url: string; org: string; key: string } {
    const config = useRuntimeConfig();
    const pub = config.public as Record<string, string>;
    return {
        url: pub.gatewayUrl || '',
        org: pub.tenantOrgId || '',
        key: pub.qsApiKey || '',
    };
}

function buildUrl(path: string): string {
    const { url, org } = gatewayBase();
    if (!url || !org) return '';
    return `${url}/api/qs/${org}/${path.replace(/^\//, '')}`;
}

function headers(extra?: Record<string, string>): Record<string, string> {
    const { key } = gatewayBase();
    return {
        'X-Api-Key': key,
        'Content-Type': 'application/json',
        ...extra,
    };
}

function toNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

function toNeid(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text) return null;
    if (/^\d+$/.test(text)) return text.padStart(20, '0');
    return text;
}

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

function pickLatest(rows: PropertyValueRow[]): PropertyValueRow | null {
    if (!rows.length) return null;
    return [...rows].sort((a, b) => {
        const ta = a.recorded_at ? Date.parse(a.recorded_at) : 0;
        const tb = b.recorded_at ? Date.parse(b.recorded_at) : 0;
        return tb - ta;
    })[0];
}

async function postFind(expression: string, limit: number): Promise<string[]> {
    if (!elementalApiClient.isConfigured()) return [];
    try {
        const body = new URLSearchParams();
        body.set('expression', expression);
        body.set('limit', String(limit));

        const res = await elementalFetch<Record<string, unknown>>(buildUrl('elemental/find'), {
            method: 'POST',
            headers: headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
            body: body.toString(),
            timeout: 10_000,
        });

        const fromEids = Array.isArray(res.eids) ? (res.eids as unknown[]) : [];
        const fromNeids = Array.isArray((res as { neids?: unknown[] }).neids)
            ? ((res as { neids?: unknown[] }).neids as unknown[])
            : [];
        const fromEntities = Array.isArray(
            (res as { entities?: Array<{ neid?: unknown; id?: unknown }> }).entities
        )
            ? (
                  (res as { entities?: Array<{ neid?: unknown; id?: unknown }> })
                      .entities as Array<{
                      neid?: unknown;
                      id?: unknown;
                  }>
              ).map((x) => x.neid ?? x.id)
            : [];

        return unique([...fromEids, ...fromNeids, ...fromEntities].map((v) => toNeid(v) ?? ''));
    } catch (error) {
        console.warn('[elementalEventsClient] find failed', error);
        return [];
    }
}

async function getNames(neids: string[]): Promise<Record<string, string>> {
    const ids = unique(neids);
    if (!ids.length) return {};
    try {
        const res = await elementalFetch<{ results?: Record<string, string> }>(
            buildUrl('entities/names'),
            {
                method: 'POST',
                headers: headers(),
                body: { neids: ids },
                timeout: 8000,
            }
        );
        return res.results ?? {};
    } catch {
        return {};
    }
}

async function getPropertyValuesFor(
    eids: string[],
    pids: string[],
    includeAttributes = false
): Promise<PropertyValueRow[]> {
    const cleanEids = unique(eids);
    const cleanPids = unique(pids);
    if (!cleanEids.length || !cleanPids.length) return [];

    const body = new URLSearchParams();
    body.set('eids', JSON.stringify(cleanEids));
    body.set('pids', `[${cleanPids.join(',')}]`);
    if (includeAttributes) body.set('include_attributes', 'true');

    try {
        const res = await elementalFetch<{ values?: PropertyValueRow[] }>(
            buildUrl('elemental/entities/properties'),
            {
                method: 'POST',
                headers: headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
                body: body.toString(),
                timeout: 12_000,
            }
        );
        return res.values ?? [];
    } catch (error) {
        console.warn('[elementalEventsClient] getPropertyValuesFor failed', error);
        return [];
    }
}

function groupByEidAndPid(rows: PropertyValueRow[]): Map<string, RawPropertyMap> {
    const out = new Map<string, RawPropertyMap>();
    for (const row of rows) {
        const eid = toNeid(row.eid);
        const pid = row.pid !== undefined && row.pid !== null ? String(row.pid) : '';
        if (!eid || !pid) continue;
        if (!out.has(eid)) out.set(eid, {});
        const map = out.get(eid)!;
        if (!map[pid]) map[pid] = [];
        map[pid].push(row);
    }
    return out;
}

function valueFor(rows: RawPropertyMap, pid: string | null): PropertyValueRow | null {
    if (!pid) return null;
    return pickLatest(rows[pid] ?? []);
}

function compareOccurredAt(a?: string, b?: string): number {
    const ta = a ? Date.parse(a) : 0;
    const tb = b ? Date.parse(b) : 0;
    return tb - ta;
}

function normalizeToken(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeTopic(value: string): string {
    return value.trim().toLowerCase();
}

function looksLikeArticleFlavor(flavor: string | undefined): boolean {
    if (!flavor) return false;
    const normalized = flavor.toLowerCase();
    return normalized.includes('article') || normalized.includes('news');
}

function confidenceFrom(event: RawEvent): number {
    const trust = event.trustworthiness ?? 0.66;
    return Math.max(0.3, Math.min(0.98, trust));
}

function rawValuesFrom(event: RawEvent): Record<string, string | number | null> {
    return {
        articleNeid: event.articleNeid,
        sourceName: event.sourceName ?? null,
        sourceUrl: event.sourceUrl ?? null,
        publicationName: event.publicationName ?? null,
        publicationNeid: event.publicationNeid ?? null,
        sentiment: event.sentiment ?? null,
        tone: event.tone ?? null,
        titleFactuality: event.titleFactuality ?? null,
        trustworthiness: event.trustworthiness ?? null,
    };
}

async function hydrateRawEvents(articleNeids: string[]): Promise<RawEvent[]> {
    const ids = unique(articleNeids);
    if (!ids.length) return [];

    const schema = await getSchemaIds();
    if (!schema) return [];

    const propertyPids = [
        schema.pids.title,
        schema.pids.hasTopic,
        schema.pids.sentiment,
        schema.pids.tone,
        schema.pids.titleFactuality,
        schema.pids.publishedAt,
        schema.pids.originalPublicationName,
        schema.pids.publishedIn,
    ].filter((v): v is string => Boolean(v));

    const articleValues = await getPropertyValuesFor(ids, propertyPids, false);
    const appearsInRows = schema.pids.appearsIn
        ? await getPropertyValuesFor(ids, [schema.pids.appearsIn], true)
        : [];

    const grouped = groupByEidAndPid(articleValues);
    const appearsByArticle = groupByEidAndPid(appearsInRows);

    const publicationNeids = unique(
        ids
            .map((eid) => {
                const values = grouped.get(eid) ?? {};
                const row = valueFor(values, schema.pids.publishedIn);
                return toNeid(row?.value);
            })
            .filter((v): v is string => Boolean(v))
    );
    const publicationNames = await getNames(publicationNeids);

    const actorNeids = unique(
        appearsInRows
            .map((row) => toNeid(row.value))
            .filter((v): v is string => Boolean(v))
            .filter((eid) => !ids.includes(eid))
    );
    const actorNames = await getNames(actorNeids);

    const events: RawEvent[] = [];
    for (const eid of ids) {
        const values = grouped.get(eid) ?? {};
        const appears = appearsByArticle.get(eid) ?? {};

        const titleRow = valueFor(values, schema.pids.title);
        const topicRow = valueFor(values, schema.pids.hasTopic);
        const sentimentRow = valueFor(values, schema.pids.sentiment);
        const toneRow = valueFor(values, schema.pids.tone);
        const factualityRow = valueFor(values, schema.pids.titleFactuality);
        const publishedAtRow = valueFor(values, schema.pids.publishedAt);
        const originalPublicationRow = valueFor(values, schema.pids.originalPublicationName);
        const publicationRow = valueFor(values, schema.pids.publishedIn);

        const appearsRows = schema.pids.appearsIn ? (appears[schema.pids.appearsIn] ?? []) : [];
        const attrs = appearsRows.map((row) => row.attributes ?? {});
        const urlCandidate = attrs
            .map((a) => {
                if (schema.aids.appearsInUrl) return a[schema.aids.appearsInUrl];
                return a.url;
            })
            .find((value) => typeof value === 'string' && value.length > 0) as string | undefined;
        const sourceCandidate = attrs
            .map((a) => {
                if (schema.aids.appearsInSource) return a[schema.aids.appearsInSource];
                return a.source;
            })
            .find((value) => typeof value === 'string' && value.length > 0) as string | undefined;
        const trustworthiness = attrs
            .map((a) => {
                if (schema.aids.appearsInTrustworthiness)
                    return toNumber(a[schema.aids.appearsInTrustworthiness]);
                return toNumber(a.trustworthiness);
            })
            .find((value) => value !== undefined);

        const actorRefs = appearsRows
            .map((row) => {
                const neid = toNeid(row.value);
                if (!neid || neid === eid) return null;
                const sentiment =
                    schema.aids.appearsInSentiment && row.attributes
                        ? toNumber(row.attributes[schema.aids.appearsInSentiment])
                        : toNumber(row.attributes?.sentiment);
                return {
                    neid,
                    name: actorNames[neid] ?? neid,
                    sentiment,
                };
            })
            .filter((value): value is { neid: string; name: string; sentiment?: number } =>
                Boolean(value)
            );

        const publicationNeid = toNeid(publicationRow?.value) ?? undefined;
        const publicationName =
            (publicationNeid ? publicationNames[publicationNeid] : undefined) ??
            (typeof originalPublicationRow?.value === 'string'
                ? String(originalPublicationRow.value)
                : undefined) ??
            sourceCandidate;

        const event: RawEvent = {
            articleNeid: eid,
            title:
                (typeof titleRow?.value === 'string' ? String(titleRow.value) : '') ||
                `Article ${eid.slice(-6)}`,
            type:
                (typeof topicRow?.value === 'string' ? String(topicRow.value) : 'Local news') ||
                'Local news',
            occurredAt: (publishedAtRow?.value as string | undefined) ?? titleRow?.recorded_at,
            sourceUrl: urlCandidate,
            sourceName: sourceCandidate,
            trustworthiness,
            sentiment: toNumber(sentimentRow?.value),
            sentimentReasoning: undefined,
            tone: (toneRow?.value as string | undefined) ?? undefined,
            titleFactuality: (factualityRow?.value as string | undefined) ?? undefined,
            publicationName,
            publicationNeid,
            actors: actorRefs.slice(0, 8),
            rawValues: {},
        };

        event.rawValues = rawValuesFrom(event);
        events.push(event);
    }

    return events.sort((a, b) => compareOccurredAt(a.occurredAt, b.occurredAt));
}

export function toAlertEventRef(event: RawEvent, geography?: string): AlertEventRef {
    return {
        id: event.articleNeid,
        title: event.title,
        type: event.type,
        geography,
        occurredAt: event.occurredAt,
        confidence: confidenceFrom(event),
        source: 'elemental',
        status: 'observed',
        publication: event.publicationName
            ? {
                  name: event.publicationName,
                  ...(event.sourceUrl ? { url: event.sourceUrl } : {}),
              }
            : undefined,
        url: event.sourceUrl,
        sentiment: event.sentiment,
        sentimentReasoning: event.sentimentReasoning,
        tone:
            event.tone === 'opinionated' || event.tone === 'matter-of-fact'
                ? event.tone
                : undefined,
        titleFactuality:
            event.titleFactuality === 'sensational' || event.titleFactuality === 'factual'
                ? event.titleFactuality
                : undefined,
        actors: event.actors,
        rawValues: event.rawValues,
    };
}

export async function enrichEvent(articleNeid: string): Promise<RawEvent | null> {
    const neid = toNeid(articleNeid);
    if (!neid) return null;
    const events = await hydrateRawEvents([neid]);
    return events[0] ?? null;
}

export async function fetchEntityAnchoredEvents(
    neids: string[],
    opts: { sinceMs: number; limit: number }
): Promise<RawEvent[]> {
    const entityIds = unique(neids.map((n) => toNeid(n) ?? ''));
    if (!entityIds.length) return [];

    const schema = await getSchemaIds();
    if (!schema?.fids.article || !schema.pids.appearsIn) return [];

    const articleHits = new Set<string>();
    for (const neid of entityIds.slice(0, 5)) {
        const expression = `{"type":"and","and":[{"type":"is_type","is_type":{"fid":${schema.fids.article}}},{"type":"linked","linked":{"to_entity":"${neid}","distance":1,"direction":"incoming","pids":[${schema.pids.appearsIn}]}}]}`;
        const hits = await postFind(expression, Math.max(opts.limit * 2, 20));
        hits.forEach((id) => articleHits.add(id));
    }

    const hydrated = await hydrateRawEvents([...articleHits]);
    const cutoff = Date.now() - Math.max(opts.sinceMs, 60_000);
    const filtered = hydrated.filter((event) => {
        if (!event.occurredAt) return true;
        const ts = Date.parse(event.occurredAt);
        return Number.isFinite(ts) ? ts >= cutoff : true;
    });
    return filtered.slice(0, opts.limit);
}

export async function fetchCategoryAnchoredEvents(
    categories: string[],
    opts: { geoNeid?: string; sinceMs: number; limit: number }
): Promise<RawEvent[]> {
    const labels = unique(categories.map((c) => c.trim()).filter(Boolean));
    if (!labels.length) return [];

    const schema = await getSchemaIds();
    if (!schema?.fids.article || !schema.pids.hasTopic) return [];

    const geoNeid = opts.geoNeid ? toNeid(opts.geoNeid) : null;
    const articleHits = new Set<string>();

    for (const label of labels.slice(0, 6)) {
        const parts = [
            `{"type":"is_type","is_type":{"fid":${schema.fids.article}}}`,
            `{"type":"comparison","comparison":{"operator":"eq","pid":${schema.pids.hasTopic},"value":${JSON.stringify(label)}}}`,
        ];
        if (geoNeid && schema.pids.appearsIn) {
            parts.push(
                `{"type":"linked","linked":{"to_entity":"${geoNeid}","distance":1,"direction":"incoming","pids":[${schema.pids.appearsIn}]}}`
            );
        }

        const expression = `{"type":"and","and":[${parts.join(',')}]}`;
        const hits = await postFind(expression, Math.max(opts.limit * 2, 20));
        hits.forEach((id) => articleHits.add(id));
    }

    const hydrated = await hydrateRawEvents([...articleHits]);
    const cutoff = Date.now() - Math.max(opts.sinceMs, 60_000);
    const filtered = hydrated.filter((event) => {
        if (!event.occurredAt) return true;
        const ts = Date.parse(event.occurredAt);
        return Number.isFinite(ts) ? ts >= cutoff : true;
    });
    return filtered.slice(0, opts.limit);
}

async function fetchGalaxyQuads(geoNeid: string): Promise<GalaxyQuad[]> {
    try {
        const res = await elementalFetch<{ quads?: GalaxyQuad[] }>(
            buildUrl(`galaxy/${encodeURIComponent(geoNeid)}/quads`),
            {
                headers: headers(),
                timeout: 12_000,
            }
        );
        return res.quads ?? [];
    } catch (error) {
        console.warn('[elementalEventsClient] galaxy quads fetch failed', error);
        return [];
    }
}

async function fetchGalaxyNeighbors(geoNeid: string, size: number): Promise<string[]> {
    try {
        const res = await elementalFetch<GalaxyNeighborsResponse>(
            buildUrl(`galaxy/${encodeURIComponent(geoNeid)}/neighbors?size=${size}`),
            {
                headers: headers(),
                timeout: 12_000,
            }
        );
        return unique((res.neighbors ?? []).map((id) => toNeid(id) ?? ''));
    } catch (error) {
        console.warn('[elementalEventsClient] galaxy neighbors fetch failed', error);
        return [];
    }
}

async function fetchGalaxyEntityInfo(neid: string): Promise<GalaxyEntityInfo | null> {
    try {
        return await elementalFetch<GalaxyEntityInfo>(
            buildUrl(`galaxy/${encodeURIComponent(neid)}/info`),
            {
                headers: headers(),
                timeout: 5_000,
            }
        );
    } catch {
        return null;
    }
}

export async function fetchGalaxyAnchoredEvents(
    geoNeid: string,
    opts: { sinceMs: number; limit: number; topicLabels?: string[] }
): Promise<RawEvent[]> {
    const normalizedGeoNeid = toNeid(geoNeid);
    if (!normalizedGeoNeid || !elementalApiClient.isConfigured()) return [];

    const cutoff = Date.now() - Math.max(opts.sinceMs, 60_000);

    // Prefer the dedicated neighborhood API for geo-centric traversal.
    let candidateIds = await fetchGalaxyNeighbors(
        normalizedGeoNeid,
        Math.max(opts.limit * 24, 120)
    );
    candidateIds = candidateIds.filter((id) => id !== normalizedGeoNeid);

    // Fallback: derive candidates from quads when neighborhood retrieval is unavailable.
    if (!candidateIds.length) {
        const quads = await fetchGalaxyQuads(normalizedGeoNeid);
        const quadCandidates = quads
            .filter((quad) => {
                const source = toNeid(quad.source);
                const destination = toNeid(quad.destination);
                if (!source || !destination) return false;
                if (source !== normalizedGeoNeid && destination !== normalizedGeoNeid) return false;
                if (source === destination) return false;

                if (!quad.time) return true;
                const parsed = Date.parse(quad.time);
                return Number.isFinite(parsed) ? parsed >= cutoff : true;
            })
            .map((quad) => {
                const source = toNeid(quad.source);
                const destination = toNeid(quad.destination);
                if (source === normalizedGeoNeid) return destination;
                return source;
            })
            .filter((id): id is string => Boolean(id));
        candidateIds = unique(quadCandidates).filter((id) => id !== normalizedGeoNeid);
    }
    if (!candidateIds.length) return [];

    const infoRows = await Promise.all(
        candidateIds.slice(0, Math.max(opts.limit * 16, 80)).map(async (neid) => ({
            neid,
            info: await fetchGalaxyEntityInfo(neid),
        }))
    );
    const articleIds = infoRows
        .filter((row) => looksLikeArticleFlavor(row.info?.flavorName ?? row.info?.flavor))
        .map((row) => row.neid);
    const idsToHydrate = articleIds.length ? articleIds : candidateIds;
    if (!idsToHydrate.length) return [];

    const hydrated = await hydrateRawEvents(idsToHydrate);
    const normalizedTopics = new Set((opts.topicLabels ?? []).map(normalizeTopic));
    const filteredByTime = hydrated.filter((event) => {
        if (!event.occurredAt) return true;
        const parsed = Date.parse(event.occurredAt);
        return Number.isFinite(parsed) ? parsed >= cutoff : true;
    });
    const filteredByTopic = normalizedTopics.size
        ? filteredByTime.filter((event) => normalizedTopics.has(normalizeTopic(event.type)))
        : filteredByTime;
    return filteredByTopic.slice(0, opts.limit);
}

export const elementalEventsClient = {
    fetchEntityAnchoredEvents,
    fetchCategoryAnchoredEvents,
    fetchGalaxyAnchoredEvents,
    enrichEvent,
    toAlertEventRef,
};
