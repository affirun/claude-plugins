import { spawnSync } from 'node:child_process'

import { abs, isMain, need } from './lib.mjs'

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
