import { unsealCookie } from '../../utils/cookies';
import {
    getFirestoreDb,
    normalizePrefsPath,
    shouldUseLocalFsFallback,
} from '../../utils/firestore';
import { localFsListCollections } from '../../utils/localFsPrefsStore';

/**
 * GET /api/prefs/collections?docPath=...
 *
 * Lists subcollection IDs under a document. The KV implementation
 * returned `[]` here (Redis is flat); Firestore can do this
 * properly via `DocumentReference.listCollections()`. Callers that
 * worked against the old empty-list contract still see `[]` when
 * the doc has no children, so this is a safe upgrade.
 */
export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const docPath = normalizePrefsPath(query.docPath as string | undefined);
    if (!docPath) return [];

    const cookieInfo = await unsealCookie(event);
    if (!cookieInfo?.user) return [];

    const db = getFirestoreDb();
    if (db) {
        const cols = await db.doc(docPath).listCollections();
        return cols.map((c) => c.id);
    }

    if (shouldUseLocalFsFallback()) {
        return localFsListCollections(docPath);
    }

    return [];
});
