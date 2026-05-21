import { unsealCookie } from '../../utils/cookies';
import {
    getFirestoreDb,
    normalizePrefsPath,
    shouldUseLocalFsFallback,
} from '../../utils/firestore';
import { localFsDeleteDoc } from '../../utils/localFsPrefsStore';

/**
 * POST /api/prefs/delete
 * Body: { path }
 *
 * Deletes a single document. Collection deletes are handled
 * client-side by `FirestorePrefsStore.deleteCollection` (which fans
 * out into per-document deletes) — Firestore Admin has no first-class
 * recursive-delete primitive for arbitrary depth and prefs
 * collections are small enough that the fan-out is fine.
 */
export default defineEventHandler(async (event) => {
    const body = await readBody<{ path?: string }>(event);
    const docPath = normalizePrefsPath(body?.path);
    if (!docPath) return null;

    const cookieInfo = await unsealCookie(event);
    if (!cookieInfo?.user) return null;

    const db = getFirestoreDb();
    if (db) {
        await db.doc(docPath).delete();
        return { ok: true };
    }

    if (shouldUseLocalFsFallback()) {
        localFsDeleteDoc(docPath);
        return { ok: true };
    }

    return null;
});
