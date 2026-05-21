import { FirestorePrefsStore } from '~/utils/firestorePrefsStore';
import { KVPrefsStore } from '~/utils/kvPrefsStore';

export type SettingsDoc = Record<string, string>;

/**
 * Reactive preference that auto-syncs to KV storage.
 *
 * @param docPath - KV document path, e.g. `/users/{userId}/apps/{appId}/settings/general`
 * @param fieldName - field name within the document
 * @param defaultValue - used when no stored value exists
 *
 * Usage:
 *   const pref = new Pref<boolean>(path, 'darkMode', true);
 *   await pref.initialize();
 *   pref.r.value;       // reactive ref (use in templates)
 *   pref.v;             // getter shorthand
 *   pref.set(false);    // persists to KV
 *
 * When KV is not configured (local dev), works with defaults but won't persist.
 * See `pref.md` in the `aether` skill for namespacing and architecture details.
 */
export class Pref<PrefType> {
    private _fieldName: string;
    private _docPath: string;
    private _defaultValue: PrefType;
    public r = ref<PrefType>();

    constructor(docPath: string, fieldName: string, defaultValue: PrefType) {
        this._fieldName = fieldName;
        this._docPath = docPath;
        this._defaultValue = defaultValue;
        this.r.value = defaultValue;
    }

    async changeSource(newDocPath: string, settingsDoc: SettingsDoc | undefined = undefined) {
        this._docPath = newDocPath;

        let value = undefined;
        if (settingsDoc) {
            if (settingsDoc.hasOwnProperty(this._fieldName)) {
                value = JSON.parse(settingsDoc[this._fieldName]) as PrefType;
            }
        } else {
            value = (await getPrefsStore().getValue<PrefType>(
                this._docPath,
                this._fieldName
            )) as PrefType;
        }

        if (value !== undefined) {
            this.r.value = value;
        } else {
            this.r.value = this._defaultValue;
        }
    }

    async initialize(settingsDoc: SettingsDoc | undefined = undefined) {
        console.log(`Initializing ${this._docPath}/${this._fieldName}`);
        if (settingsDoc) {
            let value = undefined;
            if (settingsDoc.hasOwnProperty(this._fieldName)) {
                value = JSON.parse(settingsDoc[this._fieldName]) as PrefType;
            }
            if (value !== undefined) {
                this.r.value = value;
            }
            console.log(
                `Initialized ${this._docPath}/${this._fieldName} to ${value} from settingsDoc`
            );
        } else {
            const value: PrefType | undefined = (await getPrefsStore().getValue<PrefType>(
                this._docPath,
                this._fieldName
            )) as PrefType;
            if (value !== undefined) {
                this.r.value = value;
            }
            console.log(
                `Initialized ${this._docPath}/${this._fieldName} to ${value} from prefsStore`
            );
        }

        // Only attach our watcher once we've read any stored value.
        watch(this.r, () => {
            if (this.r.value !== undefined) {
                this.set(this.r.value);
            }
        });
    }

    set(newValue: PrefType) {
        console.log(`Setting ${this._docPath}/${this._fieldName} to ${newValue}`);
        if (!this._docPath.startsWith('/users/')) {
            return;
        }

        getPrefsStore().setValue<PrefType>(this._docPath, this._fieldName, newValue);
        this.r.value = newValue;
    }

    get v(): PrefType | undefined {
        console.log(`Getting ${this._docPath}/${this._fieldName}: ${this.r.value}`);
        return this.r.value;
    }

    debugString(): string {
        return `Pref ${this._docPath}/${this._fieldName}: ${this.r.value}`;
    }
}

// #endregion

// #region Interface for the implementation classes.

export interface PrefsStore {
    // Document operations.
    copyDoc(from: string, to: string): Promise<void>;
    deleteDoc(path: string): Promise<void>;
    readDoc(path: string): Promise<SettingsDoc | undefined>;

    // Collection operations.
    copyCollection(from: string, to: string): Promise<void>;
    deleteCollection(path: string): Promise<void>;

