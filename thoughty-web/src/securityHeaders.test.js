import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const SNIPPET_INCLUDE = 'include /etc/nginx/snippets/security-headers.conf;';

function cspDirectives() {
  const policy = /add_header Content-Security-Policy "([^"]+)" always;/.exec(read('nginx-security-headers.conf'))?.[1] ?? '';
  return Object.fromEntries(
    policy.split(';').map((part) => part.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...values]) => [name, values]),
  );
}

describe('web security headers', () => {
  it('keeps a strict Content Security Policy', () => {
    const csp = cspDirectives();

    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['script-src']).toEqual(["'self'"]);
    expect(csp['style-src']).toEqual(["'self'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['base-uri']).toEqual(["'self'"]);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(csp['form-action']).toEqual(["'self'"]);
    expect(csp['connect-src']).toEqual(["'self'"]);
  });

  it('sends the headers from every NGINX block that sets its own headers', () => {
    const config = read('nginx.conf');
    // A block with its own add_header does not inherit the server-level ones.
    const blocks = config.split(/\n\s*location /).slice(1);

    expect(config).toContain(SNIPPET_INCLUDE);
    for (const block of blocks.filter((body) => body.includes('add_header'))) {
      expect(block).toContain(SNIPPET_INCLUDE);
    }
    for (const dockerfile of ['Dockerfile', 'Dockerfile.runtime']) {
      expect(read(dockerfile)).toContain('COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf');
    }
  });

  it('keeps a private share link out of the access log, referrers and search engines', () => {
    const config = read('nginx.conf');
    const snippet = read('nginx-security-headers.conf');

    expect(config).toMatch(/map \$request_uri \$thoughty_share_link \{[^}]*~\^\/s\/\s+1;[^}]*~\^\/api\/shared\/\s+1;/);
    expect(config).toMatch(/map \$thoughty_share_link \$referrer_policy \{\s*1\s+"no-referrer";\s*default\s+"strict-origin-when-cross-origin";/);
    expect(config).toMatch(/map \$thoughty_share_link \$robots_tag \{\s*1\s+"noindex, nofollow, noarchive";\s*default\s+"";/);
    expect(config).toContain('access_log /var/log/nginx/access.log main if=$thoughty_access_log;');
    expect(snippet).toContain('add_header Referrer-Policy $referrer_policy always;');
    expect(snippet).toContain('add_header X-Robots-Tag $robots_tag always;');
  });

  it('has no inline scripts in the HTML entry point', () => {
    const scripts = read('index.html').match(/<script\b[^>]*>[\s\S]*?<\/script>/g) ?? [];

    for (const script of scripts) {
      expect(script).toMatch(/\ssrc="[^"]+"/);
      expect(script).toMatch(/>\s*<\/script>$/);
    }
  });
});
