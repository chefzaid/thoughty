import { Injectable, LoggerService } from '@nestjs/common';

type JsonLogLevel = 'debug' | 'error' | 'info' | 'verbose' | 'warn';
type LogMetadata = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN = /token|password|secret|authorization|api[_-]?key|cookie/i;
const SENSITIVE_QUERY_PATTERN = /([?&](?:token|resetToken|verificationToken|access_token|refresh_token|code)=)[^&\s]+/gi;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const KEY_VALUE_SECRET_PATTERN =
  /\b(token|password|secret|authorization|api[_-]?key|cookie)=["']?[^"',\s}]+["']?/gi;

function redactString(value: string): string {
  return value
    .replace(SENSITIVE_QUERY_PATTERN, '$1[REDACTED]')
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(KEY_VALUE_SECRET_PATTERN, '$1=[REDACTED]');
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return depth >= 2 ? '[Array]' : value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    if (depth >= 2) {
      return '[Object]';
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitizeValue(entryValue, depth + 1),
      ]),
    );
  }

  return value;
}

function splitParams(params: unknown[]): { context?: string; metadata?: LogMetadata; trace?: string } {
  const remaining = [...params];
  const context = typeof remaining[remaining.length - 1] === 'string' ? (remaining.pop() as string) : undefined;
  const trace = typeof remaining[0] === 'string' && remaining[0].includes('\n') ? (remaining.shift() as string) : undefined;

  if (remaining.length === 0) {
    return { context, trace };
  }

  if (
    remaining.length === 1 &&
    remaining[0] &&
    typeof remaining[0] === 'object' &&
    !Array.isArray(remaining[0]) &&
    !(remaining[0] instanceof Error)
  ) {
    return { context, trace, metadata: remaining[0] as LogMetadata };
  }

  return {
    context,
    trace,
    metadata: remaining.length === 1 ? { detail: remaining[0] } : { details: remaining },
  };
}

@Injectable()
export class JsonLogger implements LoggerService {
  constructor(private readonly defaultContext?: string) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    const { context, metadata } = splitParams(optionalParams);
    this.write('info', message, context, undefined, metadata);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const { context, metadata, trace } = splitParams(optionalParams);
    this.write('error', message, context, trace, metadata);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    const { context, metadata } = splitParams(optionalParams);
    this.write('warn', message, context, undefined, metadata);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    const { context, metadata } = splitParams(optionalParams);
    this.write('debug', message, context, undefined, metadata);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    const { context, metadata } = splitParams(optionalParams);
    this.write('verbose', message, context, undefined, metadata);
  }

  private write(
    level: JsonLogLevel,
    message: unknown,
    context?: string,
    trace?: string,
    metadata?: LogMetadata,
  ): void {
    const output = {
      timestamp: new Date().toISOString(),
      level,
      context: context ?? this.defaultContext,
      message: sanitizeValue(message),
      trace: trace ? redactString(trace) : undefined,
      ...((sanitizeValue(metadata) as LogMetadata | undefined) ?? {}),
    };

    const line = `${JSON.stringify(output)}\n`;
    const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
    stream.write(line);
  }
}
