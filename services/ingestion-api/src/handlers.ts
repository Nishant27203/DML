import { FastifyRequest, FastifyReply } from 'fastify';
import { ingestLogsRequestSchema, LogEntry } from './schemas';

export async function ingestLogsHandler(
  request: FastifyRequest<{ Body: { logs: LogEntry[] } }>,
  reply: FastifyReply
) {
  try {
    // Validate request body
    const validated = ingestLogsRequestSchema.parse(request.body);
    
    // Get queue from request context
    const queue = (request.server as any).messageQueue;
    
    if (!queue) {
      throw new Error('Message queue not initialized');
    }

    // Publish logs to Redis Streams
    await queue.publish(validated.logs);

    const queueLength = await queue.getQueueLength();

    reply.status(202).send({
      success: true,
      message: `Received ${validated.logs.length} logs`,
      queueLength,
    });
  } catch (error: any) {
    request.log.error(error, 'Error ingesting logs');
    
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    reply.status(500).send({
      success: false,
      error: 'Internal server error',
    });
  }
}
