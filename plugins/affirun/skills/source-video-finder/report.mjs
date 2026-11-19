#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, extname } from 'node:path'

const [, , inPath, outPath] = process.argv
if (!inPath || !outPath) {
  console.error('usage: node report.mjs <run.json> <out.html>')
  process.exit(1)
}
const run = JSON.parse(readFileSync(inPath, 'utf8'))

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
function img(path, cls = '') {
  if (!path || !existsSync(path)) return `<div class="frame missing ${cls}">no frame</div>`
  const data = readFileSync(path).toString('base64')
  return `<img class="frame ${cls}" loading="lazy" src="data:${MIME[extname(path).toLowerCase()] ?? 'image/jpeg'};base64,${data}" alt="">`
}

const PLATFORM = { tiktok: '틱톡', douyin: '더우인', rednote: '레드노트', '1688': '1688' }
const TIER_ORDER = ['S+', 'S', 'A', 'B', 'C']
const tierRank = (t) => {
  const i = TIER_ORDER.indexOf(t)
  return i === -1 ? 99 : i
}

const cands = [...(run.candidates ?? [])].sort(
  (a, b) => Number(!!b.sameShoot) - Number(!!a.sameShoot) || Number(a.match === 'similar') - Number(b.match === 'similar') || tierRank(a.tier) - tierRank(b.tier),
)
const targets = run.targets ?? []
const byPlatform = {}
for (const c of cands) byPlatform[c.platform] = (byPlatform[c.platform] ?? 0) + 1
const sameShoot = cands.filter((c) => c.sameShoot).length

function card(c, i) {
  const frames = (c.frames ?? []).map((f) => img(f)).join('')
  const copies = (c.copies ?? []).length
    ? `<div class="copies">같은 영상 재업로드: ${c.copies.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, ''))}</a>`).join(', ')}</div>`
    : ''
  return `<article class="card${c.sameShoot ? ' same' : ''}">
  <header>
    <span class="rank">${i + 1}</span>
    <span class="tier t-${esc(c.tier).replace('+', 'p')}">${esc(c.tier)}</span>
    ${c.sameShoot ? '<span class="badge shoot">같은 촬영분</span>' : ''}
    ${c.match === 'similar' ? '<span class="badge">비슷한 상품</span>' : ''}
    <span class="badge">${esc(PLATFORM[c.platform] ?? c.platform)}</span>
    <span class="account">${esc(c.account)}</span>
    ${c.lengthSec ? `<span class="len">${esc(c.lengthSec)}초</span>` : ''}
  </header>
  <div class="frames">${frames}</div>
  <p class="note">${esc(c.note)}</p>
  ${copies}
  <a class="open" href="${esc(c.url)}" target="_blank" rel="noopener">영상 열기</a>
