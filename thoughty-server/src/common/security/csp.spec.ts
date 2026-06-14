import type { NextFunction, Request, Response } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { attachCspNonce, buildHelmetOptions, injectNonceIntoHtml } from './csp';

describe('CSP helpers', () => {
  it('injects nonces into inline and external script/style tags', () => {
    const html = [
      '<style>body { margin: 0; }</style>',
      '<script src="/assets/app.js"></script>',
      '<script nonce="existing">window.ready = true</script>',
    ].join('\n');

    const result = injectNonceIntoHtml(html, 'abc123');

    expect(result).toContain('<style nonce="abc123">');
    expect(result).toContain('<script nonce="abc123" src="/assets/app.js">');
    expect(result).toContain('<script nonce="existing">window.ready = true</script>');
  });

  it('leaves HTML unchanged when no nonce is available', () => {
    const html = '<script>window.ready = true</script>';

    expect(injectNonceIntoHtml(html, '')).toBe(html);
  });

  it('adds a nonce to outgoing HTML responses', () => {
    const response = {
      locals: {},
      getHeader: jest.fn().mockReturnValue('text/html; charset=utf-8'),
      send: jest.fn((body) => body),
    } as unknown as Response;
    const next: NextFunction = jest.fn();

    attachCspNonce({} as Request, response, next);
    const result = response.send('<script src="/swagger-ui-init.js"></script>');

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.locals.cspNonce).toEqual(expect.any(String));
    expect(result).toContain(`<script nonce="${response.locals.cspNonce}" src="/swagger-ui-init.js">`);
  });

  it('does not rewrite non-HTML responses', () => {
    const response = {
      locals: {},
      getHeader: jest.fn().mockReturnValue('application/json'),
      send: jest.fn((body) => body),
    } as unknown as Response;

    attachCspNonce({} as Request, response, jest.fn());
    const json = '{"script":"<script>ignored</script>"}';

    expect(response.send(json)).toBe(json);
  });

  it('uses nonce directives in production without unsafe inline fallbacks', () => {
    const options = buildHelmetOptions(true);

    expect(JSON.stringify(options)).not.toContain('unsafe-inline');
    expect(options.contentSecurityPolicy).toMatchObject({
      directives: {
        defaultSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    });
  });

  it('resolves the CSP nonce directive from response locals', () => {
    const options = buildHelmetOptions(true);
    const directives = typeof options.contentSecurityPolicy === 'object'
      ? options.contentSecurityPolicy.directives
      : {};
    const scriptSrc = Array.from((directives?.scriptSrc ?? []) as Iterable<unknown>);
    const nonce = scriptSrc.find((value): value is Function => typeof value === 'function');

    expect(typeof nonce).toBe('function');
    expect(
      nonce?.(
        {} as IncomingMessage,
        { locals: { cspNonce: 'abc123' } } as unknown as ServerResponse,
      ),
    ).toBe("'nonce-abc123'");
  });

  it('disables CSP in non-production environments for local tooling', () => {
    expect(buildHelmetOptions(false).contentSecurityPolicy).toBe(false);
  });
});
