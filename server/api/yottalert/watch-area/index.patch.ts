import type { InterestKey, WatchArea } from '~/utils/yottalert/types';
import { yottalertStore } from '~/server/services/yottalertStore';
import { getYottalertUserId } from '~/server/utils/yottalertUser';

interface PatchWatchAreaBody {
    userId?: string;
    id?: string;
    geographyType?: WatchArea['geographyType'];
    geographyCode?: string;
    geographyLabel?: string;
    geographyNeid?: string;
    interests?: InterestKey[];
    minimumConfidence?: number;
}

export default defineEventHandler(async (event) => {
    const body = await readBody<PatchWatchAreaBody>(event);
    const userId = await getYottalertUserId(event, body.userId);
    const existing = body.id
        ? await yottalertStore.getWatchAreaById(body.id)
        : await yottalertStore.getWatchArea(userId);
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Watch area not found' });
    if (existing.userId !== userId)
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' });

    const nextInterests = body.interests ?? existing.interests;
    if (nextInterests.length < 1) {
        throw createError({ statusCode: 400, statusMessage: 'Select at least one interest' });
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
