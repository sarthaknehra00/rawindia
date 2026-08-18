import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

// Dev-only shim so `npm run dev` can serve the same /api/*.ts serverless
// handlers Vercel runs in production, without needing `vercel dev` (slower
// startup, fights with the Tailwind v4 Vite plugin). Raw Node req/res don't
// have Vercel's `.query`/`.status()`/`.json()` conveniences — this adds just
// enough of a shim for our simple pass-through handlers to work unchanged.

interface ShimRequest extends IncomingMessage {
  query: Record<string, string>;
  body?: unknown;
}

interface ShimResponse extends ServerResponse {
  status(code: number): ShimResponse;
  json(body: unknown): void;
}

function enhance(req: IncomingMessage, res: ServerResponse): { req: ShimRequest; res: ShimResponse } {
  const url = new URL(req.url || '/', 'http://localhost');
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => { query[key] = value; });

  const shimReq = req as ShimRequest;
  shimReq.query = query;

  const shimRes = res as ShimResponse;
  shimRes.status = (code: number) => { res.statusCode = code; return shimRes; };
  shimRes.json = (body: unknown) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };

  return { req: shimReq, res: shimRes };
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      if (!data) { resolve(undefined); return; }
      try { resolve(JSON.parse(data)); } catch { resolve(undefined); }
    });
  });
}

export function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-proxy',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const mount = (route: string, modulePath: string) => {
        server.middlewares.use(route, async (req, res, next) => {
          try {
            const { req: shimReq, res: shimRes } = enhance(req, res);
            if (req.method === 'POST') {
              shimReq.body = await readJsonBody(req);
            }
            const mod = await server.ssrLoadModule(modulePath);
            await mod.default(shimReq, shimRes);
          } catch (err) {
            next(err as Error);
          }
        });
      };

      mount('/api/groq', '/api/groq.ts');
      mount('/api/news', '/api/news.ts');
      mount('/api/guardian', '/api/guardian.ts');
      mount('/api/rss2json', '/api/rss2json.ts');
      mount('/api/local-llm', '/api/localLlm.ts');
      mount('/api/local-embeddings', '/api/localEmbeddings.ts');
      mount('/api/rbi', '/api/rbi.ts');
      mount('/api/ledger', '/api/ledger.ts');
      mount('/api/roster', '/api/roster.ts');
      mount('/api/cron/ledger-extract', '/api/cron/ledger-extract.ts');
    },
  };
}
