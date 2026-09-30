import type { KernelMode } from './types'

type DotnetApi = {
  runMain: (name?: string, args?: string[]) => Promise<number>
  getAssemblyExports: (name: string) => Promise<{ KernelBridge: { Invoke: (json: string) => string } }>
  getConfig: () => { mainAssemblyName: string }
}

export type Kernel = {
  mode: KernelMode
  invoke: (request: unknown) => Promise<unknown>
}

export async function connectKernel(log: (line: string) => void): Promise<Kernel> {
  const params = new URLSearchParams(location.search)
  const prefer = params.get('kernel')
  if (prefer !== 'wasm') {
    const url = params.get('ws') || 'ws://127.0.0.1:7420/'
    try {
      const socket = await openSocket(url, 350)
      log('内核经本地 WebSocket')
      return wrapSocket(socket)
    } catch {
      if (prefer === 'ws') {
        throw new Error('WebSocket 内核没有接通')
      }
    }
  }
  log('内核经 WebAssembly')
  return loadWasm()
}

async function loadWasm(): Promise<Kernel> {
  const href = '/_framework/dotnet.js'
  const mod = (await import(/* @vite-ignore */ href)) as {
    dotnet: { withDiagnosticTracing: (on: boolean) => { create: () => Promise<DotnetApi> } }
  }
  const api = await mod.dotnet.withDiagnosticTracing(false).create()
  await api.runMain()
  const config = api.getConfig()
  const exported = await api.getAssemblyExports(config.mainAssemblyName)
  return {
    mode: 'wasm',
    invoke: async (request) => parse(exported.KernelBridge.Invoke(JSON.stringify(request))),
  }
}

function wrapSocket(socket: WebSocket): Kernel {
  let chain: Promise<unknown> = Promise.resolve()
  return {
    mode: 'ws',
    invoke(request) {
      const run = chain.then(
        () =>
          new Promise((resolve, reject) => {
            const onMessage = (event: MessageEvent) => {
              cleanup()
              resolve(parse(String(event.data)))
            }
            const onError = () => {
              cleanup()
              reject(new Error('WebSocket 中断'))
            }
            const cleanup = () => {
              socket.removeEventListener('message', onMessage)
              socket.removeEventListener('error', onError)
            }
            socket.addEventListener('message', onMessage)
            socket.addEventListener('error', onError)
            socket.send(JSON.stringify(request))
          }),
      )
      chain = run.then(
        () => undefined,
        () => undefined,
      )
      return run
    },
  }
}

function openSocket(url: string, timeoutMs: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const timer = window.setTimeout(() => {
      socket.close()
      reject(new Error('timeout'))
    }, timeoutMs)
    socket.addEventListener('open', () => {
      window.clearTimeout(timer)
      resolve(socket)
    })
    socket.addEventListener('error', () => {
      window.clearTimeout(timer)
      reject(new Error('error'))
    })
  })
}

function parse(json: string): unknown {
  const value = JSON.parse(json) as { error?: string }
  if (value && typeof value === 'object' && typeof value.error === 'string' && Object.keys(value).length === 1) {
    throw new Error(value.error)
  }
  return value
}
