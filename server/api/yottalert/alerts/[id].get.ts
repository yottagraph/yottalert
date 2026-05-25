import { defineEventHandler, getRouterParam } from 'h3';

import { yottalertStore } from '~/server/services/yottalertStore';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });
    const alert = await yottalertStore.getAlert(id);
    if (!alert) throw createError({ statusCode: 404, statusMessage: 'Alert not found' });
    if (alert.events.some((event) => event.source !== 'elemental')) {
        throw createError({
            statusCode: 410,
            statusMessage:
                'Legacy synthetic alert has been retired. Run Check now for fresh Elemental alerts.',
        });
    }
    const watchArea = await yottalertStore.getWatchArea('dev-user');
    const feedback = await yottalertStore.listFeedback(id);
    return { alert, watchArea, feedback };
});
