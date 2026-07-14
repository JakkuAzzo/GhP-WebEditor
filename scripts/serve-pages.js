const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.PORT) || 4173;
const basePath = `/${String(process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '')}`.replace(/^\/$/, '');
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  if (basePath && pathname !== basePath && !pathname.startsWith(`${basePath}/`)) {
    response.writeHead(404).end('Not found');
    return;
  }
  const relativePath = basePath ? pathname.slice(basePath.length) : pathname;
  const requested = relativePath === '/' || relativePath === '' ? 'index.html' : relativePath.replace(/^\/+/, '');
  const filePath = path.resolve(root, requested);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    response.end(data);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Static Pages build available at http://127.0.0.1:${port}${basePath || '/'}`);
});
