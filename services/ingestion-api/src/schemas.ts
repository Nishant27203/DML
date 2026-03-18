import { z } from 'zod';

export const logEntrySchema = z.object({
  service_name: z.string().min(1).max(255),
  log_level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
  message: z.string().min(1).max(10000),
  timestamp: z.string().datetime(),
  hostname: z.string().min(1).max(255),
  metadata: z.record(z.any()).optional(),
});

export type LogEntry = z.infer<typeof logEntrySchema>;

export const ingestLogsRequestSchema = z.object({
  logs: z.array(logEntrySchema).min(1).max(1000),
});

export type IngestLogsRequest = z.infer<typeof ingestLogsRequestSchema>;
