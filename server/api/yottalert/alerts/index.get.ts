import { yottalertStore } from '~/server/services/yottalertStore';

export default defineEventHandler(async () => {
    const alerts = await yottalertStore.listAlerts();
    alerts.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    return { alerts };
});
