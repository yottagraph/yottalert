import type { InterestKey, WatchArea } from '~/utils/yottalert/types';
import { yottalertStore } from '~/server/services/yottalertStore';
import { getYottalertUserId } from '~/server/utils/yottalertUser';

interface CreateWatchAreaBody {
    userId?: string;
    geographyType?: WatchArea['geographyType'];
    geographyCode?: string;
    geographyLabel?: string;
    geographyNeid?: string;
    interests?: InterestKey[];
    minimumConfidence?: number;
}

export default defineEventHandler(async (event) => {
    const body = await readBody<CreateWatchAreaBody>(event);
    const userId = await getYottalertUserId(event, body.userId);
    const geographyType = body.geographyType;
    const geographyCode = body.geographyCode?.trim();
    const geographyLabel = body.geographyLabel?.trim();
    const interests = body.interests ?? [];

    if (!geographyType || (geographyType !== 'zip' && geographyType !== 'county')) {
        throw createError({
            statusCode: 400,
            statusMessage: 'geographyType must be zip or county',
        });
    }
    if (!geographyCode || !geographyLabel) {
        throw createError({
            statusCode: 400,
            statusMessage: 'geographyCode and geographyLabel are required',
        });
    }
    if (interests.length < 1) {
        throw createError({ statusCode: 400, statusMessage: 'Select at least one interest' });
    }

    const now = new Date().toISOString();
    const areaId = `wa-${userId}-${Date.now().toString(36)}`;
    const watchArea: WatchArea = {
        id: areaId,
        userId,
        geographyType,
        geographyCode,
        geographyLabel,
        geographyNeid: body.geographyNeid?.trim() || undefined,
        interests,
        minimumConfidence: Math.max(0, Math.min(1, body.minimumConfidence ?? 0.65)),
        lastSeenEntityIds: [],
        lastSeenRelationshipIds: [],
        lastSeenEventIds: [],
        createdAt: now,
        updatedAt: now,
    };

    await yottalertStore.saveWatchArea(watchArea);
    return { watchArea };
});
