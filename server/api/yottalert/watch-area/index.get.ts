import { yottalertStore } from '~/server/services/yottalertStore';
import { getYottalertUserId } from '~/server/utils/yottalertUser';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const userId = await getYottalertUserId(event, query.userId as string | undefined);
    const watchAreas = await yottalertStore.listWatchAreas(userId);
    const watchArea = watchAreas[0] ?? null;
    if (!watchArea) {
        throw createError({ statusCode: 404, statusMessage: 'Watch area not found' });
    }
    return { watchArea, watchAreas, backend: yottalertStore.backend() };
});
