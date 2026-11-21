import { absJ, isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'
import { verifySheets } from './sheet.mjs'

export function build(args) {
  need(args, 3, 'node tt-grid-verify.mjs <space> <dir> <id>...')
  const [space, dir, ...ids] = args
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
const dir = ${absJ(dir)};
const out = [];
for (const id of ${j(ids)}) {
  if (await page.evaluate(() => /Drag the slider|captcha/i.test(document.body.innerText) || !!document.querySelector("[id*=captcha],[class*=captcha]"))) { out.push({ id, error: "captcha" }); break; }
  try {
    await page.evaluate((i) => document.querySelector('a[href*="/video/' + i + '"]')?.scrollIntoView({ block: "center" }), id);
    await page.waitForTimeout(1200);
    await page.click('a[href*="/video/' + id + '"] >> nth=0');
    const ok = await page.waitForFunction(() => [...document.querySelectorAll("video")].some((v) => v.duration > 0 && v.getBoundingClientRect().width > 200), undefined, { timeout: 15000 }).then(() => true).catch(() => false);
    if (!ok) { out.push({ id, error: "no_video", shop: await page.evaluate(() => /TikTok Shop videos/.test(document.body.innerText)) }); await page.keyboard.press("Escape"); await page.waitForTimeout(1200); continue; }
    const meta = await page.evaluate(() => { const v = [...document.querySelectorAll("video")].find((x) => x.duration > 0 && x.getBoundingClientRect().width > 200); v.pause(); const b = v.getBoundingClientRect(); return { d: v.duration, w: v.videoWidth, h: v.videoHeight, r: [b.x, b.y, b.width, b.height].map(Math.round), ai: /AI-generated/i.test(document.body.innerText) }; });
    for (const f of [0.3, 0.7]) {
      await page.evaluate((t) => { const v = [...document.querySelectorAll("video")].find((x) => x.duration > 0 && x.getBoundingClientRect().width > 200); v.currentTime = v.duration * t; }, f);
      await page.waitForTimeout(1400);
      await page.screenshot({ path: dir + "/tt-" + id + "-" + Math.round(f * 100) + ".png" });
    }
    out.push({ id, ...meta });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1500);
  } catch (e) { out.push({ id, error: String(e).slice(0, 120) }); await page.keyboard.press("Escape").catch(()=>{}); }
}
console.log(JSON.stringify(out));
`
}

if (isMain(import.meta.url)) main(build, (args) => verifySheets('tt', args[1], args.slice(2)))
