import { syncScheduler } from '~/server/services/syncScheduler';
import { yottalertStore } from '~/server/services/yottalertStore';
import { getYottalertUserId } from '~/server/utils/yottalertUser';
import type { WatchArea } from '~/utils/yottalert/types';

export default defineEventHandler(async (event) => {
    const body = await readBody<{ userId?: string; watchAreaId?: string }>(event);
    const userId = await getYottalertUserId(event, body?.userId);
    const watchAreas = body?.watchAreaId
        ? [await yottalertStore.getWatchAreaById(body.watchAreaId)].filter(
              (area): area is WatchArea => Boolean(area)
          )
        : await yottalertStore.listWatchAreas(userId);

    if (!watchAreas.length) {
        throw createError({ statusCode: 404, statusMessage: 'Watch area not found' });
    }
    if (watchAreas.some((area) => area.userId !== userId)) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
    }

    const outcomes = await Promise.all(
        watchAreas.map((watchArea) => syncScheduler.runSyncForWatchArea(watchArea))
    );
    const created = outcomes.flatMap((outcome) => outcome.created);
    const syncRun = outcomes[0].syncRun;
    return {
        syncRun,
        syncRuns: outcomes.map((outcome) => outcome.syncRun),
        created: created.map((a) => ({
            id: a.id,
            title: a.title,
            severity: a.severity,
            score: a.score,
        })),
    };
});
