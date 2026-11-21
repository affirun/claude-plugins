import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function isMain(metaUrl) {
  return !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(metaUrl)
}

export const j = (value) => JSON.stringify(value)

export const abs = (p) => path.resolve(p)

export const absJ = (p) => j(path.resolve(p))

export function spaceRef(arg) {
  if (!arg) throw new Error('missing TaskSpace id')
  return /^\d+$/.test(arg) ? arg : j(arg)
}

export function pageRef(env = process.env) {
  return j(env.EGO_PAGE || 'p1')
}

export function stem(p) {
  return path.basename(p).replace(/\.[^.]+$/, '')
}

export function need(args, count, usage) {
  if (args.length < count || args.slice(0, count).some((a) => a === undefined || a === '')) {
    console.error('usage: ' + usage)
    process.exit(1)
  }
}

export function runEgo(code, { env = process.env, platform = process.platform } = {}) {
  const command = env.EGO_BROWSER || 'ego-browser'
  return new Promise((resolve) => {
    const child = spawn(command, ['nodejs'], {
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: platform === 'win32',
    })
    child.on('error', (err) => {
      console.error(
        `could not start ${command}: ${err.message}. Is Ego Lite installed and is ego-browser on PATH?`,
      )
      resolve(127)
    })
    child.on('close', (code) => resolve(code ?? 1))
    child.stdin.end(code)
  })
}

export async function main(build) {
  const code = build(process.argv.slice(2))
  process.exitCode = await runEgo(code)
}
