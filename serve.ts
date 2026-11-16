// Development server for funboard: serves app/ on http://localhost:8080.
// Not part of the entry — the grader never runs it. Usage: node serve.ts [--port N]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(fileURLToPath(new URL('.', import.meta.url)), 'app');

function portFromArgs() {
  const flag = process.argv.indexOf('--port');
  const given = flag >= 0 ? Number(process.argv[flag + 1]) : NaN;
  return Number.isSafeInteger(given) && given > 0 ? given : 8080;
}

const mimeFor = (file) =>
  ({
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
  })[extname(file)] ?? 'application/octet-stream';

async function serveFile(res, file) {
  const body = await readFile(file);
  res.writeHead(200, { 'content-type': mimeFor(file) });
  res.end(body);
}

const port = portFromArgs();
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = join(appRoot, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(appRoot)) {
      res.writeHead(403);
      res.end();
      return;
    }
    await serveFile(res, file);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}).listen(port, () => console.log(`funboard at http://localhost:${port}`));
