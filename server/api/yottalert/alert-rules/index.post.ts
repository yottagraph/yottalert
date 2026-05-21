import { defineEventHandler, readBody } from 'h3';

import { yottalertStore } from '~/server/services/yottalertStore';
import { watchRuleInterpreter } from '~/server/services/watchRuleInterpreter';
import type { AlertRule, StructuredRule } from '~/utils/yottalert/types';

interface CreateRuleBody {
    name?: string;
    naturalLanguagePrompt?: string;
    structuredRule?: StructuredRule;
    frequency?: AlertRule['frequency'];
    sensitivity?: AlertRule['sensitivity'];
    minimumConfidence?: number;
    deliveryDestination?: string;
    enabled?: boolean;
    userId?: string;
    organizationId?: string;
}

function randomId(): string {
    return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default defineEventHandler(async (event) => {
    const body = await readBody<CreateRuleBody>(event);
    const prompt = (body.naturalLanguagePrompt || body.name || '').trim();
    if (!prompt) {
        throw createError({ statusCode: 400, statusMessage: 'naturalLanguagePrompt is required' });
    }

    const structured =
        body.structuredRule ?? (await watchRuleInterpreter.interpretWatchRule(prompt));

    const now = new Date().toISOString();
    const rule: AlertRule = {
        id: randomId(),
        organizationId: body.organizationId || 'default-org',
        userId: body.userId || 'dev-user',
        name: body.name || prompt.slice(0, 60),
        naturalLanguagePrompt: prompt,
        structuredRule: structured,
        watchTargetType: structured.watchTargetType,
        frequency: body.frequency ?? 'dashboard_only',
        minimumConfidence: body.minimumConfidence ?? structured.minimumConfidence,
        sensitivity: body.sensitivity ?? structured.sensitivity,
        deliveryDestination: body.deliveryDestination ?? 'dashboard_only',
        enabled: body.enabled ?? true,
        lastSeenEntityIds: [],
        lastSeenRelationshipIds: [],
        lastSeenEventIds: [],
        createdAt: now,
        updatedAt: now,
    };

    await yottalertStore.saveAlertRule(rule);
    return { rule };
});
