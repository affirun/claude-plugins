import { absJ, isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'

export function build(args) {
  need(args, 3, 'node cp-search.mjs "<query>" <space> <out.png>')
  const [q, space, out] = args
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
await page.goto("https://www.coupang.com/", { timeout: 40000 }).catch(() => {});
await page.waitForSelector('input[name="q"]', { timeout: 15000 });
await page.click('input[name="q"]');
await page.keyboard.press("ControlOrMeta+a");
await page.keyboard.type(${j(q)});
await page.keyboard.press("Enter");
await page.waitForFunction(() => document.querySelectorAll('a[href*="/vp/products/"]').length > 4, undefined, { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(2500);
const rows = await page.evaluate(() => { const seen = new Set(); const out = []; for (const a of document.querySelectorAll('a[href*="/vp/products/"]')) { const h = a.getAttribute("href"); const id = (h.match(/products\/(\d+)/) || [])[1]; if (!id || seen.has(id)) continue; seen.add(id); const li = a.closest("li") || a; const t = li.innerText.replace(/\s+/g, " ").slice(0, 140); const im = a.querySelector("img") || li.querySelector("img"); let img = null; for (const v of [im?.currentSrc, im?.src, im?.dataset?.src, im?.dataset?.imgSrc]) if (v && v.includes("coupangcdn.com")) { img = (v.startsWith("//") ? "https:" + v : v).replace(/\/\d+x\d+ex\//, "/492x492ex/"); break; } out.push({ id, h: h.slice(0, 200), t, ad: /광고|AD/.test(t.slice(0, 10)), img }); } return out.slice(0, 24); });
console.log(JSON.stringify(rows.map((r, i) => ({ i, ...r }))));
await page.screenshot({ path: ${absJ(out)} });
`
}

if (isMain(import.meta.url)) main(build)