    // Getters
    getValue<PrefType>(docPath: string, fieldName: string): Promise<PrefType | undefined>;

    // Listers
    listCollections(docPath: string): Promise<string[]>;
    listDocuments(collectionPath: string): Promise<string[]>;

    // Setters
    setValue<PrefType>(docPath: string, fieldName: string, value: PrefType): Promise<void>;
}

// #endregion

let userSettings: any = undefined;

/**
 * Reactive flag exposed by `usePrefsStore().prefsAvailable` (and the
 * legacy alias `kvAvailable`). `null` until checked, then `true` when
 * either Firestore is wired up or the local-FS dev fallback is
 * active.
 */
const _prefsAvailable = ref<boolean | null>(null);
/**
 * Which backend the server-side prefs routes resolved to:
 *
 *   - `'firestore'` — deployed BC 2.0 tenant (Firestore Admin).
 *   - `'localfs'`   — `npm run dev` against aether-dev (no SA key);
 *                     writes land under `.aether-dev-prefs/`.
 *   - `'kv'`        — legacy BC 1.0 tenant (Upstash Redis).
 *   - `'none'`      — no backend configured; writes are dropped.
 */
const _prefsBackend = ref<'firestore' | 'localfs' | 'kv' | 'none' | null>(null);

let _prefsStore: PrefsStore | null = null;

/**
 * Pick the right `PrefsStore` for this tenant.
 *
 * BC 2.0 path (default for new tenants — ENG-520):
 *   `NUXT_PUBLIC_FIRESTORE_ENABLED === 'true'` → per-tenant Firestore
 *   via `/api/prefs/*`. In `npm run dev` the same routes transparently
 *   fall back to the local-filesystem helper, so `FirestorePrefsStore`
 *   on the client side covers both production and dev without forking
 *   the client implementation.
 *
 * BC 1.0 path (legacy, kept until the last KV-backed tenant retires):
 *   `KV_REST_API_URL` is set AND Firestore is not → Upstash KV via
 *   `/api/kv/*`. Convergence + any other live BC 1.0 tenants ride
 *   this path unchanged.
 *
 * Fallback:
 *   Neither configured → `FirestorePrefsStore` anyway, so writes
 *   hit the same `/api/prefs/*` shape. The server resolves to the
 *   local-FS fallback in dev (persistent) or returns `null` in a
 *   production build (writes silently dropped). `prefsAvailable`
 *   surfaces the actual backend so callers can warn users when
 *   prefs aren't durable.
 */
function getPrefsStore(): PrefsStore {
    if (_prefsStore) return _prefsStore;

    const config = useRuntimeConfig();
    const firestoreEnabled = config.public.firestoreEnabled === 'true';

    if (firestoreEnabled) {
        _prefsStore = new FirestorePrefsStore();
    } else if (process.env.KV_REST_API_URL) {
        // BC 1.0 fallback — kept for legacy tenants. Browser code
        // doesn't actually see `process.env.KV_REST_API_URL`; this
        // line acts on the SSR/Vercel-build snapshot of env vars. For
        // a runtime-precise check, hit `/api/kv/status` (already wired
        // below) and let `_prefsBackend` reflect the result.
        _prefsStore = new KVPrefsStore();
    } else {
        // No explicit backend — use `FirestorePrefsStore` and let the
        // `/api/prefs/*` routes transparently fall back to local-FS in
        // dev or `null` in production. See `_prefsAvailable` /
        // `_prefsBackend` above for how callers surface this state.
        _prefsStore = new FirestorePrefsStore();
    }
    return _prefsStore;
}

export async function initializePrefsStore() {
    await _initializePrefsStore();
}

async function saveUserInfo(
    userId: string,
    userName: string | undefined,
    userPicture: string | undefined
) {
    console.log(`Saving user info for ${userId}: ${userName} ${userPicture}`);

    await getPrefsStore().setValue<string>(
        `/userinfo/${userId}/`,
        'userName',
        userName ?? '[unknown]'
    );
    await getPrefsStore().setValue<string>(
        `/userinfo/${userId}/`,
        'userPicture',
        userPicture ?? ''
    );
}

