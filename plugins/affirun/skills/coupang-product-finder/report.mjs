import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [root, outFile] = process.argv.slice(2)
const tmp = join(root, '_img')
mkdirSync(tmp, { recursive: true })

function img(src, width, name) {
  if (!src || !existsSync(src)) return null
  const out = join(tmp, name)
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-frames:v', '1', '-vf', `scale='min(${width},iw)':-2`, '-q:v', '5', out])
    return `data:image/jpeg;base64,${readFileSync(out).toString('base64')}`
  } catch {
    return null
  }
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const won = (n) => (typeof n === 'number' ? `${n.toLocaleString('ko-KR')}원` : null)
const read = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null)

const TONE = [
  [/^번호로 찾음|^링크 페이지에서 찾음|같은 상품\)?$|: 같은 상품|: 같은 모델/, 'ok'],
  [/같은 모델|블록만|모델이 다름|비슷한/, 'mid'],
  [/.*/, 'no'],
]
const tone = (o) => TONE.find(([re]) => re.test(o || ''))[1]

const cards = []
const rows = []
for (const code of readdirSync(root).filter((d) => existsSync(join(root, d, 'result.json'))).sort()) {
  const dir = join(root, code)
  const r = read(join(dir, 'result.json'))
  const c = read(join(dir, 'coupang.json'))
  const productFile = readdirSync(dir).find((f) => /^product\./.test(f))
  const sheet = img(join(dir, existsSync(join(dir, 'sheet.jpg')) ? 'sheet.jpg' : 'cover.jpg'), 1400, `${code}-sheet.jpg`)
  const block = img(productFile && join(dir, productFile), 420, `${code}-block.jpg`)
  const shot = img(join(dir, 'coupang.jpg'), 760, `${code}-coupang.jpg`)

  const linkPage = { outcome: r.outcome, name: r.productName ?? r.blockTitle, price: r.price, url: r.productUrl, option: r.option, check: r.pictureCheck }
  const cands = (c?.candidates ?? []).map((k, i) => ({ ...k, img: img(k.image && join(dir, k.image), 360, `${code}-cand${i}.jpg`) }))
  const final = cands.length ? { name: cands[0].title, price: cands[0].price, url: cands[0].productUrl } : c?.productUrl ? { outcome: c.outcome, name: c.productName, price: c.price, url: c.productUrl, option: c.option, check: c.pictureCheck } : linkPage
  const outcome = c?.outcome ?? r.outcome
  rows.push({ code, username: r.username, words: r.productWords, outcome, url: final.url, price: final.price, n: cands.length })

  const alts = [...(r.alternatives ?? []), ...(cands.length ? [] : (c?.alternatives ?? []))]
  const part = (title, p, image) =>
    `<div class="part">${image ? `<img class="thumb" src="${image}" alt="">` : ''}<div>
      <p class="label">${esc(title)}</p>
      <p class="name">${esc(p.name ?? '상품 없음')}</p>
      ${won(p.price) ? `<p class="price">${won(p.price)}${p.option ? ` · ${esc(p.option)}` : ''}</p>` : ''}
      ${p.url ? `<p><a class="btn" href="${esc(p.url)}" target="_blank" rel="noreferrer">쿠팡에서 보기</a></p><p class="url">${esc(p.url)}</p>` : ''}
      ${p.check ? `<p class="note">${esc(p.check)}</p>` : ''}
    </div></div>`

  cards.push(`<section id="${code}">
    <header>
      <div><h2>${esc(r.productWords)}</h2>
      <p class="meta">@${esc(r.username)}${typeof r.plays === 'number' ? ` · 조회 ${r.plays.toLocaleString('ko-KR')}` : ''}${r.captionNumber != null ? ` · 캡션 번호 ${esc(r.captionNumber)}` : ' · 캡션에 번호 없음'} · <a href="${esc(r.permalink)}" target="_blank" rel="noreferrer">릴스 열기</a></p></div>
      <span class="badge ${tone(outcome)}">${esc(outcome)}</span>
    </header>
    ${sheet ? `<img class="sheet" src="${sheet}" alt="릴스 장면">` : ''}
    ${part(`계정 링크 페이지 · ${r.outcome}`, linkPage, block)}
    ${cands.length ? `<p class="label" style="margin-top:16px">${esc(c.outcome)}</p><div class="cands">${cands.map((k, i) => `<div class="cand">${k.img ? `<img src="${k.img}" alt="">` : ''}<p><span class="badge ${k.grade === '비슷한 상품' ? 'mid' : 'ok'}">${i + 1}. ${esc(k.grade)}</span></p><p class="name">${esc(k.title)}</p><p class="price">${won(k.price) ?? ''}${k.rocket ? ` · ${esc(k.rocket)}` : ''}${k.reviews != null ? ` · 후기 ${Number(k.reviews).toLocaleString('ko-KR')}` : ''}</p>${k.option ? `<p class="note">옵션: ${esc(k.option)}</p>` : ''}<p class="note">릴스와 차이: ${esc(k.differs)}${k.opened ? '' : ' (검색 결과 카드로만 확인)'}</p>${k.productUrl ? `<p><a class="btn" href="${esc(k.productUrl)}" target="_blank" rel="noreferrer">쿠팡에서 보기</a></p>` : ''}</div>`).join('')}</div>` : ''}
    ${c && !cands.length ? part(`쿠팡 검색 · ${c.outcome}`, { outcome: c.outcome, name: c.productName, price: c.price, url: c.productUrl, option: c.option, check: c.pictureCheck }, shot) : ''}
    ${alts.length ? `<div class="alts"><p class="label">같이 나온 상품</p><ul>${alts.map((a) => `<li>${a.productUrl ? `<a href="${esc(a.productUrl)}" target="_blank" rel="noreferrer">${esc(a.title)}</a>` : esc(a.title)}${won(a.price) ? ` · ${won(a.price)}` : ''}</li>`).join('')}</ul></div>` : ''}
    ${[c ? null : r.notChecked, c?.notes].filter(Boolean).map((n) => `<p class="note">확인 못 한 것: ${esc(n)}</p>`).join('')}
    ${c?.queries?.length ? `<details><summary>쿠팡 검색어 ${c.queries.length}개</summary><ul>${c.queries.map((q) => `<li><b>${esc(q.query)}</b>: ${esc(q.firstScreens)}</li>`).join('')}</ul></details>` : ''}
  </section>`)
}

