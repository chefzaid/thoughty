import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import type { HelmetOptions } from 'helmet';

const NONCED_TAG_PATTERN = /<(script|style)(?![^>]*\snonce=)/gi;

function getResponseNonce(res: ServerResponse): string {
  return ((res as Response).locals.cspNonce as string | undefined) ?? '';
}

function nonceDirective(_req: IncomingMessage, res: ServerResponse): string {
  return `'nonce-${getResponseNonce(res)}'`;
}

export function injectNonceIntoHtml(html: string, nonce: string): string {
  if (!nonce) {
    return html;
  }

  return html.replace(NONCED_TAG_PATTERN, `<$1 nonce="${nonce}"`);
}

export function attachCspNonce(_req: Request, res: Response, next: NextFunction): void {
  res.locals.cspNonce = randomBytes(16).toString('base64');

  const send = res.send.bind(res);
  res.send = ((body?: unknown) => {
    const contentType = res.getHeader('content-type');
    const shouldPatchHtml =
      typeof body === 'string' &&
      typeof contentType === 'string' &&
      contentType.includes('text/html');

    return send(shouldPatchHtml ? injectNonceIntoHtml(body, res.locals.cspNonce) : body);
  }) as Response['send'];

  next();
}

export function buildHelmetOptions(isProduction: boolean): HelmetOptions {
  return {
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", nonceDirective],
            styleSrc: ["'self'", nonceDirective],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  };
}
