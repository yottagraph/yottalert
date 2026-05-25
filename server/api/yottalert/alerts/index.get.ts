import { yottalertStore } from '~/server/services/yottalertStore';
import { getYottalertUserId } from '~/server/utils/yottalertUser';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const userId = await getYottalertUserId(event, query.userId as string | undefined);
    const watchAreaIds = new Set(
        (await yottalertStore.listWatchAreas(userId)).map((area) => area.id)
    );
    const alerts = (await yottalertStore.listAlerts())
        .filter((alert) => watchAreaIds.has(alert.watchAreaId))
        .filter((alert) => alert.events.every((event) => event.source === 'elemental'))
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    return { alerts };
});
