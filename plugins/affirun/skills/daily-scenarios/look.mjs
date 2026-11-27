import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const USAGE = `usage:
  node look.mjs covers <out.jpg> <image url or path>...
  node look.mjs cuts <out.jpg> <spec.json>
spec.json: { "clips": [{ "fileName", "proxyUrl" }], "cuts": [{ "clipName", "sourceStartMs", "sourceEndMs" }] }`

const TILE_HEIGHT = 480

function ffmpeg(args) {
  const run = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8' })
  if (run.error) throw new Error(`ffmpeg did not start: ${run.error.message}`)
  if (run.status !== 0) throw new Error(run.stderr.trim() || `ffmpeg exited with ${run.status}`)
}

async function local(source, dir, name) {
  if (!/^https?:\/\//.test(source)) return source
  const res = await fetch(source)
  if (!res.ok) throw new Error(`${name}: download failed (${res.status})`)
  const file = join(dir, name)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  return file
}

function sheet(tiles, out) {
  if (tiles.length === 1) return ffmpeg(['-i', tiles[0], out])
  const inputs = tiles.flatMap((t) => ['-i', t])
  const scaled = tiles.map((_, i) => `[${i}]scale=-2:${TILE_HEIGHT},pad=iw+8:ih:0:0:white[t${i}]`).join(';')
  const row = `${tiles.map((_, i) => `[t${i}]`).join('')}hstack=${tiles.length}`
  ffmpeg([...inputs, '-filter_complex', `${scaled};${row}`, out])
}

async function covers(out, sources) {
  const dir = mkdtempSync(join(tmpdir(), 'look-'))
  const tiles = []
  for (const [i, source] of sources.entries()) {
    const file = await local(source, dir, `cover-${i}.jpg`)
    const tile = join(dir, `tile-${i}.jpg`)
    ffmpeg(['-i', file, '-frames:v', '1', tile])
    tiles.push(tile)
  }
  sheet(tiles, out)
  return sources.length
}

async function cuts(out, specPath) {
  const spec = JSON.parse(readFileSync(specPath, 'utf8'))
  const dir = mkdtempSync(join(tmpdir(), 'look-'))
  const files = new Map()
  for (const [i, clip] of spec.clips.entries()) files.set(clip.fileName, await local(clip.proxyUrl, dir, `clip-${i}.mp4`))
  const tiles = []
  for (const [i, cut] of spec.cuts.entries()) {
    const file = files.get(cut.clipName)
    if (!file) throw new Error(`cut ${i + 1}: no clip named ${cut.clipName}`)
    const atSec = ((cut.sourceStartMs ?? 0) + (cut.sourceEndMs ?? cut.sourceStartMs ?? 0)) / 2000
    const tile = join(dir, `cut-${i}.jpg`)
    ffmpeg(['-ss', atSec.toFixed(2), '-i', file, '-frames:v', '1', tile])
    tiles.push(tile)
  }
  sheet(tiles, out)
  return spec.cuts.length
}

const [mode, out, ...rest] = process.argv.slice(2)
try {
  if (mode === 'covers' && out && rest.length) console.log(`# sheet: ${out} (${await covers(out, rest)} covers, left to right in the order given)`)
  else if (mode === 'cuts' && out && rest.length === 1) console.log(`# sheet: ${out} (${await cuts(out, rest[0])} cuts, left to right in play order)`)
  else {
    console.error(USAGE)
    process.exit(2)
  }
} catch (err) {
  console.error(`look: ${err.message}`)
  process.exit(1)
}
