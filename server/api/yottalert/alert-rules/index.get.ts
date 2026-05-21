import { yottalertStore } from '~/server/services/yottalertStore';

export default defineEventHandler(async () => {
    const rules = await yottalertStore.listAlertRules();
    rules.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
    return { rules, backend: yottalertStore.backend() };
});
