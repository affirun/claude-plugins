import { absJ, isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'

export function build(args) {
  need(args, 3, 'node dy-grid.mjs <space> <secUid> <out.png>')
  const [space, sec, out] = args
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
await page.goto(${j('https://www.douyin.com/user/' + sec)}, { timeout: 30000 }).catch(() => {});
await page.waitForSelector('a[href*="/video/"]', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);
const seen = new Map();
for (let k = 0; k < 4; k++) {
  const rows = await page.evaluate(() => [...document.querySelectorAll('a[href*="/video/"], a[href*="/note/"]')].map((a) => ({ id: (a.getAttribute("href").match(/(\d{15,})/) || [])[1], t: a.innerText.replace(/\s+/g, " ").slice(0, 70), note: a.getAttribute("href").includes("/note/") })));
  for (const r of rows) if (r.id && !seen.has(r.id)) seen.set(r.id, r);
  if (k === 0) await page.screenshot({ path: ${absJ(out)} });
  await page.mouse.move(700, 700); await page.mouse.wheel(0, 1800); await page.waitForTimeout(1800);
}
console.log(JSON.stringify([...seen.values()]));
`
}

if (isMain(import.meta.url)) main(build)
