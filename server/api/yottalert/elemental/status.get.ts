import { elementalApiClient } from '~/server/services/elementalApiClient';
import { elementalMcpClient } from '~/server/services/elementalMcpClient';
import type { ElementalConnectionStatus } from '~/utils/yottalert/types';

export default defineEventHandler(async () => {
    const [api, mcp, galaxy, schema] = await Promise.all([
        elementalApiClient.pingQueryServer(),
        elementalMcpClient.pingMcp(),
        elementalApiClient.pingGalaxy(),
        elementalApiClient.getSchemaSummary(),
    ]);

    const status: ElementalConnectionStatus = {
        apiReachable: api.ok,
        mcpReachable: mcp.ok,
        galaxyReachable: galaxy.ok,
        lastCheckedAt: new Date().toISOString(),
        latencyMs: api.latencyMs,
        galaxyLatencyMs: galaxy.latencyMs,
        galaxyEntityCount: galaxy.numEntities,
        mcpToolCount: mcp.toolCount,
        apiVersion: api.apiVersion,
        lastError: api.error || mcp.error || galaxy.error,
    };

    return { status, schema };
});
