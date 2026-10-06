// Dev-server endpoints for the report studio (npm run dev only; a static build
// falls back to downloads and the print dialog):
//
//   GET  /__reports            the spec files in presentation/reports
//   GET  /__reports/:name      one of them
//   PUT  /__reports/:name      save one (so the studio and the agent edit the same files)
//   POST /__render             {spec, bundle?} → the PDF the report CLI would make
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const NAME = /^[a-z0-9][a-z0-9._-]{0,80}$/i;

const body = req => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

const send = (res, status, data, type = 'application/json') => {
  res.statusCode = status;
  res.setHeader('content-type', type);
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
};

export function reportPlugin({ root }) {
  const reports = path.join(root, 'reports');
  let renderer = null;
  let server = null;

  async function getRenderer() {
    if (!renderer) {
      const { openRenderer } = await import('./lib/render-core.mjs');
      const url = server.resolvedUrls?.local?.[0]?.replace(/\/$/, '');
      renderer = openRenderer({ url });
    }
    return renderer;
  }

  return {
    name: 'foreshock-report',
    apply: 'serve',
    configureServer(s) {
      server = s;
      s.httpServer?.once('close', async () => { if (renderer) (await renderer).close(); });
      s.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://x');
        try {
          if (url.pathname === '/__reports' && req.method === 'GET') {
            const list = existsSync(reports) ? readdirSync(reports).filter(f => f.endsWith('.spec.json')).map(f => f.replace(/\.spec\.json$/, '')) : [];
            return send(res, 200, list.sort());
          }
          const m = url.pathname.match(/^\/__reports\/([^/]+)$/);
          if (m) {
            const name = decodeURIComponent(m[1]).replace(/\.spec\.json$/, '');
            if (!NAME.test(name)) return send(res, 400, 'Report names are letters, digits, dot, dash and underscore.', 'text/plain');
            const file = path.join(reports, `${name}.spec.json`);
            if (req.method === 'GET') return existsSync(file) ? send(res, 200, readFileSync(file, 'utf8')) : send(res, 404, 'No such report', 'text/plain');
            if (req.method === 'PUT') {
              const spec = JSON.parse(await body(req));
              if (!Array.isArray(spec.blocks)) return send(res, 400, 'Not a report spec (no blocks).', 'text/plain');
              mkdirSync(reports, { recursive: true });
              writeFileSync(file, JSON.stringify(spec, null, 2) + '\n');
              return send(res, 200, { saved: path.relative(root, file) });
            }
          }
          if (url.pathname === '/__render' && req.method === 'POST') {
            const { spec, bundle } = JSON.parse(await body(req));
            const { renderSpec } = await import('./lib/render-core.mjs');
            const r = await getRenderer();
            const outBase = path.join(tmpdir(), `foreshock-${process.pid}-${Date.now()}`);
            const result = await renderSpec(r, { spec, bundle: bundle || null, outBase, formats: ['pdf'] });
            res.setHeader('x-foreshock-fit', JSON.stringify({ ok: result.fit.ok, pages: result.pages }));
            return send(res, 200, readFileSync(result.files.pdf), 'application/pdf');
          }
        } catch (e) {
          return send(res, 500, String(e?.message || e), 'text/plain');
        }
        next();
      });
    },
  };
}
