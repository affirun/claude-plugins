import { absJ, isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'

export function build(args) {
  need(args, 3, 'node tt-search.mjs "<query>" <space> <out.png>')
  const [q, space, out] = args
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
await page.goto("https://www.tiktok.com/", { timeout: 30000 }).catch(() => {});
await page.waitForSelector('[data-e2e="nav-search"]', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.click('[data-e2e="nav-search"]');
await page.keyboard.press("ControlOrMeta+a");
await page.keyboard.insertText(${j(q)});
await page.keyboard.press("Enter");
await page.waitForURL(/\/search/, { timeout: 20000 }).catch(() => {});
await page.waitForFunction((q) => decodeURIComponent(location.search).replace(/\+/g, " ").includes(q) && document.querySelectorAll('a[href*="/video/"]').length > 4, ${j(q)}, { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(2500);
const rows = await page.evaluate(() => {
  const seen = new Set(); const out = [];
  for (const a of document.querySelectorAll('a[href*="/video/"]')) {
    const m = a.getAttribute("href").match(/@([^/]+)\/video\/(\d+)/); if (!m || seen.has(m[2])) continue; seen.add(m[2]);
    let el = a; for (let i = 0; i < 6 && el && el.innerText.trim().length < 5; i++) el = el.parentElement;
    out.push({ handle: m[1], id: m[2], text: (el?.innerText || "").replace(/\s+/g, " ").slice(0, 90) });
  }
  return out;
});
const searched = await page.evaluate(() => decodeURIComponent(location.search).slice(0, 120));
console.log("# searched: " + searched);
console.log(JSON.stringify(rows.map((r, i) => ({ i, ...r }))));
await page.screenshot({ path: ${absJ(out)} });
`
}

if (isMain(import.meta.url)) main(build)
