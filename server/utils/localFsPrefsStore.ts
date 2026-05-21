import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Filesystem-backed fallback prefs store for `npm run dev` (ENG-520).
 *
 * Persists JSON files under `.aether-dev-prefs/` at the project root.
 * Each prefs document path
 * (e.g. `users/alice/apps/myapp/settings/general`) maps to a single
 * file (`.aether-dev-prefs/users/alice/apps/myapp/settings/general.json`).
 *
 * Why this exists
 * ---------------
 * BC 2.0 tenants on Vercel get a per-tenant Firestore (`getFirestoreDb`
 * in `firestore.ts`). The `/api/prefs/*` routes call this helper when
 * Firestore is not configured AND we're not running in a deployed
 * production build — that covers the `npm run dev` flow inside
 * aether-dev so prefs persist across page refreshes without needing
 * a real Firestore credential. The old "works with defaults but
 * doesn't persist locally" KV experience is replaced.
 *
 * Why this file lives under `server/utils/`
 * -----------------------------------------
 * The ENG-520 plan called for `utils/localFsPrefsStore.ts`, but
 * `utils/` in the Aether template is the auto-imported client bucket.
 * Filesystem access only works server-side, so this lives next to
 * `server/utils/firestore.ts`. The `/api/prefs/*` routes import it
 * directly.
 *
 * Safety
 * ------
 * - Never writes outside `.aether-dev-prefs/` (paths normalized at
 *   the call site by `firestore.ts:normalizePrefsPath`, and re-clamped
 *   here via `resolve()` vs the root dir).
 * - Returns `null`/`{}`/`[]` rather than throwing on missing files so
 *   the routes behave the same shape as the Firestore implementation.
 */

const ROOT_DIR = resolve(process.cwd(), '.aether-dev-prefs');

function safeJoin(path: string): string | null {
    const joined = resolve(ROOT_DIR, path);
    // Defence in depth: refuse anything that resolves outside ROOT_DIR.
    if (joined !== ROOT_DIR && !joined.startsWith(ROOT_DIR + '/')) {
        return null;
    }
    return joined;
}

function fileFor(docPath: string): string | null {
    const safe = safeJoin(`${docPath}.json`);
    return safe;
}

function dirFor(collectionPath: string): string | null {
    return safeJoin(collectionPath);
}

function readJson(file: string): Record<string, unknown> | null {
    if (!existsSync(file)) return null;
    try {
        return JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function writeJson(file: string, data: Record<string, unknown>): void {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2));
}

/** Read a single field; returns `null` when the doc or field is missing. */
export function localFsReadField(docPath: string, fieldName: string): unknown | null {
    const file = fileFor(docPath);
    if (!file) return null;
    const data = readJson(file);
    if (!data) return null;
    return data[fieldName] ?? null;
}

/** Read the full document; returns `null` when missing. */
export function localFsReadDoc(docPath: string): Record<string, unknown> | null {
    const file = fileFor(docPath);
    if (!file) return null;
    return readJson(file);
}

/** Set a single field, merging with anything already on disk. */
export function localFsWriteField(docPath: string, fieldName: string, value: unknown): void {
    const file = fileFor(docPath);
    if (!file) return;
    const data = readJson(file) || {};
    data[fieldName] = value ?? null;
    writeJson(file, data);
}

/** Delete a single document. No-op when the file doesn't exist. */
export function localFsDeleteDoc(docPath: string): void {
    const file = fileFor(docPath);
    if (!file || !existsSync(file)) return;
    rmSync(file, { force: true });
}

/**
 * List documents (JSON files) in a collection — strips the `.json`
 * suffix to match the Firestore Admin SDK's `listDocuments()` shape
 * (ID-only, no extension). Returns `[]` when the collection is empty
 * or missing.
 */
export function localFsListDocuments(collectionPath: string): string[] {
    const dir = dirFor(collectionPath);
    if (!dir || !existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.json'))
        .map((e) => e.name.slice(0, -'.json'.length));
}

/**
 * List subcollections under a document — every direct child directory
 * that isn't the doc's own JSON file counts as a subcollection name,
 * matching the Firestore Admin SDK's `listCollections()` semantics.
 */
export function localFsListCollections(docPath: string): string[] {
    const dir = dirFor(docPath);
    if (!dir || !existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
}
