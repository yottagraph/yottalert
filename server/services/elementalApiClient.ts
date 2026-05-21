/**
 * Server-side typed Elemental REST client. All Elemental REST calls
 * originate here so the browser never touches the gateway directly
 * (Yottalert PRD §5.1 + §11).
 *
 * Authentication uses the portal gateway proxy + tenant `qs_api_key`
 * from runtime config — no Auth0 token plumbing needed.
 */

import { useRuntimeConfig } from '#imports';

interface SearchHit {
    neid: string;
    name: string;
    score?: number;
    flavor?: string;
}

interface EntityProperties {
    neid: string;
    name: string;
    properties: Record<string, unknown>;
}

interface RecentChange {
    id: string;
    type: 'entity' | 'event' | 'relationship';
    neid?: string;
    summary: string;
    occurredAt?: string;
}

function gatewayBase(): { url: string; org: string; key: string } {
    const config = useRuntimeConfig();
    const pub = config.public as Record<string, string>;
    return {
        url: pub.gatewayUrl || '',
        org: pub.tenantOrgId || '',
        key: pub.qsApiKey || '',
    };
}

function buildUrl(path: string): string {
    const { url, org } = gatewayBase();
    if (!url || !org) return '';
    return `${url}/api/qs/${org}/${path.replace(/^\//, '')}`;
}

function headers(extra?: Record<string, string>): Record<string, string> {
    const { key } = gatewayBase();
    return { 'X-Api-Key': key, 'Content-Type': 'application/json', ...extra };
}

export function isConfigured(): boolean {
    const { url, org, key } = gatewayBase();
    return Boolean(url && org && key);
}

export async function pingQueryServer(): Promise<{
    ok: boolean;
    latencyMs?: number;
    apiVersion?: string;
    error?: string;
}> {
    if (!isConfigured()) return { ok: false, error: 'Gateway not configured' };
    const t0 = Date.now();
    try {
        const url = buildUrl('elemental/metadata/schema');
        const res = await $fetch<{ schema?: { flavors?: unknown[] } }>(url, {
            headers: headers(),
            timeout: 5000,
        });
        const latencyMs = Date.now() - t0;
        return {
            ok: Boolean(res?.schema?.flavors),
            latencyMs,
            apiVersion: 'qs-v1',
        };
    } catch (err) {
        return { ok: false, latencyMs: Date.now() - t0, error: errorMessage(err) };
    }
}

export async function searchEntitiesByName(
    query: string,
    options?: { maxResults?: number; flavors?: string[] }
): Promise<SearchHit[]> {
    if (!isConfigured() || !query.trim()) return [];
    try {
        const res = await $fetch<{ results?: Array<{ matches?: SearchHit[] }> }>(
            buildUrl('entities/search'),
            {
                method: 'POST',
                headers: headers(),
                body: {
                    queries: [
                        {
                            queryId: 1,
                            query: query.trim(),
                            ...(options?.flavors ? { flavors: options.flavors } : {}),
                        },
                    ],
                    maxResults: options?.maxResults ?? 8,
                    includeNames: true,
                },
                timeout: 8000,
            }
        );
        return res?.results?.[0]?.matches ?? [];
    } catch (err) {
        console.warn('[elementalApiClient] searchEntitiesByName failed', errorMessage(err));
        return [];
    }
}

export async function getEntityNameByNeid(neid: string): Promise<string | null> {
    if (!isConfigured() || !neid) return null;
    try {
        const res = await $fetch<{ name?: string }>(buildUrl(`entities/${neid}/name`), {
            headers: headers(),
            timeout: 5000,
        });
        return res?.name ?? null;
    } catch {
        return null;
    }
}

export async function fetchRecentChanges(neids: string[], limit = 5): Promise<RecentChange[]> {
    // The Query Server doesn't expose a true "recent changes" stream; the
    // best deterministic proxy we have is the per-entity event endpoint.
    // We aggregate per-entity events and present them as change events.
    if (!isConfigured() || !neids.length) return [];

    const out: RecentChange[] = [];
    for (const neid of neids.slice(0, 8)) {
        try {
            const res = await $fetch<{
                events?: Array<{ id?: string; title?: string; date?: string }>;
            }>(buildUrl(`entities/${neid}/events`), {
                headers: headers(),
                timeout: 5000,
            });
            for (const evt of (res?.events ?? []).slice(0, limit)) {
                out.push({
                    id: evt.id || `${neid}-${evt.title}`,
                    type: 'event',
                    neid,
                    summary: evt.title || 'Untitled event',
                    occurredAt: evt.date,
                });
            }
        } catch {
            // No events endpoint or no data — skip silently.
        }
    }
    return out;
}

export async function getSchemaSummary(): Promise<{
    flavorCount: number;
    propertyCount: number;
}> {
    if (!isConfigured()) return { flavorCount: 0, propertyCount: 0 };
    try {
        const res = await $fetch<{
            schema?: { flavors?: unknown[]; properties?: unknown[] };
        }>(buildUrl('elemental/metadata/schema'), {
            headers: headers(),
            timeout: 5000,
        });
        return {
            flavorCount: res?.schema?.flavors?.length ?? 0,
            propertyCount: res?.schema?.properties?.length ?? 0,
        };
    } catch {
        return { flavorCount: 0, propertyCount: 0 };
    }
}

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
}

export const elementalApiClient = {
    isConfigured,
    pingQueryServer,
    searchEntitiesByName,
    getEntityNameByNeid,
    fetchRecentChanges,
    getSchemaSummary,
};

export type ElementalApiClient = typeof elementalApiClient;
