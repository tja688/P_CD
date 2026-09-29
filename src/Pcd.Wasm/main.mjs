import { dotnet } from './_framework/dotnet.js'

const request = process.argv[2]
if (request === undefined) {
  process.stderr.write('用法：node main.mjs <request-json>\n')
  process.exit(1)
}

function writeStderr(args) {
  process.stderr.write(args.map((part) => String(part)).join(' ') + '\n')
}

// The runtime logs with console.info, which Node sends to stdout.
// Keep stdout for the probe JSON only.
console.log = (...args) => writeStderr(args)
console.info = (...args) => writeStderr(args)
console.debug = (...args) => writeStderr(args)

const { getAssemblyExports, getConfig, runMainAndExit } = await dotnet
  .withDiagnosticTracing(false)
  .create()

const config = getConfig()
const exports = await getAssemblyExports(config.mainAssemblyName)
const result = exports.KernelBridge.Invoke(request)
await new Promise((resolve, reject) => {
  process.stdout.write(result + '\n', (error) => (error ? reject(error) : resolve()))
})

await runMainAndExit()
