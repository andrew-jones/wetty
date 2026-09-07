import 'mocha';
import { expect } from 'chai';
import express from 'express';
import { policies } from './security.js';
import type { Server } from 'node:http';

async function startServer(
  allowIframe: boolean,
): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(policies(allowIframe));
  app.get('/', (_req, res) => {
    res.send('ok');
  });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => {
      resolve(s);
    });
  });
  const { port } = server.address() as { port: number };
  return { server, baseUrl: `http://127.0.0.1:${String(port)}` };
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

describe('policies', () => {
  describe('with iframe embedding disallowed (default)', () => {
    let server: Server;
    let baseUrl: string;

    beforeEach(async () => {
      ({ server, baseUrl } = await startServer(false));
    });

    afterEach(async () => {
      await stopServer(server);
    });

    it('should not tell browsers to upgrade insecure requests', async () => {
      // WeTTY is commonly deployed on plain HTTP behind a TLS-terminating
      // reverse proxy. If the CSP response includes `upgrade-insecure-requests`,
      // browsers silently rewrite WeTTY's own same-origin http:// requests
      // (client assets, the xterm_config iframe, websockets) to https://, which
      // fails whenever WeTTY has no HTTPS listener of its own to upgrade to.
      const res = await fetch(baseUrl);
      const csp = res.headers.get('content-security-policy');
      expect(csp).to.be.a('string');
      expect(csp).to.not.include('upgrade-insecure-requests');
    });

    it('should still set a same-origin default-src policy', async () => {
      const res = await fetch(baseUrl);
      const csp = res.headers.get('content-security-policy');
      expect(csp).to.include("default-src 'self'");
    });

    it('should restrict framing to same-origin ancestors', async () => {
      const res = await fetch(baseUrl);
      const csp = res.headers.get('content-security-policy');
      expect(csp).to.include("frame-ancestors 'self'");
      expect(res.headers.get('x-frame-options')).to.equal('SAMEORIGIN');
    });
  });

  describe('with iframe embedding allowed (allowIframe: true)', () => {
    let server: Server;
    let baseUrl: string;

    beforeEach(async () => {
      ({ server, baseUrl } = await startServer(true));
    });

    afterEach(async () => {
      await stopServer(server);
    });

    it('should not restrict which ancestors are allowed to frame it', async () => {
      // WeTTY is often embedded same-origin inside another app (e.g.
      // Showroom), which is itself nested inside a third-party portal on a
      // different domain. `frame-ancestors` is checked against the entire
      // ancestor chain, not just the immediate parent, and it takes priority
      // over X-Frame-Options. So Helmet's default `frame-ancestors 'self'`
      // would still block that nested, cross-origin case even with
      // X-Frame-Options disabled. The directive must be dropped entirely
      // when embedding is explicitly allowed.
      const res = await fetch(baseUrl);
      const csp = res.headers.get('content-security-policy');
      expect(csp).to.be.a('string');
      expect(csp).to.not.include('frame-ancestors');
    });

    it('should not send an X-Frame-Options header', async () => {
      const res = await fetch(baseUrl);
      expect(res.headers.get('x-frame-options')).to.equal(null);
    });

    it('should still set a same-origin default-src policy', async () => {
      const res = await fetch(baseUrl);
      const csp = res.headers.get('content-security-policy');
      expect(csp).to.include("default-src 'self'");
    });
  });
});