</article>`
}

const rows = (list, cols) =>
  list.length
    ? `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${list
        .map((r) => `<tr>${cols.map((c) => `<td>${c[1](r)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`
    : '<p class="muted">없음</p>'
const link = (r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.account || r.url)}</a>`

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>원본 영상 찾기 ${esc(run.reel?.code)}</title>
<style>
:root{--bg:#f7f7f8;--fg:#18181b;--muted:#71717a;--card:#fff;--line:#e4e4e7;--accent:#7c5cf5;--hl:#fde047}
@media (prefers-color-scheme:dark){:root{--bg:#0c0c0f;--fg:#f4f4f5;--muted:#a1a1aa;--card:#18181b;--line:#27272a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 12px}h3{font-size:16px;margin:24px 0 4px}
.muted{color:var(--muted)}.summary{margin:8px 0 0}
.stats{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.stat{background:var(--card);border-radius:999px;padding:4px 12px;font-size:13px}
.reel{display:flex;gap:6px;overflow-x:auto;padding:8px 0}.reel .frame{height:180px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.card{background:var(--card);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:8px}
.card.same{outline:2px solid var(--accent)}
.card header{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.rank{font-weight:800;color:var(--muted)}.account{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px}.len{color:var(--muted);font-size:13px}
.tier{font-weight:800;border-radius:6px;padding:0 8px;background:#e4e4e7;color:#18181b}
.t-Sp{background:#16a34a;color:#fff}.t-S{background:#22c55e;color:#fff}.t-A{background:#3b82f6;color:#fff}.t-B{background:#f59e0b;color:#fff}.t-C{background:#ef4444;color:#fff}
.badge{font-size:12px;border-radius:999px;padding:1px 8px;background:var(--line)}.badge.shoot{background:var(--hl);color:#18181b;font-weight:700}
.frames{display:flex;gap:4px;overflow-x:auto}.frame{height:220px;border-radius:8px;background:#000;flex:none}
.frame.missing{width:120px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px;background:var(--line)}
.note{margin:0;font-size:14px}.copies{font-size:12px;color:var(--muted);word-break:break-all}
.open{align-self:flex-start;background:var(--fg);color:var(--bg);text-decoration:none;border-radius:999px;padding:6px 14px;font-weight:600;min-height:40px;display:inline-flex;align-items:center}
.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px;background:var(--card);border-radius:12px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}td:last-child{white-space:normal}
a{color:var(--accent)}
@media (max-width:480px){.frame{height:170px}.grid{grid-template-columns:1fr}}
</style></head><body><main>
<h1>${esc(run.reel?.label ?? run.reel?.code)}</h1>
<div class="muted">${esc(run.reel?.code)} · ${run.mode === 'thorough' ? '꼼꼼 모드' : '빠른 모드'} · <a href="${esc(run.reel?.url)}" target="_blank" rel="noopener">릴스 열기</a></div>
${run.summary ? `<p class="summary">${esc(run.summary)}</p>` : ''}
<div class="stats"><span class="stat">쓸 만한 영상 ${cands.length}개</span>${sameShoot ? `<span class="stat">같은 촬영분 ${sameShoot}개</span>` : ''}${Object.entries(byPlatform)
  .map(([p, n]) => `<span class="stat">${esc(PLATFORM[p] ?? p)} ${n}</span>`)
  .join('')}<span class="stat">검색 ${(run.searches ?? []).length}번</span></div>
<h2>릴스 장면</h2>
<div class="reel">${(run.reel?.frames ?? []).map((f) => img(f)).join('')}</div>
<h2>찾은 영상</h2>
<p class="muted">같은 촬영분이 맨 위, 그다음 자막 등급 순. 장면은 확인할 때 캡처한 것입니다.</p>
${
  targets.length
    ? targets
        .map((t, ti) => {
          const own = cands.filter((c) => c.target === ti)
          const tried = (run.searches ?? []).filter((s) => s.target === ti).length
          return `<h3>${esc(t.label)} <span class="muted">${own.length ? `${own.length}개` : '못 찾았어요'}</span></h3>
${t.note || tried ? `<p class="muted">${esc([t.note, tried ? `검색 ${tried}번` : null].filter(Boolean).join(' · '))}</p>` : ''}
${own.length ? `<div class="grid">${own.map(card).join('')}</div>` : ''}`
        })
        .join('') +
      (cands.some((c) => !(c.target >= 0 && c.target < targets.length))
        ? `<h3>그 밖의 영상</h3><div class="grid">${cands
            .filter((c) => !(c.target >= 0 && c.target < targets.length))
            .map(card)
            .join('')}</div>`
        : '')
    : `<div class="grid">${cands.map(card).join('')}</div>`
}
<h2>비슷한 다른 모델</h2>
${rows(run.near ?? [], [['플랫폼', (r) => esc(PLATFORM[r.platform] ?? r.platform)], ['계정', link], ['메모', (r) => esc(r.note)]])}
<h2>제외한 것</h2>
${rows(run.excluded ?? [], [['플랫폼', (r) => esc(PLATFORM[r.platform] ?? r.platform)], ['계정', link], ['이유', (r) => esc(r.reason)]])}
<h2>검색 기록</h2>
${rows(run.searches ?? [], [['플랫폼', (r) => esc(PLATFORM[r.platform] ?? r.platform)], ['대상', (r) => esc(targets[r.target]?.label ?? '')], ['검색어', (r) => esc(r.query)], ['같은 제품', (r) => esc(r.same)], ['비슷', (r) => esc(r.near)], ['메모', (r) => esc(r.note)]])}
${(run.blocked ?? []).length ? `<h2>막힌 것</h2><ul>${run.blocked.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
</main></body></html>`

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, html)
console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(0)} KB, ${cands.length} candidates)`)
