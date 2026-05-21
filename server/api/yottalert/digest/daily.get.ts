import { defineEventHandler, getQuery } from 'h3';

import { digestService } from '~/server/services/digestService';
import type { DigestFrequency } from '~/server/services/digestService';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const userId = (query.userId as string) || 'dev-user';
    const frequency = (query.frequency as DigestFrequency) || 'daily';
    const forceRegenerate = query.force === 'true' || query.forceRegenerate === 'true';
    const payload = await digestService.buildDailyDigest({ userId, frequency, forceRegenerate });
    return payload;
});
