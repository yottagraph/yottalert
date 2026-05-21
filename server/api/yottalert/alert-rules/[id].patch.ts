import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { yottalertStore } from '~/server/services/yottalertStore';
import type { AlertRule } from '~/utils/yottalert/types';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });

    const existing = await yottalertStore.getAlertRule(id);
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Rule not found' });

    const body = await readBody<Partial<AlertRule>>(event);
    const updated: AlertRule = {
        ...existing,
        ...body,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
    };
    await yottalertStore.saveAlertRule(updated);
    return { rule: updated };
});
