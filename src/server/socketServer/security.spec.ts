import 'mocha';
import { expect } from 'chai';
import express from 'express';
import { policies } from './security.js';
import type { Server } from 'node:http';

describe('policies', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const app = express();
    app.use(policies(false));
    app.get('/', (_req, res) => {
      res.send('ok');
    });
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => {
        resolve(s);
      });
    });
    const { port } = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${String(port)}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
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
});
