import { elementalApiClient } from '~/server/services/elementalApiClient';
import { elementalMcpClient } from '~/server/services/elementalMcpClient';

export default defineEventHandler(async () => {
    const [api, mcp, schema] = await Promise.all([
        elementalApiClient.pingQueryServer(),
        elementalMcpClient.pingMcp(),
        elementalApiClient.getSchemaSummary(),
    ]);
    return {
        api,
        mcp,
        schema,
        ok: api.ok && mcp.ok,
        checkedAt: new Date().toISOString(),
    };
});
