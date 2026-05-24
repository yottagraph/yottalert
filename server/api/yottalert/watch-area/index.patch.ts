import type { InterestKey, WatchArea } from '~/utils/yottalert/types';
import { yottalertStore } from '~/server/services/yottalertStore';

interface PatchWatchAreaBody {
    userId?: string;
    geographyType?: WatchArea['geographyType'];
    geographyCode?: string;
    geographyLabel?: string;
    geographyNeid?: string;
    interests?: InterestKey[];
    minimumConfidence?: number;
}

export default defineEventHandler(async (event) => {
    const body = await readBody<PatchWatchAreaBody>(event);
    const userId = body.userId || 'dev-user';
    const existing = await yottalertStore.getWatchArea(userId);
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Watch area not found' });

    const nextInterests = body.interests ?? existing.interests;
    if (nextInterests.length < 2 || nextInterests.length > 5) {
        throw createError({ statusCode: 400, statusMessage: 'Select 2-5 interests' });
    }

    const watchArea: WatchArea = {
        ...existing,
        geographyType: body.geographyType ?? existing.geographyType,
        geographyCode: body.geographyCode?.trim() || existing.geographyCode,
        geographyLabel: body.geographyLabel?.trim() || existing.geographyLabel,
        geographyNeid: body.geographyNeid?.trim() || existing.geographyNeid,
        interests: nextInterests,
        minimumConfidence: Math.max(
            0,
            Math.min(1, body.minimumConfidence ?? existing.minimumConfidence)
        ),
        updatedAt: new Date().toISOString(),
    };

    await yottalertStore.saveWatchArea(watchArea);
    return { watchArea };
});
