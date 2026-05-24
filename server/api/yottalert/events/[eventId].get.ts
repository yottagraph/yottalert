import { defineEventHandler, getRouterParam } from 'h3';

import { elementalEventsClient } from '~/server/services/elementalEventsClient';

export default defineEventHandler(async (event) => {
    const eventId = getRouterParam(event, 'eventId');
    if (!eventId) throw createError({ statusCode: 400, statusMessage: 'eventId required' });

    const raw = await elementalEventsClient.enrichEvent(eventId);
    const eventRecord = raw ? elementalEventsClient.toAlertEventRef(raw) : null;
    return { event: eventRecord };
});
