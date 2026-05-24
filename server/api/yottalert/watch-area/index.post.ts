import type { InterestKey, WatchArea } from '~/utils/yottalert/types';
import { yottalertStore } from '~/server/services/yottalertStore';

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
    const userId = body.userId || 'dev-user';
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
    if (interests.length < 2 || interests.length > 5) {
        throw createError({ statusCode: 400, statusMessage: 'Select 2-5 interests' });
    }

    const now = new Date().toISOString();
    const watchArea: WatchArea = {
        id: `wa-${userId}`,
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
