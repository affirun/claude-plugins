import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { abs, isMain, need } from './lib.mjs'

const PAIR_HEIGHT = 440
const PAIRS_PER_SHEET = 6

const CROPS = {
  tt: 'w=iw*666/1422:h=ih:x=iw*108/1422:y=0',
  dy: 'w=iw*294/1422:h=ih*523/1184:x=iw*467/1422:y=ih*72/1184',
  rn: 'w=iw*583/1422:h=ih*1036/1184:x=iw*352/1422:y=ih*89/1184',
  ig: 'w=iw*639/1410:h=ih:x=iw*342/1410:y=0',
}

export function ffmpegArgs(args) {
  need(args, 3, 'node sheet.mjs <tt|dy|rn|ig|raw> <out.jpg> <shot>...')
  const [platform, out, ...shots] = args
  const crop = CROPS[platform]
  const inputs = shots.flatMap((s) => ['-i', abs(s)])
  const parts = shots.map((_, i) => `[${i}:v]${crop ? `crop=${crop},` : ''}scale=-2:700[s${i}]`)
  const joined =
    shots.length === 1
      ? parts[0].replace('[s0]', '[out]')
      : `${parts.join(';')};${shots.map((_, i) => `[s${i}]`).join('')}hstack=inputs=${shots.length}[out]`
  return [
    '-v',
    'error',
    '-y',
    ...inputs,
    '-filter_complex',
    joined,
    '-map',
    '[out]',
    '-frames:v',
    '1',
    '-q:v',
    '4',
    abs(out),
  ]
}

export function pairArgs(platform, out, pairs) {
  const crop = CROPS[platform]
  const shots = pairs.flat()
  const cols = pairs.length
  const cell = (i) => `[${i}:v]${crop ? `crop=${crop},` : ''}scale=-2:${PAIR_HEIGHT}[s${i}]`
  const row = (r) =>
    cols === 1
      ? `[s${r}]null[r${r}]`
      : `${pairs.map((_, c) => `[s${c * 2 + r}]`).join('')}hstack=inputs=${cols}[r${r}]`
  const graph = [...shots.map((_, i) => cell(i)), row(0), row(1), '[r0][r1]vstack=inputs=2[out]'].join(';')
  return [
    '-v',
    'error',
    '-y',
    ...shots.flatMap((s) => ['-i', abs(s)]),
    '-filter_complex',
    graph,
    '-map',
    '[out]',
    '-frames:v',
    '1',
    '-q:v',
    '4',
    abs(out),
  ]
}

export function shotPairs(dir, prefix, ids, exists = existsSync) {
  return ids
    .map((id) => ({ id, shots: [30, 70].map((p) => path.join(dir, `${prefix}-${id}-${p}.png`)) }))
    .filter((x) => x.shots.every((s) => exists(s)))
}

export function verifySheets(platform, dir, ids) {
  const found = shotPairs(dir, platform, ids)
  if (found.length === 0) return
  let n = readdirSync(dir).filter((f) => f.startsWith(`sheet-${platform}-`)).length
  for (let i = 0; i < found.length; i += PAIRS_PER_SHEET) {
    const batch = found.slice(i, i + PAIRS_PER_SHEET)
    const out = path.join(dir, `sheet-${platform}-${++n}.jpg`)
    const result = spawnSync('ffmpeg', pairArgs(platform, out, batch.map((x) => x.shots)), { stdio: ['ignore', 'ignore', 'inherit'] })
    if (result.error || result.status !== 0) {
      console.log(`# sheet failed: run sheet.mjs yourself (${result.error?.message ?? `ffmpeg exit ${result.status}`})`)
      return
    }
    console.log(`# sheet: ${out} | columns left to right: ${batch.map((x) => x.id).join(' ')} | top row 30%, bottom row 70%`)
  }
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2)
  const result = spawnSync('ffmpeg', ffmpegArgs(args), { stdio: 'inherit' })
  if (result.error) {
    console.error(`could not start ffmpeg: ${result.error.message}`)
    process.exit(127)
  }
  if (result.status === 0) console.log(abs(args[1]))
  process.exit(result.status ?? 1)
}
