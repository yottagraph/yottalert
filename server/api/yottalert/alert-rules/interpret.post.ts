import { defineEventHandler, readBody } from 'h3';

import { watchRuleInterpreter } from '~/server/services/watchRuleInterpreter';

export default defineEventHandler(async (event) => {
    const body = await readBody<{ prompt?: string }>(event);
    const prompt = (body?.prompt || '').trim();
    if (!prompt) {
        throw createError({ statusCode: 400, statusMessage: 'prompt is required' });
    }
    const t0 = Date.now();
    const structured = await watchRuleInterpreter.interpretWatchRule(prompt);
    return {
        structured,
        compositionSource: 'deterministic' as const,
        latencyMs: Date.now() - t0,
    };
});
