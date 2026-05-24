import { syncScheduler } from '~/server/services/syncScheduler';
import { yottalertStore } from '~/server/services/yottalertStore';

export default defineEventHandler(async (event) => {
    const body = await readBody<{ userId?: string }>(event);
    const userId = body?.userId || 'dev-user';
    const watchArea = await yottalertStore.getWatchArea(userId);
    if (!watchArea) {
        throw createError({ statusCode: 404, statusMessage: 'Watch area not found' });
    }

    const outcome = await syncScheduler.runSyncForWatchArea(watchArea);
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
