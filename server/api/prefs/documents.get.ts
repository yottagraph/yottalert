import { unsealCookie } from '../../utils/cookies';
import {
    getFirestoreDb,
    normalizePrefsPath,
    shouldUseLocalFsFallback,
} from '../../utils/firestore';
import { localFsListDocuments } from '../../utils/localFsPrefsStore';

/**
 * GET /api/prefs/documents?collectionPath=...
 *
 * Lists document IDs in a collection. Uses `listDocuments()` rather
 * than `get()` so we pick up "phantom" documents (a doc with no
 * fields but at least one subcollection counts as a document in
 * Firestore but won't show up in `.get()`).
 *
 * Matches the legacy `/api/kv/documents` shape so the
 * `FirestorePrefsStore` is a drop-in client-side replacement.
 */
export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const collectionPath = normalizePrefsPath(query.collectionPath as string | undefined);
    if (!collectionPath) return [];

    const cookieInfo = await unsealCookie(event);
    if (!cookieInfo?.user) return [];

    const db = getFirestoreDb();
    if (db) {
        const refs = await db.collection(collectionPath).listDocuments();
        return refs.map((r) => r.id);
    }

    if (shouldUseLocalFsFallback()) {
        return localFsListDocuments(collectionPath);
    }

    return [];
});
