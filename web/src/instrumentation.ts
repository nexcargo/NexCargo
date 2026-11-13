// NexCargo server bootstrap — I-3 §4A/§4D event consumer wiring.
// Next.js calls register() once per server process. Without this the EventBus has
// zero subscribers and every published canonical event is dropped.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { registerNotificationEventHandlers } = await import(
    '@/modules/mod-016-notifications/domain/services/notification-event-handler'
  );
  registerNotificationEventHandlers();
}