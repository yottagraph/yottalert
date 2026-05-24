import { yottalertStore } from '~/server/services/yottalertStore';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const userId = (query.userId as string) || 'dev-user';
    const watchArea = await yottalertStore.getWatchArea(userId);
    if (!watchArea) {
        throw createError({ statusCode: 404, statusMessage: 'Watch area not found' });
    }
    return { watchArea, backend: yottalertStore.backend() };
});
