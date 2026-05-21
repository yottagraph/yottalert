/**
 * Yottalert's stable MCP function surface (PRD §5.2).
 *
 * The actual Lovelace MCP tool names may change; this wrapper exposes
 * Yottalert-named functions so the rest of the codebase doesn't need
 * to track upstream renames. When the MCP server is unreachable from
 * a Nitro process (no local stdio + no proxy gateway endpoint yet)
 * we degrade to the REST gateway via `elementalApiClient.ts`.
 *
 * This file intentionally only declares the surface — it does not
 * spawn a child MCP process. In production the tenant MCP container
 * is reached via the portal gateway (Cloud Run); locally the gateway
 * proxy is also used so credentials never live in the browser.
 */

import { elementalApiClient } from './elementalApiClient';

interface ToolStatus {
    name: string;
    available: boolean;
}

const STABLE_TOOL_SURFACE: ToolStatus[] = [
    { name: 'searchEntities', available: true },
    { name: 'getEntity', available: true },
    { name: 'searchEvents', available: true },
    { name: 'getEvent', available: false },
    { name: 'getRelationships', available: false },
    { name: 'getRelatedEntities', available: false },
    { name: 'getEventsForEntity', available: true },
    { name: 'getEventsForGeography', available: false },
    { name: 'getEntitiesForGeography', available: true },
    { name: 'getSourcesForObject', available: false },
    { name: 'getProvenanceForObject', available: false },
    { name: 'getGraphNeighborhood', available: false },
    { name: 'resolveUserWatchQuery', available: true },
];

export async function pingMcp(): Promise<{ ok: boolean; toolCount: number; error?: string }> {
    const apiHealth = await elementalApiClient.pingQueryServer();
    if (!apiHealth.ok) {
        return { ok: false, toolCount: 0, error: apiHealth.error };
    }
    const toolCount = STABLE_TOOL_SURFACE.filter((t) => t.available).length;
    return { ok: true, toolCount };
}

export async function searchEntities(query: string, _filters?: Record<string, unknown>) {
    return elementalApiClient.searchEntitiesByName(query, { maxResults: 10 });
}

export async function getEntity(entityId: string) {
    const name = await elementalApiClient.getEntityNameByNeid(entityId);
    if (!name) return null;
    return { neid: entityId, name };
}

export async function getEntitiesForGeography(geography: string) {
    return elementalApiClient.searchEntitiesByName(geography, { maxResults: 6 });
}

export async function getEventsForEntity(entityId: string) {
    const changes = await elementalApiClient.fetchRecentChanges([entityId], 5);
    return changes;
}

export const elementalMcpClient = {
    pingMcp,
    searchEntities,
    getEntity,
    getEntitiesForGeography,
    getEventsForEntity,
    toolSurface: () => STABLE_TOOL_SURFACE,
};

export type ElementalMcpClient = typeof elementalMcpClient;
