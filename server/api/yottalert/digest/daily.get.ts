import { defineEventHandler, getQuery } from 'h3';

import { digestService } from '~/server/services/digestService';
import type { DigestFrequency } from '~/server/services/digestService';
import { getYottalertUserId } from '~/server/utils/yottalertUser';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const userId = await getYottalertUserId(event, query.userId as string | undefined);
    const frequency = (query.frequency as DigestFrequency) || 'daily';
    const forceRegenerate = query.force === 'true' || query.forceRegenerate === 'true';
    const payload = await digestService.buildDailyDigest({ userId, frequency, forceRegenerate });
    return payload;
});
