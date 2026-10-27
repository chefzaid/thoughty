import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

interface StoredObject {
  body: Buffer;
  contentType: string;
}

/**
 * Just enough of the S3 API, over HTTP on a local port, for the real `@aws-sdk/client-s3` the
 * attachment service uses: path-style bucket create and head, and object put, get and delete. The
 * contract specs point `S3_ENDPOINT` at it, so every attachment route runs its real storage code.
 */
export class FakeObjectStorage {
  readonly objects = new Map<string, StoredObject>();
  private readonly buckets = new Set<string>();
  private server: Server | null = null;

  /** Starts listening on a free port and returns the endpoint to put in `S3_ENDPOINT`. */
  async start(): Promise<string> {
    const server = createServer((request, response) => {
      void this.handle(request, response);
    });
    this.server = server;
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  hasBucket(bucket: string): boolean {
    return this.buckets.has(bucket);
  }

  /** The keys stored in `bucket`, without the bucket name. */
  keys(bucket: string): string[] {
    const prefix = `${bucket}/`;
    return [...this.objects.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length));
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = await readBody(request);
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://storage').pathname).slice(
      1,
    );
    const [bucket = '', ...rest] = path.split('/');
    const key = rest.join('/');

    if (!key) {
      this.handleBucket(request.method ?? 'GET', bucket, response);
      return;
    }
    if (!this.buckets.has(bucket)) {
      sendError(response, 404, 'NoSuchBucket');
      return;
    }
    this.handleObject(request, `${bucket}/${key}`, decodeAwsChunked(request, body), response);
  }

  private handleBucket(method: string, bucket: string, response: ServerResponse): void {
    if (method === 'PUT') {
      this.buckets.add(bucket);
      response.writeHead(200).end();
      return;
    }
    if (method === 'HEAD' && this.buckets.has(bucket)) {
      response.writeHead(200).end();
      return;
    }
    sendError(response, 404, 'NoSuchBucket');
  }

  private handleObject(
    request: IncomingMessage,
    key: string,
    body: Buffer,
    response: ServerResponse,
  ): void {
    switch (request.method) {
      case 'PUT':
        this.objects.set(key, {
          body,
          contentType: request.headers['content-type'] ?? 'application/octet-stream',
        });
        response.writeHead(200, { ETag: `"${body.length}"` }).end();
        return;
      case 'GET': {
        const stored = this.objects.get(key);
        if (!stored) {
          sendError(response, 404, 'NoSuchKey');
          return;
        }
        response
          .writeHead(200, {
            'Content-Type': stored.contentType,
            'Content-Length': stored.body.length,
          })
          .end(stored.body);
        return;
      }
      case 'DELETE':
        this.objects.delete(key);
        response.writeHead(204).end();
        return;
      default:
        sendError(response, 405, 'MethodNotAllowed');
    }
  }
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

/** The payload of an `aws-chunked` body (`<hex size>[;ext]\r\n<data>\r\n` ... `0\r\n<trailers>`). */
function decodeAwsChunked(request: IncomingMessage, body: Buffer): Buffer {
  if (!String(request.headers['content-encoding'] ?? '').includes('aws-chunked')) return body;
  const parts: Buffer[] = [];
  let offset = 0;
  for (;;) {
    const lineEnd = body.indexOf('\r\n', offset);
    const size = Number.parseInt(body.subarray(offset, lineEnd).toString().split(';')[0] ?? '', 16);
    if (!size) return Buffer.concat(parts);
    parts.push(body.subarray(lineEnd + 2, lineEnd + 2 + size));
    offset = lineEnd + 2 + size + 2;
  }
}

function sendError(response: ServerResponse, status: number, code: string): void {
  response
    .writeHead(status, { 'Content-Type': 'application/xml' })
    .end(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code></Error>`);
}
