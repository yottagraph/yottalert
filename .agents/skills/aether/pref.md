# User Preferences

Preferences are persisted to a **per-tenant Firestore database** (BC 2.0
default, ENG-520). Tenant apps get a Firestore in their own GCP project,
provisioned by the Broadchurch portal alongside Auth0 / Vercel / Cloud SQL
during `create_project`. The Aether app talks to it via `usePrefsStore()`
from `~/composables/usePrefsStore.ts`, backed by `FirestorePrefsStore`
which calls `/api/prefs/*` server routes; the routes init `firebase-admin`
from `NUXT_FIRESTORE_SA_KEY`.

Legacy BC 1.0 tenants (provisioned before ENG-520) still use the Vercel
KV (Upstash Redis) flow. `usePrefsStore()` detects which backend is live
and exposes the result as `prefsBackend` so callers can warn the user
when prefs aren't durable.

## Two-Tier Namespacing

Preferences are scoped by the app ID set in `NUXT_PUBLIC_APP_ID`:

- **App-specific**: `/users/{userId}/apps/{appId}/settings/general`
- **Global (cross-app)**: `/users/{userId}/global/settings/general`

Paths alternate collection/document segments — Firestore Native mode
takes them verbatim. The leading `/` is a doc convention; the server
routes strip it before handing the path to `firebase-admin`.

## The Pref Class

`Pref<T>` is a reactive wrapper that auto-syncs to the prefs backend.
Defined in `usePrefsStore.ts`.

```typescript
const myPref = new Pref<string>(docPath, 'fieldName', 'defaultValue');
await myPref.initialize();

myPref.r.value; // reactive ref (use in templates)
myPref.v; // getter shorthand
myPref.set('new value'); // persists to Firestore
```

Values are JSON-serialized on write and JSON.parse-on-read so the stored
shape is identical between the Firestore and legacy KV backends. The
`Pref` attaches a watcher after `initialize()` so any change to `.r`
auto-persists.

## usePrefsStore()

```typescript
const { readDoc, listDocuments, listCollections, deleteCollection } = usePrefsStore();
```

The backing store auto-initializes on first use — no need to call
`initializePrefsStore()` manually. Unlike the old KV-backed
`listCollections`, the Firestore implementation actually returns
subcollection IDs (Firestore lets us enumerate them; Redis didn't).

`usePrefsStore().prefsBackend` exposes which backend is live:

| Value         | Meaning                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| `'firestore'` | Deployed BC 2.0 tenant — writes persist to per-tenant Firestore.         |
| `'localfs'`   | `npm run dev` in aether-dev — writes persist under `.aether-dev-prefs/`. |
| `'kv'`        | Legacy BC 1.0 tenant — writes persist to Upstash Redis.                  |
| `'none'`      | No backend configured — writes are dropped.                              |

The legacy `kvAvailable` alias is still exposed for back-compat and
returns the same boolean as `prefsAvailable`.

## Local Development

`npm run dev` against aether-dev with no Firestore credentials uses a
**local-FS fallback**: writes land as JSON files under
`.aether-dev-prefs/` at the project root. Prefs persist across page
refreshes during the dev session without any cloud setup.

The fallback is locked to non-production builds via a NODE_ENV check in
`server/utils/firestore.ts:shouldUseLocalFsFallback` — a Vercel build
that's missing the SA key will NOT silently fall back to a filesystem
that doesn't exist there. It'll return `null` / `[]` on every prefs
call and the client will surface that via `prefsAvailable === false`.

`.aether-dev-prefs/` is gitignored. Delete it to reset prefs for the
current dev session.

**Auth dependency:** All `/api/prefs/*` routes call `unsealCookie(event)`
to identify the user. In dev mode (no `NUXT_PUBLIC_AUTH0_CLIENT_SECRET`
set), this is bypassed automatically using `NUXT_PUBLIC_USER_NAME`.

## Direct API Alternative

If you prefer not to use the `Pref<T>` class, you can call the routes
directly from client-side code:

```typescript
// Read
const value = await $fetch('/api/prefs/read', {
    params: { docPath: '/users/abc/settings', fieldName: 'theme' },
});

// Write
await $fetch('/api/prefs/write', {
    method: 'POST',
    body: { docPath: '/users/abc/settings', fieldName: 'theme', value: '"dark"' },
});
```

These routes require the browser's auth cookie — they work from
client-side `$fetch` calls but not from server routes or external
scripts. For server-to-server prefs access from inside the Aether app,
import `getFirestoreDb()` from `server/utils/firestore.ts` directly.

## Feature-Scoped Preferences

Features should namespace preferences under the app's prefix:

```typescript
function useMyFeaturePrefs() {
    const { appId } = useRuntimeConfig().public;
    const { userId } = useUserState();
    const path = `/users/${userId.value}/apps/${appId}/features/my-feature`;

    const myPref = new Pref<boolean>(path, 'enabled', true);
    return { myPref };
}
```

## Prefs Architecture

- **Server credential**: `server/utils/firestore.ts` reads
  `NUXT_FIRESTORE_SA_KEY` (base64-encoded JSON SA key, injected by the
  portal at provision time) and inits `firebase-admin` against the
  per-tenant project + database.
- **API routes**: `server/api/prefs/` (read, write, delete, documents,
  collections, status). Each route prefers Firestore and transparently
  falls back to the local-FS helper in dev.
- **Server fallback**: `server/utils/localFsPrefsStore.ts` reads/writes
  JSON files under `.aether-dev-prefs/`. Production builds never use it.
- **Client store**: `utils/firestorePrefsStore.ts` implements
  `PrefsStore` by calling the `/api/prefs/*` routes. The legacy
  `utils/kvPrefsStore.ts` is retained for BC 1.0 tenants.
- **Backend selection**: `usePrefsStore.ts:getPrefsStore()` picks the
  right client class based on which env vars are set. New tenants
  always land on `FirestorePrefsStore`.

## Scope Guidance

| App-specific                 | Global                  |
| ---------------------------- | ----------------------- |
| Layout prefs, favorites      | Language                |
| Watchlists, feature settings | Accessibility           |
| Feature-specific settings    | Timezone, notifications |
