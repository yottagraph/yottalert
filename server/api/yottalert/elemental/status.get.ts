import { elementalApiClient } from '~/server/services/elementalApiClient';
import { elementalMcpClient } from '~/server/services/elementalMcpClient';
import type { ElementalConnectionStatus } from '~/utils/yottalert/types';

export default defineEventHandler(async () => {
    const [api, mcp, schema] = await Promise.all([
        elementalApiClient.pingQueryServer(),
        elementalMcpClient.pingMcp(),
        elementalApiClient.getSchemaSummary(),
    ]);

    const status: ElementalConnectionStatus = {
        apiReachable: api.ok,
        mcpReachable: mcp.ok,
        lastCheckedAt: new Date().toISOString(),
        latencyMs: api.latencyMs,
        mcpToolCount: mcp.toolCount,
        apiVersion: api.apiVersion,
        lastError: api.error || mcp.error,
    };

    return { status, schema };
});
