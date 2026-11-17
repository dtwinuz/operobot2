// Serves dist-demo/ under /demo/operobot2/ like the static host does (any unknown path -> index.html).
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

export const BASE = '/demo/operobot2/'
const ROOT = fileURLToPath(new URL('../dist-demo/', import.meta.url))
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon' }

export function serve(port = Number(process.env.PORT ?? 47312)) {
  const srv = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    if (!url.pathname.startsWith(BASE)) { res.writeHead(302, { location: BASE }); return res.end() }
    let file = normalize(join(ROOT, decodeURIComponent(url.pathname.slice(BASE.length))))
    if (!file.startsWith(normalize(ROOT))) { res.writeHead(403); return res.end() }
    try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html') } catch { file = join(ROOT, 'index.html') }
    try {
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
      res.end(body)
    } catch { res.writeHead(404); res.end('not found') }
  })
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const port = Number(process.env.PORT ?? 47312)
  await serve(port)
  console.log(`demo: http://127.0.0.1:${port}${BASE}`)
}
