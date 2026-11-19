#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? null : process.argv[i + 1]
}
const since = arg('since')
const browser = arg('browser')
const reel = arg('reel')
const session = arg('session') ?? process.env.CLAUDE_CODE_SESSION_ID
if (!since || Number.isNaN(Date.parse(since))) {
  console.error('usage: node usage.mjs --since <ISO> [--browser chrome|ego] [--reel <code>] [--session <id>]')
  process.exit(1)
}
if (!session || !/^[0-9a-f-]{36}$/i.test(session)) {
  console.error('no session id: pass --session or run inside Claude Code (CLAUDE_CODE_SESSION_ID)')
  process.exit(1)
}
const sinceMs = Date.parse(since)
const root = join(homedir(), '.claude', 'projects')

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

const findSubagentTranscript = () => {
  const paths = []
  for (const dir of readdirSync(root)) {
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
const transcript = subagent ?? newest(readdirSync(root).map((dir) => join(root, dir, `${session}.jsonl`)))
if (!transcript) {
  console.error(`no transcript for session ${session} under ${root}`)
  process.exit(2)
}

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
  if (!(at >= sinceMs)) continue
  byId.set(d.message.id ?? `${d.timestamp}`, { at, model: d.message.model, usage: d.message.usage })
}

const calls = [...byId.values()]
const sum = (k) => calls.reduce((n, c) => n + (c.usage[k] ?? 0), 0)
const cacheRead = sum('cache_read_input_tokens')
const cacheWrite = sum('cache_creation_input_tokens')
const last = calls.reduce((m, c) => Math.max(m, c.at), sinceMs)
const context = (c) =>
  (c.usage.input_tokens ?? 0) + (c.usage.cache_read_input_tokens ?? 0) + (c.usage.cache_creation_input_tokens ?? 0)
console.log(
  JSON.stringify({
    model: calls.at(-1)?.model ?? null,
    browser,
    calls: calls.length,
    inputTokens: sum('input_tokens') + cacheRead + cacheWrite,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    outputTokens: sum('output_tokens'),
    durationSec: Math.round((last - sinceMs) / 1000),
    firstContextTokens: calls.length ? context(calls[0]) : 0,
    maxContextTokens: calls.reduce((m, c) => Math.max(m, context(c)), 0),
    subagent: Boolean(subagent),
  }),
)
