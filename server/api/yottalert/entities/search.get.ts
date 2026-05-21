import { defineEventHandler, getQuery } from 'h3';

import { elementalApiClient } from '~/server/services/elementalApiClient';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const q = (query.q as string) || '';
    if (!q.trim()) return { results: [] };
    const results = await elementalApiClient.searchEntitiesByName(q.trim(), {
        maxResults: Number(query.limit) || 8,
    });
    return { results };
});
