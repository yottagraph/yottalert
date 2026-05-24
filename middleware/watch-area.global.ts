export default defineNuxtRouteMiddleware(async (to) => {
    if (!to.path.startsWith('/yottalert')) return;
    if (to.path === '/yottalert/onboarding') return;

    try {
        await $fetch('/api/yottalert/watch-area');
    } catch {
        return navigateTo('/yottalert/onboarding');
    }
});
