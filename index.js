async function setupPlugin({ config, global }) {
    global.eventsToTrack = new Set(config.events.split(','))
}

async function processEvent(event, { global, storage }) {
    const THIRTY_MINUTES = 1000 * 60 * 30

    const userSeenInLastHalfHour = await cache.get(`user_seen_${event.distinct_id}`)
    const isFirstEventInSession = !!userSeenInLastHalfHour

    if (!userSeenInLastHalfHour) {
        await cache.set(`user_seen_${event.distinct_id}`, 1)
    }

    await cache.expire(`user_seen_${event.distinct_id}`, THIRTY_MINUTES)


    if (event.timestamp && isFirstEventInSession) {
        posthog.capture(
            'session_started',
            {
                distinct_id: event.distinct_id,
                time_since_last_seen: timeSinceLastSeen,
                timestamp: event.timestamp, // backdate to when session _actually_ started
                trigger_event: event.event
            }
        )
    }


    event.properties['is_first_event_in_session'] = isFirstEventInSession

    if (global.eventsToTrack.has(event.event)) {
        if (!event.properties) {
            event.properties = {}
        }
        const eventSeenBefore = await storage.get(event.event)
        const eventSeenBeforeForUser = await storage.get(`${event.event}_${event.distinct_id}`)
        event.properties['is_first_event_ever'] = !eventSeenBefore
        event.properties['is_first_event_for_user'] = !eventSeenBeforeForUser

        if (!eventSeenBeforeForUser) {
            storage.set(`${event.event}_${event.distinct_id}`, true)
            if (!eventSeenBefore) {
                storage.set(event.event, true)
            }
        }


    }

    return event
}

module.exports = {
    setupPlugin,
    processEvent,
}