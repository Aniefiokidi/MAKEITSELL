// ESM resolve hook for the WhatsApp scenario tests. Maps the app's "@/" alias onto the
// repo root, appends ".ts" where Next would, and swaps lib/whatsapp/client.ts for a stub
// that records outgoing messages instead of calling Meta. Registered via --import (see
// register.mjs), so the bot code runs unmodified under node --experimental-strip-types.
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const SHIM_MONGOOSE = pathToFileURL(path.join(ROOT, 'test/whatsapp/scenarios/shim-mongoose.mjs')).href
const STUB_CLIENT = pathToFileURL(path.join(ROOT, 'test/whatsapp/scenarios/stub-client.mjs')).href

function withExtension(fsPath) {
  if (existsSync(fsPath) && statSync(fsPath).isFile()) return fsPath
  for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
    if (existsSync(fsPath + ext)) return fsPath + ext
  }
  for (const index of ['/index.ts', '/index.js']) {
    if (existsSync(fsPath + index)) return fsPath + index
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  const parentPath = context.parentURL?.startsWith('file:') ? fileURLToPath(context.parentURL) : null

  const fromApp = parentPath && parentPath.startsWith(ROOT) && !parentPath.includes('node_modules') && !parentPath.includes('/test/')
  if (specifier === 'mongoose' && fromApp) return { url: SHIM_MONGOOSE, shortCircuit: true }

  let target = null
  if (specifier.startsWith('@/')) target = path.join(ROOT, specifier.slice(2))
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && parentPath && parentPath.startsWith(ROOT) && !parentPath.includes('node_modules')) {
    target = path.resolve(path.dirname(parentPath), specifier)
  }

  if (target) {
    const resolved = withExtension(target)
    if (resolved) {
      if (resolved === path.join(ROOT, 'lib/whatsapp/client.ts')) return { url: STUB_CLIENT, shortCircuit: true }
      return { url: pathToFileURL(resolved).href, shortCircuit: true }
    }
  }
  // Bare package subpaths written the bundler way ("next/server") need the .js that
  // Node's strict ESM resolver insists on.
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' && !specifier.startsWith('.') && !specifier.startsWith('/') && !/\.[cm]?js$/.test(specifier)) {
      return nextResolve(`${specifier}.js`, context)
    }
    throw error
  }
}

// Transpile .ts/.tsx with the real TypeScript compiler so type-only imports written
// without the `type` keyword (e.g. `import { IConversation }`) are elided the way
// Next's build does — node's built-in type stripping keeps them and then fails to
// link the missing runtime export.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const ts = createRequire(import.meta.url)(path.join(ROOT, 'node_modules/typescript'))

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && /\.tsx?$/.test(url) && !url.includes('/node_modules/')) {
    const filename = fileURLToPath(url)
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    })
    return { format: 'module', source: outputText, shortCircuit: true }
  }
  return nextLoad(url, context)
}
