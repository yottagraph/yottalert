import { elementalApiClient } from '~/server/services/elementalApiClient';
import { elementalMcpClient } from '~/server/services/elementalMcpClient';

export default defineEventHandler(async () => {
    const [api, mcp, galaxy, schema] = await Promise.all([
        elementalApiClient.pingQueryServer(),
        elementalMcpClient.pingMcp(),
        elementalApiClient.pingGalaxy(),
        elementalApiClient.getSchemaSummary(),
    ]);
    return {
        api,
        mcp,
        galaxy,
        schema,
        ok: api.ok && mcp.ok,
        checkedAt: new Date().toISOString(),
    };
});
