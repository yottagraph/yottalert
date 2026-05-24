import type { GeographySearchResult } from '~/utils/yottalert/types';
import { elementalApiClient } from '~/server/services/elementalApiClient';

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function toResult(name: string, neid?: string): GeographySearchResult | null {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const zipMatch = trimmed.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zipMatch) {
        return {
            neid,
            name: trimmed,
            geographyType: 'zip',
            code: zipMatch[1],
        };
    }

    if (/county\b/i.test(trimmed)) {
        return {
            neid,
            name: trimmed,
            geographyType: 'county',
            code: slugify(trimmed),
        };
    }

    return null;
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const q = String(query.q || '').trim();
    if (!q) return { results: [] as GeographySearchResult[] };

    const requestedType = query.type === 'zip' || query.type === 'county' ? query.type : null;
    const hits = await elementalApiClient.searchEntitiesByName(q, {
        maxResults: Number(query.limit) || 12,
    });

    const results = hits
        .map((hit) => toResult(hit.name, hit.neid))
        .filter((result): result is GeographySearchResult => Boolean(result))
        .filter((result) => (requestedType ? result.geographyType === requestedType : true));

    return { results };
});
