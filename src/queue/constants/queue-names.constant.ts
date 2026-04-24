export const QUEUE_NAMES = {
  HTTP_LOGS: 'http-logs',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
