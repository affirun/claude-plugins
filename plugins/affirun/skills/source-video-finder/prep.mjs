#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { isMain } from './ego/lib.mjs'

const USAGE = 'usage: node prep.mjs <run dir> [--video <url>] [--frame <url>]...'
const FRAME_COUNT = 6
const CELL_WIDTH = 360
const TIMEOUT_MS = 60000

export function parseArgs(args) {
  const out = { dir: null, video: null, frames: [] }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--video') out.video = args[++i] ?? null
    else if (args[i] === '--frame') out.frames.push(args[++i])
    else if (!out.dir) out.dir = args[i]
  }
  out.frames = out.frames.filter(Boolean)
  return out
}

export function frameTimes(durationSec, count = FRAME_COUNT) {
  if (!(durationSec > 0)) return []
  return Array.from({ length: count }, (_, i) => Math.round(((i + 0.5) / count) * durationSec * 10) / 10)
}

export function gridGraph(count, cellWidth = CELL_WIDTH) {
  if (count < 1) throw new Error('no frames to lay out')
  const cols = count <= 4 ? count : Math.ceil(count / 2)
  const rows = Math.ceil(count / cols)
  const cells = Array.from({ length: rows * cols }, (_, i) => Math.min(i, count - 1))
  const scaled = cells.map((src, i) => `[${src}:v]scale=${cellWidth}:-2[c${i}]`)
  if (cells.length === 1) return scaled[0].replace('[c0]', '[out]')
  const rowLabels = []
  const stacks = []
  for (let r = 0; r < rows; r++) {
    const ins = cells.slice(r * cols, (r + 1) * cols).map((_, k) => `[c${r * cols + k}]`)
    const label = rows === 1 ? '[out]' : `[r${r}]`
    rowLabels.push(label)
    stacks.push(cols === 1 ? `${ins[0]}null${label}` : `${ins.join('')}hstack=inputs=${cols}${label}`)
  }
  if (rows > 1) stacks.push(`${rowLabels.join('')}vstack=inputs=${rows}[out]`)
  return [...scaled, ...stacks].join(';')
}

export function looksLikeVideo(bytes) {
  return bytes.length > 50000 && Buffer.from(bytes.subarray(4, 8)).toString('latin1') === 'ftyp'
}

async function download(url, file) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  writeFileSync(file, bytes)
  return bytes
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.error) throw new Error(`could not start ${command}: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || '').trim().slice(0, 200)}`)
  return result.stdout
}

function probe(file) {
  const out = run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height:format=duration',
    '-of',
    'json',
    file,
  ])
  const data = JSON.parse(out)
  return {
    durationSec: Math.round(Number(data.format?.duration ?? 0) * 10) / 10,
    width: data.streams?.[0]?.width ?? 0,
    height: data.streams?.[0]?.height ?? 0,
  }
}

async function main() {
  const { dir, video, frames: frameUrls } = parseArgs(process.argv.slice(2))
  if (!dir || (!video && frameUrls.length === 0)) {
    console.error(USAGE)
    process.exit(1)
  }
  const startedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const reelDir = path.join(dir, 'reel')
  mkdirSync(reelDir, { recursive: true })
  mkdirSync(path.join(dir, 'v'), { recursive: true })

  const result = { startedAt, dir, video: null, frames: [], sheet: null, notes: [] }

  if (video) {
    const file = path.join(dir, 'reel.mp4')
    try {
      const bytes = await download(video, file)
      if (!looksLikeVideo(bytes)) throw new Error(`not a video (${bytes.length} bytes)`)
      const meta = probe(file)
      result.video = { path: file, ...meta }
      for (const t of frameTimes(meta.durationSec)) {
        const frame = path.join(reelDir, `f-${t.toFixed(1)}s.jpg`)
        run('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', file, '-frames:v', '1', '-q:v', '2', frame])
        result.frames.push(frame)
      }
    } catch (err) {
      result.notes.push(`video: ${err.message}`)
    }
  }

  if (result.frames.length === 0) {
    for (const [i, url] of frameUrls.entries()) {
      const frame = path.join(reelDir, `f-${i + 1}.jpg`)
      try {
        await download(url, frame)
        result.frames.push(frame)
      } catch (err) {
        result.notes.push(`frame ${i + 1}: ${err.message}`)
      }
    }
  }

  if (result.frames.length > 0) {
    const sheet = path.join(reelDir, 'sheet.jpg')
    try {
      run('ffmpeg', [
        '-v',
        'error',
        '-y',
        ...result.frames.flatMap((f) => ['-i', f]),
        '-filter_complex',
        gridGraph(result.frames.length),
        '-map',
        '[out]',
        '-frames:v',
        '1',
        '-q:v',
        '4',
        sheet,
      ])
      result.sheet = sheet
    } catch (err) {
      result.notes.push(`sheet: ${err.message}`)
    }
  }

  const runFile = path.join(dir, 'run.json')
  if (!existsSync(runFile)) {
    writeFileSync(runFile, JSON.stringify({ startedAt, reel: { frames: result.frames } }, null, 2))
  }
  const rel = (file) => path.relative(dir, file).split(path.sep).join('/')
  console.log(
    JSON.stringify({
      startedAt,
      dir,
      video: result.video && { ...result.video, path: rel(result.video.path) },
      frames: result.frames.map(rel),
      sheet: result.sheet && rel(result.sheet),
      ...(result.notes.length ? { notes: result.notes } : {}),
    }),
  )
  if (result.frames.length === 0) process.exitCode = 2
}

if (isMain(import.meta.url)) await main()
