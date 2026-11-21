const r = JSON.parse(require('fs').readFileSync(0, 'utf8'))
for (const x of r) console.log(x.i, x.id, x.type, Math.round((x.dur || 0) / 1000) + 's', x.author, '|', (x.desc || '').replace(/\n/g, ' ').slice(0, 60))
