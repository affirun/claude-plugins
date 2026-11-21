import { absJ, isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'
import { verifySheets } from './sheet.mjs'

export function build(args) {
  need(args, 3, 'node dy-verify.mjs <space> <dir> <awemeId>...')
  const [space, dir, ...ids] = args
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
const dir = ${absJ(dir)};
const out = [];
for (const id of ${j(ids)}) {
  try {
    await page.goto("https://www.douyin.com/video/" + id, { timeout: 30000 });
    await page.waitForFunction(() => { const v = document.querySelector("video"); return v && v.duration > 0; }, undefined, { timeout: 20000 });
    const meta = await page.evaluate(() => { const v = document.querySelector("video"); v.pause(); return { d: v.duration, w: v.videoWidth, h: v.videoHeight, r: v.getBoundingClientRect().toJSON(), title: document.title.slice(0, 60) }; });
    const shots = [];
    for (const f of [0.3, 0.7]) {
      await page.evaluate((t) => { const v = document.querySelector("video"); v.muted = true; v.play().catch(() => {}); v.currentTime = v.duration * t; setTimeout(() => v.pause(), 900); }, f);
      await page.waitForTimeout(1400);
      const p = dir + "/dy-" + id + "-" + Math.round(f * 100) + ".png";
      await page.screenshot({ path: p });
      shots.push(p);
    }
    out.push({ id, ...meta, shots });
  } catch (e) { out.push({ id, error: String(e).slice(0, 120) }); }
}
console.log(JSON.stringify(out));
`
}

if (isMain(import.meta.url)) main(build, (args) => verifySheets('dy', args[1], args.slice(2)))
