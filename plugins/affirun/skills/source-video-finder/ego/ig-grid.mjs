import { abs, isMain, j, main, need, pageRef, spaceRef } from './lib.mjs'

export function build(args) {
  need(args, 3, 'node ig-grid.mjs <handle> <space> <out.png>')
  const [handle, space, out] = args
  return String.raw`
const task = await taskSpace(${spaceRef(space)});
const page = task.page(${pageRef()});
await page.goto(${j('https://www.instagram.com/' + handle + '/reels/')}, { timeout: 30000 }).catch(() => {});
await page.waitForFunction(() => document.querySelectorAll('a[href*="/reel/"]').length > 3, undefined, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);
const all = [];
for (let k = 0; k < 4; k++) {
  const r = await page.evaluate(() => [...document.querySelectorAll('a[href*="/reel/"]')].map(a => { const b=a.getBoundingClientRect(); return { id: a.getAttribute("href").match(/\/reel\/([^/]+)/)[1], x: Math.round(b.x), y: Math.round(b.y), t: (a.innerText||"").replace(/\s+/g," ").slice(0,30) }; }));
  for (const o of r) if (!all.find(z => z.id === o.id)) all.push({ ...o, screen: k });
  await page.screenshot({ path: ${j(abs(out))}.replace(/\.png$/, "-" + k + ".png") });
  await page.mouse.move(700,600); await page.mouse.wheel(0, 1000); await page.waitForTimeout(2000);
}
console.log(JSON.stringify(all));
`
}

if (isMain(import.meta.url)) main(build)
