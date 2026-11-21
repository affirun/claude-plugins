import { absJ, isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'

export function build(args) {
  need(args, 3, 'node tt-grid.mjs <handle> <space> <out.png> [scrolls=2]')
  const [handle, space, out, scrolls = '2'] = args
  const n = Number.parseInt(scrolls, 10) || 2
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
await page.goto(${j('https://www.tiktok.com/@' + handle)}, { timeout: 30000 }).catch(() => {});
await page.waitForFunction(() => document.querySelectorAll('a[href*="/video/"]').length > 0, undefined, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);
for (let k = 0; k < ${n}; k++) { await page.mouse.move(800, 700); await page.mouse.wheel(0, 1500); await page.waitForTimeout(1500); }
const rows = await page.evaluate(() => { const seen = new Set(); const out = []; for (const a of document.querySelectorAll('a[href*="/video/"]')) { const m = a.getAttribute("href").match(/@([^/]+)\/video\/(\d+)/); if (!m || seen.has(m[2])) continue; seen.add(m[2]); out.push({ handle: m[1], id: m[2], text: (a.innerText||"").replace(/\s+/g," ").slice(0,40) }); } return { n: out.length, out, body: document.body.innerText.slice(0, 300) }; });
console.log(JSON.stringify(rows));
await page.mouse.wheel(0, -5000); await page.waitForTimeout(1000);
await page.screenshot({ path: ${absJ(out)} });
`
}

if (isMain(import.meta.url)) main(build)
