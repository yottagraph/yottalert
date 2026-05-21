import { defineEventHandler, getRouterParam } from 'h3';

import { yottalertStore } from '~/server/services/yottalertStore';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });

    const signal = await yottalertStore.getRuleFeedbackSignal(id);
    const suppression = await yottalertStore.getRuleSuppressionList(id);
    return { signal, suppression };
});
