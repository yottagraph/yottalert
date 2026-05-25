import type { H3Event, EventHandlerRequest } from 'h3';
import { unsealCookie } from './cookies';

export async function getYottalertUserId(
    event: H3Event<EventHandlerRequest>,
    explicitUserId?: string
): Promise<string> {
    const explicit = explicitUserId?.trim();
    if (explicit) return explicit;

    const cookieInfo = await unsealCookie(event);
    const sub = cookieInfo?.user?.sub;
    if (typeof sub === 'string' && sub.trim()) return sub;

    const config = useRuntimeConfig(event);
    return String(config.public.userName || 'dev-user');
}
