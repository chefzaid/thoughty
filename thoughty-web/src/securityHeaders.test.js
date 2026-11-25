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
    // WebAssembly for the speech-recognition worker, and no eval() of JavaScript
    expect(csp['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(csp['script-src']).not.toContain("'unsafe-eval'");
    expect(csp['style-src']).toEqual(["'self'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['base-uri']).toEqual(["'self'"]);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(csp['form-action']).toEqual(["'self'"]);
    // Besides the API, the writer's own model server: any https address, or plain http on this device's loopback
    // addresses only (no cleartext to the network)
    expect(csp['connect-src']).toEqual(["'self'", 'https:', 'http://localhost:*', 'http://127.0.0.1:*']);
    expect(csp['connect-src']).not.toContain('http:');
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

  it('keeps a private share link, the pages emailed links open and what is shared to the app out of the access log, referrers and search engines', () => {
    const config = read('nginx.conf');
    const snippet = read('nginx-security-headers.conf');

    expect(config).toMatch(/map \$request_uri \$thoughty_secret_link \{[^}]*~\^\/s\/\s+1;[^}]*~\^\/api\/shared\/\s+1;[^}]*~\^\/reset-password\s+1;[^}]*~\^\/complete-sign-up\s+1;[^}]*~\^\/verify-email\s+1;[^}]*~\^\/share-target\s+1;/);
    expect(config).toMatch(/map \$thoughty_secret_link \$referrer_policy \{\s*1\s+"no-referrer";\s*default\s+"strict-origin-when-cross-origin";/);
    expect(config).toMatch(/map \$thoughty_secret_link \$robots_tag \{\s*1\s+"noindex, nofollow, noarchive";\s*default\s+"";/);
    expect(config).toContain('access_log /var/log/nginx/access.log main if=$thoughty_access_log;');
    expect(snippet).toContain('add_header Referrer-Policy $referrer_policy always;');
    expect(snippet).toContain('add_header X-Robots-Tag $robots_tag always;');
  });

  it('turns a share posted where no service worker received it into a relative redirect, its body unread', () => {
    const block = /location = \/share-target \{([^}]*\{[^}]*\}[^}]*)\}/.exec(read('nginx.conf'))?.[1] ?? '';

    expect(block).toMatch(/if \(\$request_method = POST\) \{\s*return 303 \/share-target\?unreceived=1;\s*\}/);
    expect(block).toContain('absolute_redirect off;');
    expect(block).toContain('try_files $uri /index.html;');
  });

  it('fills the site address into the sitemap and robots.txt the build writes, from the address each request came to', async () => {
    const config = read('nginx.conf');
    const block = /location ~ \^\/\(sitemap\\\.xml\|robots\\\.txt\)\$ \{([^}]*)\}/.exec(config)?.[1] ?? '';
    const { SITE_ORIGIN_PLACEHOLDER } = await import('./utils/searchEngineFiles');

    expect(config).toMatch(/map \$http_x_forwarded_proto \$thoughty_site_scheme \{\s*https\s+https;\s*default\s+\$scheme;\s*\}/);
    expect(block).toContain(`sub_filter '${SITE_ORIGIN_PLACEHOLDER}' '$thoughty_site_scheme://$host';`);
    expect(block).toContain('sub_filter_once off;');
    expect(block).toContain('sub_filter_types text/xml text/plain;');
  });

  it('has no inline scripts in the HTML entry point', () => {
    const scripts = read('index.html').match(/<script\b[^>]*>[\s\S]*?<\/script>/g) ?? [];

    for (const script of scripts) {
      expect(script).toMatch(/\ssrc="[^"]+"/);
      expect(script).toMatch(/>\s*<\/script>$/);
    }
  });
});
