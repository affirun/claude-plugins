import { absJ, isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'

export function build(args) {
  need(args, 3, 'node ig-search.mjs "<query>" <space> <out.png>')
  const [q, space, out] = args
  const url = 'https://www.instagram.com/explore/search/keyword/?q=' + encodeURIComponent(q)
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
await page.goto(${j(url)}, { timeout: 30000 }).catch(() => {});
await page.waitForFunction(() => document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').length > 3 || /No results/.test(document.body.innerText), undefined, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);
const rows = await page.evaluate(() => { const seen = new Set(); const out = []; for (const a of document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) { const h = a.getAttribute("href"); const m = h.match(/\/(?:p|reel)\/([^/]+)/); if (!m || seen.has(m[1])) continue; seen.add(m[1]); out.push({ code: m[1], h, alt: (a.querySelector("img")?.alt || "").slice(0, 100) }); } return out; });
console.log(JSON.stringify(rows.map((r, i) => ({ i, ...r }))));
await page.screenshot({ path: ${absJ(out)} });
`
}

if (isMain(import.meta.url)) main(build)
