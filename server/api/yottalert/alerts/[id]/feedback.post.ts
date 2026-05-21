import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { yottalertStore } from '~/server/services/yottalertStore';
import type { AlertFeedback, AlertFeedbackType } from '~/utils/yottalert/types';
import {
    applyFeedbackToSuppressionList,
    computeRuleFeedbackSignal,
} from '~/utils/yottalert/feedbackAggregation';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' });
    const body = await readBody<{
        feedbackType?: AlertFeedbackType;
        comment?: string;
        userId?: string;
    }>(event);
    if (!body?.feedbackType) {
        throw createError({ statusCode: 400, statusMessage: 'feedbackType is required' });
    }

    const alert = await yottalertStore.getAlert(id);
    if (!alert) throw createError({ statusCode: 404, statusMessage: 'Alert not found' });

    const feedback: AlertFeedback = {
        id: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        alertId: id,
        userId: body.userId || 'dev-user',
        feedbackType: body.feedbackType,
        comment: body.comment,
        createdAt: new Date().toISOString(),
    };
    await yottalertStore.appendFeedback(feedback);

    const feedbackForRule = await yottalertStore.listFeedbackForRule(alert.alertRuleId);
    const computed = computeRuleFeedbackSignal(feedbackForRule);
    const signal = {
        ruleId: alert.alertRuleId,
        ...computed,
        updatedAt: new Date().toISOString(),
    };
    await yottalertStore.saveRuleFeedbackSignal(signal);

    const existingSuppression = await yottalertStore.getRuleSuppressionList(alert.alertRuleId);
    const suppression = applyFeedbackToSuppressionList(existingSuppression, alert, feedback);
    await yottalertStore.saveRuleSuppressionList(suppression);

    return { feedback, signal, suppression };
});
