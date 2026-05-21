import { isFirestoreConfigured, shouldUseLocalFsFallback } from '../../utils/firestore';

/**
 * Reports whether the per-tenant Firestore prefs backend is wired up.
 * The client store (`composables/usePrefsStore.ts`) uses this to log a
 * helpful diagnostic and to know whether `Pref<T>` will actually persist.
 *
 * `available` is true whenever writes will land somewhere durable —
 * that's either a real Firestore (deployed BC 2.0 tenants) or the
 * local-FS fallback under `.aether-dev-prefs/` (`npm run dev`).
 * `backend` lets callers tell which one they're hitting.
 *
 * Replaces `/api/kv/status` for BC 2.0 tenants. Legacy KV tenants
 * continue to use their existing `/api/kv/status` endpoint.
 */
export default defineEventHandler(() => {
    if (isFirestoreConfigured()) {
        return { available: true, backend: 'firestore' as const };
    }
    if (shouldUseLocalFsFallback()) {
        return { available: true, backend: 'localfs' as const };
    }
    return { available: false, backend: 'none' as const };
});
