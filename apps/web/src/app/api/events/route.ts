import { getSession } from '../../lib/slack-auth';
import { getWebEventStream } from '../../lib/web-event-stream';
import { formatWebRecipientId } from '@mud/redis-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const encoder = new TextEncoder();

const buildEventMessage = (payload: unknown, eventName?: string) => {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  if (!eventName) {
    return data;
  }
  return `event: ${eventName}\n${data}`;
};

export const GET = async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!process.env.REDIS_URL) {
    return new Response('Event stream unavailable.', { status: 503 });
  }

  let stream: ReturnType<typeof getWebEventStream>;
  try {
    stream = getWebEventStream();
    await stream.start();
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : 'Event stream unavailable.',
      { status: 503 },
    );
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const recipientId = formatWebRecipientId(session.teamId, session.userId);
  console.info('[web-events] client connected', { recipientId });

  const send = async (payload: unknown, eventName?: string) => {
    await writer.write(encoder.encode(buildEventMessage(payload, eventName)));
  };

  const unsubscribe = stream.subscribe((notification) => {
    const recipient = notification.recipients.find(
      (entry) =>
        entry.clientType === 'web' &&
        typeof entry.userId === 'string' &&
        entry.userId === recipientId,
    );
    if (!recipient) {
      return;
    }

    console.info('[web-events] delivering event', {
      eventType: notification.event.eventType,
      recipientId,
    });
    void send({
      type: notification.type,
      event: notification.event,
      message: recipient.message,
      timestamp: notification.timestamp,
    });
  });

  const ping = setInterval(() => {
    void writer.write(encoder.encode(': ping\n\n'));
  }, 25000);

  const close = async () => {
    clearInterval(ping);
    unsubscribe();
    try {
      await writer.close();
    } catch {
      // Ignore close errors on aborted connections.
    }
    console.info('[web-events] client disconnected', { recipientId });
  };

  request.signal.addEventListener('abort', () => {
    void close();
  });

  await send({ ok: true }, 'ready');

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
};
