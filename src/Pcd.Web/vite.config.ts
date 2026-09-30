import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const framework = path.resolve(
  repo,
  'src/Pcd.Wasm/bin/Release/net10.0/browser-wasm/AppBundle/_framework',
)
const catalog = path.resolve(repo, 'content/rules/catalog.yaml')

function types(file: string): string {
  switch (path.extname(file)) {
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8'
    case '.wasm':
      return 'application/wasm'
    case '.json':
      return 'application/json'
    default:
      return 'application/octet-stream'
  }
}

function kernelFiles(): Plugin {
  const serve = (url: string, res: import('node:http').ServerResponse, next: () => void) => {
    if (url.startsWith('/rules/catalog.yaml')) {
      res.setHeader('Content-Type', 'text/yaml; charset=utf-8')
      res.end(fs.readFileSync(catalog))
      return
    }
    if (!url.startsWith('/_framework/')) {
      next()
      return
    }
    const rel = decodeURIComponent(url.slice('/_framework/'.length).split('?')[0] ?? '')
    const file = path.normalize(path.join(framework, rel))
    if (!file.startsWith(framework) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404
      res.end()
      return
    }
    res.setHeader('Content-Type', types(file))
    fs.createReadStream(file).pipe(res)
  }
  return {
    name: 'pcd-kernel',
    configureServer(server) {
      server.middlewares.use((req, res, next) => serve(req.url ?? '', res, next))
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => serve(req.url ?? '', res, next))
    },
    closeBundle() {
      const out = path.resolve(here, 'dist')
      fs.cpSync(framework, path.join(out, '_framework'), { recursive: true })
      fs.mkdirSync(path.join(out, 'rules'), { recursive: true })
      fs.copyFileSync(catalog, path.join(out, 'rules', 'catalog.yaml'))
    },
  }
}

export default defineConfig({
  root: here,
  publicDir: path.join(here, 'assets'),
  plugins: [kernelFiles()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { target: 'es2022', assetsInlineLimit: 0 },
})
