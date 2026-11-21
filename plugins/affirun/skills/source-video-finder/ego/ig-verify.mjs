import { absJ, isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'

export function build(args) {
  need(args, 3, 'node ig-verify.mjs <space> <dir> <code>...')
  const [space, dir, ...ids] = args
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
const dir = ${absJ(dir)};
const out = [];
for (const id of ${j(ids)}) {
  try {
    await page.goto("https://www.instagram.com/reel/" + id + "/", { timeout: 30000 });
    await page.waitForFunction(() => { const v = document.querySelector("video"); return v && v.duration > 0; }, undefined, { timeout: 20000 });
    const meta = await page.evaluate(() => { const v = document.querySelector("video"); v.muted = true; v.pause(); const b = v.getBoundingClientRect(); const owner = ([...document.querySelectorAll('a[href$="/reels/"]')].map(a => ({ h: a.getAttribute("href"), t: (a.innerText || "").trim() })).find(x => x.t && /^\/[A-Za-z0-9._]+\/reels\/$/.test(x.h)) || {}).t; return { d: v.duration, w: v.videoWidth, h: v.videoHeight, r: [b.x, b.y, b.width, b.height].map(Math.round), owner, cap: (document.querySelector("h1")?.innerText || "").slice(0, 120) }; });
    for (const f of [0.3, 0.7]) {
      await page.evaluate((t) => { const v = document.querySelector("video"); v.play().catch(()=>{}); v.currentTime = v.duration * t; setTimeout(() => v.pause(), 800); }, f);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: dir + "/ig-" + id + "-" + Math.round(f * 100) + ".png" });
    }
    out.push({ id, ...meta });
  } catch (e) { out.push({ id, error: String(e).slice(0, 120) }); }
}
console.log(JSON.stringify(out));
`
}

if (isMain(import.meta.url)) main(build)
