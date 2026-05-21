import { defineEventHandler, getRouterParam } from 'h3';

import { yottalertStore } from '~/server/services/yottalertStore';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });
    const rule = await yottalertStore.getAlertRule(id);
    if (!rule) throw createError({ statusCode: 404, statusMessage: 'Rule not found' });
    return { rule };
});
