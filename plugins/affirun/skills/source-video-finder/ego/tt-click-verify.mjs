import { absJ, isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'

export function build(args) {
  need(args, 4, 'node tt-click-verify.mjs "<query that shows the leads>" <space> <dir> <id>...')
  const [q, space, dir, ...ids] = args
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
const dir = ${absJ(dir)};
async function search() {
  await page.goto("https://www.tiktok.com/", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.click("loc=role:searchbox[name='Search']");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(${j(q)});
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelectorAll('a[href*="/video/"]').length > 4, undefined, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2000);
}
await search();
const out = [];
for (const id of ${j(ids)}) {
  if (await page.evaluate(() => /Drag the slider|captcha/i.test(document.body.innerText) || !!document.querySelector("[id*=captcha],[class*=captcha]"))) { out.push({ id, error: "captcha" }); break; }
  try {
    if (!(await page.evaluate((i) => !!document.querySelector('a[href*="/video/' + i + '"]'), id))) {
      for (let k = 0; k < 4 && !(await page.evaluate((i) => !!document.querySelector('a[href*="/video/' + i + '"]'), id)); k++) { await page.mouse.move(800, 700); await page.mouse.wheel(0, 2000); await page.waitForTimeout(1500); }
    }
    await page.click('a[href*="/video/' + id + '"] >> nth=0');
    const ok = await page.waitForFunction(() => [...document.querySelectorAll("video")].some((v) => v.duration > 0 && v.getBoundingClientRect().width > 200) || /View TikTok Shop videos in the TikTok app/.test(document.body.innerText), undefined, { timeout: 15000 }).then(() => true).catch(() => false);
    const shop = await page.evaluate(() => /View TikTok Shop videos in the TikTok app/.test(document.body.innerText) && ![...document.querySelectorAll("video")].some((v) => v.duration > 0));
    if (!ok || shop) { out.push({ id, error: shop ? "tiktok_shop" : "no_video", handle: await page.evaluate(() => (location.pathname.match(/@([^/]+)/) || [])[1]) }); await page.keyboard.press("Escape"); await page.waitForTimeout(1200); if (!(await page.url()).includes("/search")) await search(); continue; }
    const meta = await page.evaluate(() => { const v = [...document.querySelectorAll("video")].find((x) => x.duration > 0 && x.getBoundingClientRect().width > 200); v.pause(); const b = v.getBoundingClientRect(); return { d: v.duration, w: v.videoWidth, h: v.videoHeight, r: [b.x, b.y, b.width, b.height].map(Math.round), ai: /AI-generated|AI 생성|สร้างโดย AI/i.test(document.body.innerText), handle: (location.pathname.match(/@([^/]+)/) || [])[1] }; });
    for (const f of [0.3, 0.7]) {
      await page.evaluate((t) => { const v = [...document.querySelectorAll("video")].find((x) => x.duration > 0 && x.getBoundingClientRect().width > 200); v.currentTime = v.duration * t; }, f);
      await page.waitForTimeout(1400);
      await page.screenshot({ path: dir + "/tt-" + id + "-" + Math.round(f * 100) + ".png" });
    }
    out.push({ id, ...meta });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1500);
    if (!(await page.url()).includes("/search")) await search();
  } catch (e) { out.push({ id, error: String(e).slice(0, 120) }); await search(); }
}
console.log(JSON.stringify(out));
`
}

if (isMain(import.meta.url)) main(build)
