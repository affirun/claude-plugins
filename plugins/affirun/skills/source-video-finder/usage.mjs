#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? null : process.argv[i + 1]
}
const since = arg('since')
const until = arg('until')
const browser = arg('browser')
const reel = arg('reel')
const sessionArg = arg('session')
if (!since || Number.isNaN(Date.parse(since))) {
  console.error(
    'usage: node usage.mjs --since <ISO> [--until <ISO>] [--browser chrome|devtools|ego] [--reel <code>] [--session <id>]',
  )
  process.exit(1)
}
if (until && Number.isNaN(Date.parse(until))) {
  console.error(`invalid --until timestamp: ${until}`)
  process.exit(1)
}
const sinceMs = Date.parse(since)
const untilMs = until ? Date.parse(until) : Number.POSITIVE_INFINITY
const isUuid = (v) => Boolean(v && /^[0-9a-f-]{36}$/i.test(v))

const newest = (paths) => {
  let best = null
  for (const path of paths) {
    try {
      const mtime = statSync(path).mtimeMs
      if (!best || mtime > best.mtime) best = { path, mtime }
    } catch {}
  }
  return best?.path ?? null
}

function readClaudeCalls(session) {
  const root = join(homedir(), '.claude', 'projects')
  let projectDirs
  try {
    projectDirs = readdirSync(root)
  } catch {
    return null
  }
  const findSubagentTranscript = () => {
    const paths = []
    for (const dir of projectDirs) {
      const sub = join(root, dir, session, 'subagents')
      let files
      try {
        files = readdirSync(sub)
      } catch {
        continue
      }
      for (const f of files) {
        if (!f.endsWith('.jsonl')) continue
        const path = join(sub, f)
        if (statSync(path).mtimeMs < sinceMs) continue
        if (readFileSync(path, 'utf8').includes(reel)) paths.push(path)
      }
    }
    return newest(paths)
  }

  const subagent = reel ? findSubagentTranscript() : null
  const transcript = subagent ?? newest(projectDirs.map((dir) => join(root, dir, `${session}.jsonl`)))
  if (!transcript) return null

  const byId = new Map()
  for (const line of readFileSync(transcript, 'utf8').split('\n')) {
    if (!line) continue
    let d
    try {
      d = JSON.parse(line)
    } catch {
      continue
    }
    if (d.type !== 'assistant' || !d.message?.usage) continue
    if (!subagent && d.isSidechain) continue
    const at = Date.parse(d.timestamp)
    if (!((subagent || at >= sinceMs) && at <= untilMs)) continue
    const u = d.message.usage
    byId.set(d.message.id ?? `${d.timestamp}`, {
      at,
      model: d.message.model ?? null,
      input: u.input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      output: u.output_tokens ?? 0,
    })
  }
  return { calls: [...byId.values()], subagent: Boolean(subagent) }
}

function readAntigravityCalls(session) {
  const appDataDir = process.env.ANTIGRAVITY_APP_DATA_DIR || join(homedir(), '.gemini', 'antigravity')
  const transcript = join(appDataDir, 'brain', session, '.system_generated', 'logs', 'transcript.jsonl')
  if (!existsSync(transcript)) return null

  const byId = new Map()
  for (const line of readFileSync(transcript, 'utf8').split('\n')) {
    if (!line) continue
    let d
    try {
      d = JSON.parse(line)
    } catch {
      continue
    }
    if (d.type !== 'PLANNER_RESPONSE') continue
    if (d.input_tokens == null && d.output_tokens == null) continue
    const at = Date.parse(d.created_at)
    if (!(at >= sinceMs && at <= untilMs)) continue
    byId.set(d.step_index ?? `${d.created_at}`, {
      at,
      model: d.model ?? null,
      input: d.input_tokens ?? 0,
      cacheRead: d.cache_read_tokens ?? 0,
      cacheWrite: d.cache_write_tokens ?? 0,
      output: d.output_tokens ?? 0,
    })
  }
  return { calls: [...byId.values()], subagent: false }
}

const claudeSession = sessionArg ?? process.env.CLAUDE_CODE_SESSION_ID
const agySession = sessionArg ?? process.env.ANTIGRAVITY_CONVERSATION_ID

let result = null
if (isUuid(claudeSession) && (process.env.CLAUDE_CODE_SESSION_ID || !process.env.ANTIGRAVITY_CONVERSATION_ID)) {
  result = readClaudeCalls(claudeSession)
}
if (!result && isUuid(agySession)) {
  result = readAntigravityCalls(agySession)
}
if (!result && isUuid(claudeSession)) {
  result = readClaudeCalls(claudeSession)
}

if (!result) {
  console.error(
    'no transcript found: pass --session <uuid> or run inside Claude Code (CLAUDE_CODE_SESSION_ID) or Antigravity (ANTIGRAVITY_CONVERSATION_ID)',
  )
  process.exit(2)
}

const { calls, subagent } = result
const sum = (k) => calls.reduce((n, c) => n + (c[k] ?? 0), 0)
const cacheRead = sum('cacheRead')
const cacheWrite = sum('cacheWrite')
const first = calls.reduce((m, c) => Math.min(m, c.at), sinceMs)
const last = calls.reduce((m, c) => Math.max(m, c.at), sinceMs)
const context = (c) => c.input + c.cacheRead + c.cacheWrite
console.log(
  JSON.stringify({
    model: calls.at(-1)?.model ?? null,
    browser,
    calls: calls.length,
    inputTokens: sum('input') + cacheRead + cacheWrite,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    outputTokens: sum('output'),
    durationSec: Math.round((last - first) / 1000),
    firstContextTokens: calls.length ? context(calls[0]) : 0,
    maxContextTokens: calls.reduce((m, c) => Math.max(m, context(c)), 0),
    subagent,
  }),
)
