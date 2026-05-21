import { defineEventHandler, getRouterParam } from 'h3';

import { yottalertStore } from '~/server/services/yottalertStore';
import { syncScheduler } from '~/server/services/syncScheduler';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });

    const rule = await yottalertStore.getAlertRule(id);
    if (!rule) throw createError({ statusCode: 404, statusMessage: 'Rule not found' });

    const outcome = await syncScheduler.runSyncForRule(rule);
    return {
        syncRun: outcome.syncRun,
        created: outcome.created.map((a) => ({
            id: a.id,
            title: a.title,
            severity: a.severity,
            score: a.score,
        })),
    };
});
