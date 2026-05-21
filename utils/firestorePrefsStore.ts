import { encodePrefsPath } from '~/utils/pathTransform';
import type { PrefsStore, SettingsDoc } from '~/composables/usePrefsStore';

/**
 * `PrefsStore` backed by the per-tenant Aether Firestore (ENG-520).
 *
 * Talks to `/api/prefs/*` server routes — the actual `firebase-admin`
 * call happens server-side using the SA key injected by the portal as
 * `NUXT_FIRESTORE_SA_KEY`. Drop-in replacement for `KVPrefsStore`:
 * same fetch shape, same JSON-string serialization contract for
 * values, so the existing `Pref<T>` JSON.parse-on-read codepath
 * keeps working.
 *
 * Differences from `KVPrefsStore`:
 *
 *   - `listCollections(docPath)` actually returns subcollection IDs
 *     (Firestore supports this; Redis didn't).
 *   - `deleteCollection(path)` still fans out into per-document
 *     deletes — there's no first-class recursive-delete in the
 *     Firestore Admin REST API, and prefs collections are small.
 */
let _writeWarned = false;

export class FirestorePrefsStore implements PrefsStore {
    private apiFetch = $fetch;

    async getValue<PrefType>(docPath: string, fieldName: string): Promise<PrefType | undefined> {
        try {
            const encodedPath = encodePrefsPath(docPath);
            const result = await this.apiFetch('/api/prefs/read', {
                params: { docPath: encodedPath, fieldName },
            });
            if (result === undefined || result === null) return undefined;
            if (typeof result === 'string') {
                try {
                    return JSON.parse(result);
                } catch {
                    return result as unknown as PrefType;
                }
            }
            return result as PrefType;
        } catch {
            return undefined;
        }
    }

    async setValue<PrefType>(docPath: string, fieldName: string, value: PrefType): Promise<void> {
        try {
            const encodedPath = encodePrefsPath(docPath);
            const serialized = typeof value === 'string' ? value : JSON.stringify(value);
            await this.apiFetch('/api/prefs/write', {
                method: 'POST',
                body: { docPath: encodedPath, fieldName, value: serialized },
            });
        } catch {
            if (!_writeWarned) {
                _writeWarned = true;
                console.warn(
                    '[Pref] Firestore write failed — preferences will not persist across refreshes. ' +
                        'Verify NUXT_PUBLIC_FIRESTORE_ENABLED, NUXT_PUBLIC_FIRESTORE_PROJECT_ID, and ' +
                        'NUXT_FIRESTORE_SA_KEY are set on this tenant.'
                );
            }
        }
    }

    async readDoc(path: string): Promise<SettingsDoc | undefined> {
        try {
            const encodedPath = encodePrefsPath(path);
            const result = await this.apiFetch('/api/prefs/read', {
                params: { docPath: encodedPath },
            });
            if (!result || typeof result !== 'object') return undefined;
            return result as SettingsDoc;
        } catch {
            return undefined;
        }
    }

    async deleteDoc(path: string): Promise<void> {
        const encodedPath = encodePrefsPath(path);
        await this.apiFetch('/api/prefs/delete', {
            method: 'POST',
            body: { path: encodedPath },
        });
    }

    async deleteCollection(path: string): Promise<void> {
        const docs = await this.listDocuments(path);
        for (const docId of docs) {
            await this.deleteDoc(`${path}/${docId}`);
        }
    }

    async listDocuments(collectionPath: string): Promise<string[]> {
        try {
            const encodedPath = encodePrefsPath(collectionPath);
            const result = await this.apiFetch('/api/prefs/documents', {
                params: { collectionPath: encodedPath },
            });
            return Array.isArray(result) ? result : [];
        } catch {
            return [];
        }
    }

    async listCollections(docPath: string): Promise<string[]> {
        try {
            const encodedPath = encodePrefsPath(docPath);
            const result = await this.apiFetch('/api/prefs/collections', {
                params: { docPath: encodedPath },
            });
            return Array.isArray(result) ? result : [];
        } catch {
            return [];
        }
    }

    async copyDoc(from: string, to: string): Promise<void> {
        const doc = await this.readDoc(from);
        if (!doc) return;
        for (const [field, value] of Object.entries(doc)) {
            await this.setValue(to, field, value);
        }
    }

    async copyCollection(from: string, to: string): Promise<void> {
        const docs = await this.listDocuments(from);
        for (const docId of docs) {
            await this.copyDoc(`${from}/${docId}`, `${to}/${docId}`);
        }
    }
}
