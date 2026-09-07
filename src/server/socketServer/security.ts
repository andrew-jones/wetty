import helmet from 'helmet';
import type { Request, Response } from 'express';

export const policies =
  (allowIframe: boolean) =>
  (req: Request, res: Response, next: (err?: unknown) => void): void => {
    helmet({
      referrerPolicy: { policy: ['no-referrer-when-downgrade'] },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          connectSrc: [
            "'self'",
            `${req.protocol === 'http' ? 'ws://' : 'wss://'}${req.get('host') ?? ''}`,
          ],
          // WeTTY is typically run behind a TLS-terminating reverse proxy
          // (see the README) with WeTTY itself listening on plain HTTP, so
          // there is no same-origin HTTPS listener to upgrade to. Helmet
          // enables this directive by default; removing it here stops
          // browsers from silently rewriting WeTTY's own http:// asset,
          // websocket, and iframe requests to https://, which otherwise
          // fail outright for any hostname other than "localhost" (the one
          // hostname browsers treat as already trustworthy and skip the
          // upgrade for).
          'upgrade-insecure-requests': null,
        },
      },
      xFrameOptions: allowIframe ? false : { action: 'sameorigin' },
    })(req, res, next);
  };
