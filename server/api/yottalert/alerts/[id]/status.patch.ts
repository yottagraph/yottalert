import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { yottalertStore } from '~/server/services/yottalertStore';
import type { AlertStatus } from '~/utils/yottalert/types';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });
    const body = await readBody<{ status?: AlertStatus }>(event);
    if (!body?.status) throw createError({ statusCode: 400, statusMessage: 'status is required' });

    const alert = await yottalertStore.getAlert(id);
    if (!alert) throw createError({ statusCode: 404, statusMessage: 'Alert not found' });

    const updated = { ...alert, status: body.status };
    await yottalertStore.saveAlert(updated);
    return { alert: updated };
});
