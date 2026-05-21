import { unsealCookie } from '../../utils/cookies';
import {
    getFirestoreDb,
    normalizePrefsPath,
    shouldUseLocalFsFallback,
} from '../../utils/firestore';
import { localFsWriteField } from '../../utils/localFsPrefsStore';

/**
 * POST /api/prefs/write
 * Body: { docPath, fieldName, value }
 *
 * Sets a single field on a prefs document. Uses Firestore's `set(...,
 * { merge: true })` semantics so concurrent writes to different fields
 * don't clobber each other — matches the Redis `HSET` behaviour the
 * legacy route relied on.
 *
 * Value type contract: the client (`FirestorePrefsStore.setValue`)
 * serializes everything to a JSON string before sending so the
 * stored shape is identical to the legacy KV implementation. That
 * keeps the existing `Pref<T>` JSON.parse-on-read logic working
 * without modification. Native-typed writes would be more idiomatic
 * Firestore but would require touching every callsite.
 */
export default defineEventHandler(async (event) => {
    const body = await readBody<{ docPath?: string; fieldName?: string; value?: unknown }>(event);
    const docPath = normalizePrefsPath(body?.docPath);
    if (!docPath || typeof body?.fieldName !== 'string') return null;

    const cookieInfo = await unsealCookie(event);
    if (!cookieInfo?.user) return null;

    const db = getFirestoreDb();
    if (db) {
        await db.doc(docPath).set({ [body.fieldName]: body.value ?? null }, { merge: true });
        return { ok: true };
    }

    if (shouldUseLocalFsFallback()) {
        localFsWriteField(docPath, body.fieldName, body.value);
        return { ok: true };
    }

    return null;
});
