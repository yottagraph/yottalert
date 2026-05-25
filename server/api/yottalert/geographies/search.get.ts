import type { GeographySearchResult } from '~/utils/yottalert/types';
import { elementalApiClient } from '~/server/services/elementalApiClient';

const ZIP_FALLBACKS: Record<string, GeographySearchResult> = {
    '15222': {
        neid: '08756969412017621503',
        name: 'Pittsburgh, PA 15222 (Allegheny County)',
        geographyType: 'zip',
        code: '15222',
    },
};

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

function fallbackZipResult(q: string): GeographySearchResult | null {
    const zipMatch = q.match(/^\d{5}$/);
    if (!zipMatch) return null;
    return (
        ZIP_FALLBACKS[q] ?? {
            name: `ZIP ${q}`,
            geographyType: 'zip',
            code: q,
        }
    );
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
    const fallback = fallbackZipResult(q);
    if (fallback && (!requestedType || requestedType === 'zip')) {
        const alreadyPresent = results.some(
            (result) => result.geographyType === 'zip' && result.code === fallback.code
        );
        if (!alreadyPresent) results.unshift(fallback);
    }

    return { results };
});
