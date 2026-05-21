import { unsealCookie } from '../../utils/cookies';
import {
    getFirestoreDb,
    normalizePrefsPath,
    shouldUseLocalFsFallback,
} from '../../utils/firestore';
import { localFsReadDoc, localFsReadField } from '../../utils/localFsPrefsStore';

/**
 * GET /api/prefs/read?docPath=...&fieldName=...
 *
 * Mirrors the legacy `/api/kv/read` shape so the `FirestorePrefsStore`
 * is a drop-in client-side replacement for `KVPrefsStore`. When
 * `fieldName` is omitted, returns the full document. When present,
 * returns just that field's value (or `null` if missing — matching
 * the legacy Redis HGET → nil behaviour the existing Pref code
 * already handles).
 *
 * Backend selection: Firestore Admin when configured, otherwise the
 * local-FS fallback (`.aether-dev-prefs/`) in non-production. See
 * `firestore.ts:shouldUseLocalFsFallback`.
 */
export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const docPath = normalizePrefsPath(query.docPath as string | undefined);
    if (!docPath) return null;

    const cookieInfo = await unsealCookie(event);
    if (!cookieInfo?.user) return null;

    const fieldName = typeof query.fieldName === 'string' ? query.fieldName : null;

    const db = getFirestoreDb();
    if (db) {
        const snap = await db.doc(docPath).get();
        if (!snap.exists) return null;
        const data = snap.data() || {};
        return fieldName ? (data[fieldName] ?? null) : data;
    }

    if (shouldUseLocalFsFallback()) {
        return fieldName ? localFsReadField(docPath, fieldName) : localFsReadDoc(docPath);
    }

    return null;
});