async function _initializePrefsStore() {
    const { userId, userName, userPicture } = useUserState();
    const config = useRuntimeConfig();
    const appId = config.public.appId || 'aether-default';

    if (userId.value === undefined) {
        console.error(`ERROR: No user ID found; skipping prefs store initialization.`);
        return;
    }

    // Resolve which backend is live. Try Firestore/local-FS first
    // (`/api/prefs/status`); fall back to the legacy KV status when
    // the new endpoint isn't present (older tenant template / BC 1.0
    // build artefacts). `_prefsBackend` reflects what writes will
    // actually land on so callers can warn the user when prefs aren't
    // durable.
    try {
        const status = await $fetch<{
            available: boolean;
            backend: 'firestore' | 'localfs' | 'none';
        }>('/api/prefs/status');
        _prefsAvailable.value = status.available;
        _prefsBackend.value = status.backend;
        if (!status.available) {
            console.warn(
                '[Pref] Firestore is not configured and the local-FS dev fallback is disabled — ' +
                    'preferences will use defaults and will not persist across refreshes. ' +
                    'Verify NUXT_PUBLIC_FIRESTORE_ENABLED is true and NUXT_FIRESTORE_SA_KEY is set.'
            );
        } else if (status.backend === 'localfs') {
            console.info(
                '[Pref] Using local-FS fallback (.aether-dev-prefs/) — ' +
                    'preferences persist across refreshes for this dev session.'
            );
        }
    } catch {
        // No `/api/prefs/*` routes — probably a legacy BC 1.0 tenant
        // still on Upstash. Probe `/api/kv/status` so the existing
        // KVPrefsStore wiring still surfaces a useful "available"
        // signal.
        try {
            const kvStatus = await $fetch<{ available: boolean }>('/api/kv/status');
            _prefsAvailable.value = kvStatus.available;
            _prefsBackend.value = kvStatus.available ? 'kv' : 'none';
            if (!kvStatus.available) {
                console.warn(
                    '[Pref] No prefs backend configured (Firestore or KV) — ' +
                        'preferences will use defaults and will not persist across refreshes.'
                );
            }
        } catch {
            _prefsAvailable.value = false;
            _prefsBackend.value = 'none';
        }
    }

    // App-specific preferences path with namespace
    const appPrefsPrefix = `/users/${userId.value}/apps/${appId}`;
    // Global preferences path for cross-app settings
    const globalPrefsPrefix = `/users/${userId.value}/global`;

    _prefsStore = getPrefsStore();

    await saveUserInfo(userId.value, userName.value, userPicture.value);
}

export function usePrefsStore() {
    async function deleteCollection(path: string) {
        await getPrefsStore().deleteCollection(path);
    }

    async function listCollections(path: string) {
        const list = await getPrefsStore().listCollections(path);
        return list;
    }

    async function listDocuments(collectionPath: string) {
        const list = await getPrefsStore().listDocuments(collectionPath);
        return list;
    }

    async function readDoc(path: string) {
        const doc = await getPrefsStore().readDoc(path);
        return doc;
    }

    return {
        userSettings,
        /**
         * Whether prefs storage is configured and available — true
         * once Firestore (or the local-FS dev fallback, or legacy KV)
         * has confirmed it can accept writes. `null` until the first
         * status probe completes.
         */
        prefsAvailable: computed(() => _prefsAvailable.value),
        /**
         * Which backend the server-side routes resolved to —
         * `'firestore'` | `'localfs'` | `'kv'` | `'none'` (or `null`
         * before the first status probe). Useful for surfacing
         * "your prefs persist locally only" hints in dev.
         */
        prefsBackend: computed(() => _prefsBackend.value),
        /**
         * @deprecated Use `prefsAvailable` instead. Retained so legacy
         * callers that probed `usePrefsStore().kvAvailable` still get
         * a truthy signal once Firestore is the live backend.
         */
        kvAvailable: computed(() => _prefsAvailable.value),
        deleteCollection,
        listCollections,
        listDocuments,
        readDoc,
    };
}
