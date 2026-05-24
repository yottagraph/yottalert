import { defineEventHandler, getRouterParam } from 'h3';

import { yottalertStore } from '~/server/services/yottalertStore';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });
    const alert = await yottalertStore.getAlert(id);
    if (!alert) throw createError({ statusCode: 404, statusMessage: 'Alert not found' });
    const watchArea = await yottalertStore.getWatchArea('dev-user');
    const feedback = await yottalertStore.listFeedback(id);
    return { alert, watchArea, feedback };
});
