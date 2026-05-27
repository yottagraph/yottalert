/**
 * Bigint-safe JSON parsing for Elemental responses.
 *
 * Elemental's schema and properties API return 64-bit integer IDs
 * (PIDs, FIDs, AIDs, NEIDs, EIDs) -- e.g. `7627506139678298689`. JavaScript's
 * `Number` only has 53-bit precision, so a naive `JSON.parse` silently rounds
 * them (e.g. → `7627506139678299000`). Any subsequent call that echoes a
 * rounded ID back to Elemental returns 0 matches, which is why properties
 * like `close_price`, OHLCV, RSI, P/E, etc. would silently go missing.
 *
 * We parse Elemental JSON with `json-bigint` configured with
 * `storeAsString: true`, which keeps any out-of-range integer as a string
 * while leaving small ints/strings/floats untouched. Callers then coerce IDs
 * to strings (`String(value)`) for safe interpolation into URLs and JSON
 * expressions.
 *
 * Usage in this repo:
 *   - Server: pass `parseResponse: parseElementalJson` to `$fetch`, or use
 *     the `elementalFetch` helper in `server/utils/elementalFetch.ts`.
 *   - Browser: pass JSON response text through `parseElementalJson` instead
 *     of calling `response.json()`.
 */

import JSONbig from 'json-bigint';

const parser = JSONbig({ storeAsString: true });

export function parseElementalJson<T = unknown>(text: string | null | undefined): T {
    if (text === null || text === undefined || text === '') {
        return undefined as unknown as T;
    }
    return parser.parse(text) as T;
}

/**
 * Normalize any Elemental ID (PID / FID / AID / NEID / EID) to a string.
 * Big ints arrive as strings already (`storeAsString: true`), but small
 * ints stay as plain JS numbers; this collapses both shapes.
 */
export function toIdString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text ? text : null;
}
