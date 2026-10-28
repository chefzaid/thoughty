import { PassThrough } from 'node:stream';
import { lastValueFrom, of } from 'rxjs';
import { NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { ShareLinksController } from './share-links.controller';
import { SharedContentController } from './shared-content.controller';
import { SHARED_RESPONSE_HEADERS, SharedResponseHeadersInterceptor } from './shared-response-headers.interceptor';

function fakeResponse() {
  const headers: Record<string, string> = {};
  const response = Object.assign(new PassThrough(), {
    headers,
    statusCode: 200,
    setHeader: jest.fn((name: string, value: string) => { headers[name] = value; }),
    status: jest.fn(function status(this: { statusCode: number }, code: number) { this.statusCode = code; return this; }),
    send: jest.fn(),
  });
  return response;
}

describe('ShareLinksController', () => {
  const service = { list: jest.fn(), create: jest.fn(), revoke: jest.fn() };
  const controller = new ShareLinksController(service as never);
  const user = { userId: 7, email: 'writer@example.com' };

  it('passes every call on for the signed-in writer', async () => {
    service.list.mockResolvedValue({ links: [], limit: 100, activeCount: 0 });
    service.create.mockResolvedValue({ id: 1, token: 't' });
    service.revoke.mockResolvedValue({ success: true });
    const dto = { kind: 'entry', targetId: 12, expiresAt: '2026-11-04T09:00:00.000Z' };

    await expect(controller.list(user as never, { kind: 'entry', targetId: 12 })).resolves.toEqual({ links: [], limit: 100, activeCount: 0 });
    expect(service.list).toHaveBeenCalledWith(7, 'entry', 12);
    await expect(controller.create(user as never, dto as never)).resolves.toEqual({ id: 1, token: 't' });
    expect(service.create).toHaveBeenCalledWith(7, dto);
    await expect(controller.revoke(user as never, 1)).resolves.toEqual({ success: true });
    expect(service.revoke).toHaveBeenCalledWith(7, 1);
  });
});

describe('SharedContentController', () => {
  const service = { open: jest.fn(), downloadBook: jest.fn(), attachmentFile: jest.fn() };
  const attachments = { openFile: jest.fn() };
  const controller = new SharedContentController(service as never, attachments as never);

  beforeEach(() => jest.clearAllMocks());

  it('reads the shared content by token', async () => {
    service.open.mockResolvedValue({ kind: 'entry' });
    await expect(controller.open('tok')).resolves.toEqual({ kind: 'entry' });
    expect(service.open).toHaveBeenCalledWith('tok');
  });

  it('sends a shared book as a sandboxed download, whatever its format', async () => {
    service.downloadBook.mockResolvedValue({ content: Buffer.from('<h1>x</h1>'), filename: 'my book.html', contentType: 'text/html' });
    const res = fakeResponse();

    await controller.downloadBook('tok', res as never);

    expect(res.headers['Content-Type']).toBe('text/html');
    expect(res.headers['Content-Disposition']).toMatch(/^attachment; filename="my book.html"/);
    expect(res.headers['Content-Security-Policy']).toBe("default-src 'none'; sandbox");
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.send).toHaveBeenCalledWith(Buffer.from('<h1>x</h1>'));
  });

  it('streams the entry’s file and its poster frame, and reads a file gone from storage as an unavailable link', async () => {
    const file = { key: 'k.jpg', contentType: 'image/jpeg', originalFilename: 'a.jpg', inline: true, size: 4 };
    service.attachmentFile.mockResolvedValue(file);
    const stream = new PassThrough();
    attachments.openFile.mockResolvedValue({ stream, contentLength: 4 });
    const res = fakeResponse();

    const sent = controller.attachment('tok', 31, 'bytes=0-1', res as never);
    await sent;
    expect(service.attachmentFile).toHaveBeenCalledWith('tok', 31, 'file');
    expect(attachments.openFile).toHaveBeenCalledWith('k.jpg', { start: 0, end: 1 });
    expect(res.statusCode).toBe(206);

    await controller.poster('tok', 32, fakeResponse() as never);
    expect(service.attachmentFile).toHaveBeenLastCalledWith('tok', 32, 'poster');

    attachments.openFile.mockRejectedValueOnce(new Error('gone'));
    await expectApiError(controller.poster('tok', 32, fakeResponse() as never), NotFoundException, 'SHARE_LINK_NOT_FOUND');
  });
});

describe('SharedResponseHeadersInterceptor', () => {
  it('marks every shared answer uncached, unindexed, without referrer and same-origin only', async () => {
    const res = fakeResponse();
    const context = { switchToHttp: () => ({ getResponse: () => res }) };

    await expect(lastValueFrom(new SharedResponseHeadersInterceptor().intercept(context as never, { handle: () => of('body') }))).resolves.toBe('body');
    expect(res.headers).toEqual(SHARED_RESPONSE_HEADERS);
    expect(SHARED_RESPONSE_HEADERS).toEqual(expect.objectContaining({ 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' }));
    expect(SHARED_RESPONSE_HEADERS['X-Robots-Tag']).toContain('noindex');
  });
});
