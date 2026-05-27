import { useRuntimeConfig } from '#imports';

import { toIdString } from '~/utils/elementalJsonSafe';
import { elementalFetch } from '~/server/utils/elementalFetch';

export interface SchemaIds {
    fetchedAt: string;
    fids: {
        article: string | null;
        publication: string | null;
        organization: string | null;
        person: string | null;
        location: string | null;
    };
    pids: {
        name: string | null;
        title: string | null;
        hasTopic: string | null;
        sentiment: string | null;
        entitySentiment: string | null;
        tone: string | null;
        titleFactuality: string | null;
        appearsIn: string | null;
        publishedIn: string | null;
        publishedAt: string | null;
        originalPublicationName: string | null;
    };
    aids: {
        appearsInUrl: string | null;
        appearsInSource: string | null;
        appearsInTrustworthiness: string | null;
        appearsInSentiment: string | null;
    };
}

let cachedIds: SchemaIds | null = null;
let inflight: Promise<SchemaIds | null> | null = null;

function gatewayBase(): { url: string; org: string; key: string } {
    const config = useRuntimeConfig();
    const pub = config.public as Record<string, string>;
    return {
        url: pub.gatewayUrl || '',
        org: pub.tenantOrgId || '',
        key: pub.qsApiKey || '',
    };
}

function schemaUrl(): string {
    const { url, org } = gatewayBase();
    if (!url || !org) return '';
    return `${url}/api/qs/${org}/elemental/metadata/schema`;
}

function schemaHeaders(): Record<string, string> {
    const { key } = gatewayBase();
    return {
        'Content-Type': 'application/json',
        'X-Api-Key': key,
    };
}

function idFrom(item: Record<string, unknown> | null | undefined): string | null {
    if (!item) return null;
    // NOTE: schema responses must be parsed with `elementalFetch` so that
    // 64-bit PIDs/FIDs/AIDs arrive as strings; otherwise `JSON.parse`
    // silently rounds them past 2^53 and every downstream `entities/properties`
    // / `find` call sends a corrupted ID to Elemental.
    return (
        toIdString(item.fid) ??
        toIdString(item.findex) ??
        toIdString(item.pid) ??
        toIdString(item.pindex) ??
        toIdString(item.aid) ??
        toIdString(item.aindex) ??
        toIdString(item.id)
    );
}

function normalizeName(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase();
}

function resolveIdByName(rows: Array<Record<string, unknown>>, wanted: string): string | null {
    const found = rows.find((row) => normalizeName(row.name) === normalizeName(wanted));
    return idFrom(found);
}

function resolveAidByPropertyAndName(
    rows: Array<Record<string, unknown>>,
    propertyName: string,
    attributeName: string
): string | null {
    const found = rows.find(
        (row) =>
            normalizeName(row.property) === normalizeName(propertyName) &&
            normalizeName(row.name) === normalizeName(attributeName)
    );
    return idFrom(found);
}

async function loadSchemaIds(): Promise<SchemaIds | null> {
    const url = schemaUrl();
    if (!url) return null;

    try {
        const response = await elementalFetch<Record<string, unknown>>(url, {
            headers: schemaHeaders(),
            timeout: 8000,
        });

        const schemaRoot = (response.schema as Record<string, unknown>) ?? response;
        const flavors = (schemaRoot.flavors as Array<Record<string, unknown>>) ?? [];
        const properties = (schemaRoot.properties as Array<Record<string, unknown>>) ?? [];
        const relationships = (schemaRoot.relationships as Array<Record<string, unknown>>) ?? [];
        const attributes = (schemaRoot.attributes as Array<Record<string, unknown>>) ?? [];

        const relAndProps = [...properties, ...relationships];

        return {
            fetchedAt: new Date().toISOString(),
            fids: {
                article: resolveIdByName(flavors, 'article'),
                publication: resolveIdByName(flavors, 'publication'),
                organization: resolveIdByName(flavors, 'organization'),
                person: resolveIdByName(flavors, 'person'),
                location: resolveIdByName(flavors, 'location'),
            },
            pids: {
                name: resolveIdByName(relAndProps, 'name'),
                title: resolveIdByName(relAndProps, 'title'),
                hasTopic: resolveIdByName(relAndProps, 'has_topic'),
                sentiment: resolveIdByName(relAndProps, 'sentiment'),
                entitySentiment: resolveIdByName(relAndProps, 'entity_sentiment'),
                tone: resolveIdByName(relAndProps, 'tone'),
                titleFactuality: resolveIdByName(relAndProps, 'title_factuality'),
                appearsIn: resolveIdByName(relAndProps, 'appears_in'),
                publishedIn: resolveIdByName(relAndProps, 'published_in'),
                publishedAt: resolveIdByName(relAndProps, 'published_at'),
                originalPublicationName: resolveIdByName(relAndProps, 'original_publication_name'),
            },
            aids: {
                appearsInUrl: resolveAidByPropertyAndName(attributes, 'appears_in', 'url'),
                appearsInSource: resolveAidByPropertyAndName(attributes, 'appears_in', 'source'),
                appearsInTrustworthiness: resolveAidByPropertyAndName(
                    attributes,
                    'appears_in',
                    'trustworthiness'
                ),
                appearsInSentiment: resolveAidByPropertyAndName(
                    attributes,
                    'appears_in',
                    'sentiment'
                ),
            },
        };
    } catch (error) {
        console.warn('[elementalSchemaCache] Failed to load schema ids', error);
        return null;
    }
}

export async function getSchemaIds(): Promise<SchemaIds | null> {
    if (cachedIds) return cachedIds;
    if (!inflight) {
        inflight = loadSchemaIds().then((ids) => {
            cachedIds = ids;
            inflight = null;
            return ids;
        });
    }
    return inflight;
}

export function clearSchemaIdsCache() {
    cachedIds = null;
    inflight = null;
}

export const elementalSchemaCache = {
    getSchemaIds,
    clearSchemaIdsCache,
};
