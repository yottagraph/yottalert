/**
 * Thin wrapper around `$fetch` that parses Elemental JSON responses with a
 * bigint-safe parser. Use this for every server-side call into the Elemental
 * Query Server / portal gateway. See `utils/elementalJsonSafe.ts` for the
 * motivation (int64 PID precision loss).
 */

import { parseElementalJson } from '~/utils/elementalJsonSafe';

type FetchOptions = NonNullable<Parameters<typeof $fetch>[1]>;

export function elementalFetch<T = unknown>(
    request: string,
    options: FetchOptions = {}
): Promise<T> {
    return $fetch<T>(request, {
        ...options,
        parseResponse: parseElementalJson,
    });
}