const found = rows.filter((r) => r.url).length
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>쿠팡 상품 찾기 결과</title><style>
:root{--bg:#fff;--fg:#111;--sub:#666;--line:#e6e6ea;--tile:#f5f5f7;--ok:#0a7a3d;--okbg:#e5f6ec;--mid:#8a5a00;--midbg:#fdf1d8;--no:#a11;--nobg:#fde8e8;--link:#3b3bd6}
@media (prefers-color-scheme:dark){:root{--bg:#0e0e12;--fg:#f2f2f4;--sub:#a0a0aa;--line:#2a2a33;--tile:#191920;--ok:#6fdc9d;--okbg:#12301f;--mid:#f2c264;--midbg:#3a2c0c;--no:#ff9a9a;--nobg:#3a1414;--link:#a9a9ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard",sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 80px}h1{font-size:26px;font-weight:800;letter-spacing:-.02em;margin:0 0 6px}
.lede{color:var(--sub);margin:0 0 20px}table{width:100%;border-collapse:collapse;font-size:14px}.wrap{overflow-x:auto;margin-bottom:36px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--sub);font-weight:600;white-space:nowrap}td:first-child{min-width:210px}td:nth-child(4),td:nth-child(5){white-space:nowrap}
section{padding:28px 0;border-top:1px solid var(--line)}header{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
h2{font-size:18px;font-weight:700;margin:0}.meta{margin:2px 0 0;color:var(--sub);font-size:13px}a{color:var(--link)}
.badge{display:inline-block;padding:4px 11px;border-radius:999px;font-size:13px;font-weight:600;white-space:nowrap}.ok{color:var(--ok);background:var(--okbg)}.mid{color:var(--mid);background:var(--midbg)}.no{color:var(--no);background:var(--nobg)}
.sheet{width:100%;border-radius:12px;display:block;margin-bottom:14px}.part{display:flex;flex-direction:column;gap:14px;background:var(--tile);border-radius:16px;padding:14px;margin-top:10px}
@media(min-width:640px){.part{flex-direction:row}}.thumb{width:100%;max-width:260px;border-radius:10px;align-self:flex-start}
.label{font-size:12px;color:var(--sub);margin:0 0 2px;font-weight:600}.name{font-weight:700;margin:0}.price{margin:2px 0 0}.note{color:var(--sub);font-size:13px;margin:8px 0 0}
.btn{display:inline-block;margin-top:8px;padding:9px 16px;border-radius:999px;background:var(--fg);color:var(--bg);text-decoration:none;font-weight:600;font-size:14px}
.url{font-size:12px;color:var(--sub);word-break:break-all;margin:6px 0 0}.alts{margin-top:12px}.cands{display:grid;grid-template-columns:1fr;gap:10px;margin-top:6px}@media(min-width:560px){.cands{grid-template-columns:repeat(2,1fr)}}@media(min-width:860px){.cands{grid-template-columns:repeat(3,1fr)}}.cand{background:var(--tile);border-radius:16px;padding:12px}.cand img{width:100%;border-radius:10px;display:block;margin-bottom:8px}.cand p{margin:4px 0 0}ul{margin:4px 0 0;padding-left:18px}details{margin-top:10px;font-size:13px;color:var(--sub)}
</style></head><body><main>
<h1>쿠팡 상품 찾기 결과</h1>
<p class="lede">릴스 ${rows.length}개 중 ${found}개에서 쿠팡 상품 주소를 얻었습니다. 계정 링크 페이지에서 찾은 것은 그 계정이 실제로 건 상품이고, 쿠팡 검색으로 찾은 것은 가까운 순서의 후보 목록입니다. 주소는 모두 수수료 태그를 뗀 상품 주소입니다.</p>
<div class="wrap"><table><thead><tr><th>상품</th><th>계정</th><th>결과</th><th>가격</th><th>링크</th></tr></thead><tbody>
${rows.map((r) => `<tr><td><a href="#${r.code}">${esc(r.words)}</a></td><td>@${esc(r.username)}</td><td><span class="badge ${tone(r.outcome)}">${esc(r.outcome)}</span></td><td>${won(r.price) ?? ''}</td><td>${r.n ? `<a href="#${r.code}">후보 ${r.n}개</a>` : r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noreferrer">쿠팡</a>` : ''}</td></tr>`).join('\n')}
</tbody></table></div>
${cards.join('\n')}
</main></body></html>`
writeFileSync(outFile, html)
console.log(`${rows.length} reels, ${found} with a product, ${(html.length / 1e6).toFixed(1)} MB -> ${outFile}`)
