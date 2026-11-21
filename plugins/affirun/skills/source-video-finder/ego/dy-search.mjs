import { absJ, isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'

export function build(args) {
  need(args, 3, 'node dy-search.mjs "<query>" <space> <out.png>')
  const [q, space, out] = args
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
const box = 'input[placeholder*="搜索你感兴趣的内容"]';
const hasBox = await page.evaluate((b) => !!document.querySelector(b), box);
if (!hasBox) await page.goto("https://www.douyin.com/", { timeout: 30000 }).catch(() => {});
if (!(await page.waitForSelector(box, { timeout: 15000 }).then(() => true).catch(() => false))) { await page.reload({ timeout: 30000 }).catch(() => {}); await page.waitForSelector(box, { timeout: 20000 }).catch(() => { console.log("[]"); process.exit(0); }); }
await page.click(box);
await page.keyboard.press("ControlOrMeta+a");
await page.keyboard.insertText(${j(q)});
await page.keyboard.press("Enter");
await page.waitForSelector(".search-result-card", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.keyboard.press("Escape");
await page.evaluate(() => document.activeElement && document.activeElement.blur());
const rows = await page.evaluate(() => {
  const out = [];
  for (const card of document.querySelectorAll(".search-result-card")) {
    let f = null;
    const el = card.querySelector("img") || card;
    for (const k of Object.keys(el)) if (k.startsWith("__reactFiber")) f = el[k];
    let d = null;
    for (let i = 0; f && i < 45; i++, f = f.return) {
      const p = f.memoizedProps;
      if (p) { for (const v of Object.values(p)) if (v && typeof v === "object" && v.awemeId) { d = v; break; } }
      if (d) break;
    }
    if (d) out.push({ id: d.awemeId, desc: (d.desc || "").slice(0, 80), author: d.authorInfo?.nickname, secUid: d.authorInfo?.secUid, ads: !!d.isAds, type: d.awemeType, dur: d.video?.duration });
  }
  return out;
});
const vids = rows.map((r, i) => ({ i, ...r })).filter((r) => r.type !== 68);
console.log("# cards " + rows.length + ", photo posts dropped " + (rows.length - vids.length));
console.log(JSON.stringify(vids));
await page.screenshot({ path: ${absJ(out)} });
`
}

if (isMain(import.meta.url)) main(build)
