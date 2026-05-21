import { defineEventHandler, getRouterParam } from 'h3';

import { provenanceService } from '~/server/services/provenanceService';

export default defineEventHandler(async (event) => {
    const objectId = getRouterParam(event, 'objectId');
    if (!objectId) throw createError({ statusCode: 400, statusMessage: 'objectId required' });
    const provenance = await provenanceService.getProvenanceForObject(objectId);
    return { provenance };
});
