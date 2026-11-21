import { absJ, isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'
import { verifySheets } from './sheet.mjs'

export function build(args) {
  need(args, 4, 'node rn-verify.mjs <space> <dir> <out.png>.json <noteId>...')
  const [space, dir, list, ...ids] = args
  return String.raw`
const fs = await import("node:fs/promises");
const rows = JSON.parse(await fs.readFile(${absJ(list)}, "utf8"));
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
const dir = ${absJ(dir)};
const out = [];
for (const id of ${j(ids)}) {
  const r = rows.find((x) => x.id === id);
  if (!r) { out.push({ id, error: "not in the search list" }); continue; }
  const url = "https://www.rednote.com/explore/" + id + "?xsec_token=" + r.tok + "&xsec_source=pc_search";
  try {
    await page.goto(url, { timeout: 30000 });
    await page.waitForFunction(() => { const v = document.querySelector("video"); return v && v.duration > 0; }, undefined, { timeout: 20000 });
    const meta = await page.evaluate(() => { const v = document.querySelector("video"); v.pause(); const b = v.getBoundingClientRect(); return { d: v.duration, w: v.videoWidth, h: v.videoHeight, r: [b.x, b.y, b.width, b.height].map(Math.round) }; });
    for (const f of [0.3, 0.7]) {
      await page.evaluate((t) => { const v = document.querySelector("video"); v.muted = true; v.play().catch(()=>{}); v.currentTime = v.duration * t; setTimeout(() => v.pause(), 900); }, f);
      await page.waitForTimeout(1400);
      await page.screenshot({ path: dir + "/rn-" + id + "-" + Math.round(f * 100) + ".png" });
    }
    out.push({ id, url, ...meta });
  } catch (e) { out.push({ id, url, error: String(e).slice(0, 100) }); }
}
console.log(JSON.stringify(out));
`
}

if (isMain(import.meta.url)) main(build, (args) => verifySheets('rn', args[1], args.slice(3)))
