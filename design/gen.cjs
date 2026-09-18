// Gera as 8 telas do Índice em estilo Excalidraw: traços via rough.js (seed por
// elemento), Excalifont (MIT, repositório excalidraw) e itens de bibliotecas MIT
// do excalidraw-libraries convertidos para SVG por xlib.cjs.
const fs = require('fs');
const { renderItem, loadLibrary, gen, esc } = require('./xlib.cjs');

const OUT = process.env.OUT_DIR || './artboards'; fs.mkdirSync(OUT, { recursive: true });

// ── fontes (assets já enviados) ──────────────────────────────────────────
const FONT_FACES = [
  ['/_blob/95bfa8127f04df518de17f01c338c501', 'U+20-7e,U+a0-a3,U+a5-a6,U+a8-ab,U+ad-b1,U+b4,U+b6-b8,U+ba-ff,U+131,U+152-153,U+2bc,U+2c6,U+2da,U+2dc,U+304,U+308,U+2013-2014,U+2018-201a,U+201c-201e,U+2020,U+2022,U+2024-2026,U+2030,U+2039-203a,U+20ac,U+2122,U+2212'],
  ['/_blob/503f4d5deed632cf4032e2829fe42058', 'U+100-130,U+132-137,U+139-149,U+14c-151,U+154-17e,U+192,U+1fc-1ff,U+218-21b,U+237,U+1e80-1e85,U+1ef2-1ef3,U+2113'],
  ['/_blob/5845bb273e5fa9ff09ac2c219b786e2b', 'U+400-45f,U+490-491,U+2116'],
  ['/_blob/f4f32def50517419c430be95b2ee226a', 'U+37e,U+384-38a,U+38c,U+38e-393,U+395-3a1,U+3a3-3a8,U+3aa-3cf,U+3d7'],
  ['/_blob/3cc6e191194d5ea6d5c463a32b67adbe', 'U+2c7,U+2d8-2d9,U+2db,U+2dd,U+302,U+306-307,U+30a-30c,U+326-328,U+212e,U+2211,U+fb01-fb02'],
  ['/_blob/3f1f4f30d38f270e78202078be3f7bf1', 'U+462-463,U+472-475,U+4d8-4d9,U+4e2-4e3,U+4e6-4e9,U+4ee-4ef'],
  ['/_blob/b894c7ced6aca39a237283fe62ab0eb6', 'U+300-301,U+303'],
];
const HELMET = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&amp;display=swap">
<style>
${FONT_FACES.map(([u,r]) => `@font-face{font-family:'Excalifont';src:url(${u}) format('woff2');unicode-range:${r};font-display:swap}`).join('\n')}
body{margin:0}
a{color:#1971c2}a:hover{color:#1864ab}
</style>`;

const F = "'Excalifont', 'Kalam', 'Segoe Print', cursive";
const INK = '#1e1e1e', MUTED = '#495057', PAPER = '#ffffff';
const C = { green: ['#b2f2bb', '#2f9e44'], yellow: ['#ffec99', '#f08c00'], red: ['#ffc9c9', '#e03131'], blue: ['#a5d8ff', '#1971c2'], violet: ['#d0bfff', '#7048e8'], gray: ['#e9ecef', '#868e96'], orange: ['#ffd8a8', '#e8590c'] };

let seed = 11; const S = () => (seed = (seed * 48271) % 2147483647);

function paths(drawable, extra = '') {
  return gen.toPaths(drawable).map(p => `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill || 'none'}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`).join('');
}
function roundRectPath(w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M ${r} 0 L ${w - r} 0 Q ${w} 0, ${w} ${r} L ${w} ${h - r} Q ${w} ${h}, ${w - r} ${h} L ${r} ${h} Q 0 ${h}, 0 ${h - r} L 0 ${r} Q 0 0, ${r} 0`;
}
function rectDrawable(w, h, o = {}) {
  const opt = { seed: o.seed ?? S(), roughness: o.roughness ?? 1, strokeWidth: o.sw ?? 1.2, stroke: o.stroke ?? INK, bowing: o.bowing ?? 1 };
  if (o.fill) { opt.fill = o.fill; opt.fillStyle = o.fillStyle ?? 'hachure'; opt.hachureGap = o.gap ?? 6; opt.fillWeight = o.fw ?? 0.7; opt.hachureAngle = -41; }
  if (o.dash) opt.strokeLineDash = [7, 7];
  if (o.single) opt.disableMultiStroke = true;
  return o.r ? gen.path(roundRectPath(w, h, o.r), opt) : gen.rectangle(0, 0, w, h, opt);
}
// Fundo desenhado que estica junto com o elemento (gera no tamanho previsto, estica no real).
function bg(w, h, o = {}) {
  const pad = 5;
  return `<svg viewBox="${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; left: ${-pad}px; top: ${-pad}px; width: calc(100% + ${pad * 2}px); height: calc(100% + ${pad * 2}px); pointer-events: none;">${paths(rectDrawable(w, h, o), ' vector-effect="non-scaling-stroke"')}</svg>`;
}
function fixed(w, h, inner, style = '') {
  const pad = 4;
  return `<svg viewBox="${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}" width="${w + pad * 2}" height="${h + pad * 2}" aria-hidden="true" style="display: block; flex-shrink: 0; margin: ${-pad}px;${style}">${inner}</svg>`;
}
function hline(w, o = {}) {
  const d = gen.line(0, 0, w, 0, { seed: o.seed ?? S(), roughness: o.roughness ?? 0.8, strokeWidth: o.sw ?? 1, stroke: o.stroke ?? INK, bowing: 0.6, disableMultiStroke: true });
  return `<svg viewBox="-2 -4 ${w + 4} 8" preserveAspectRatio="none" aria-hidden="true" style="display: block; width: 100%; height: 8px; flex-shrink: 0;">${paths(d, ' vector-effect="non-scaling-stroke"')}</svg>`;
}
function circle(d, o = {}) {
  const opt = { seed: o.seed ?? S(), roughness: o.roughness ?? 0.9, strokeWidth: o.sw ?? 1.2, stroke: o.stroke ?? INK, curveFitting: 1 };
  if (o.fill) { opt.fill = o.fill; opt.fillStyle = o.fillStyle ?? 'hachure'; opt.hachureGap = o.gap ?? 4; opt.fillWeight = 0.7; }
  if (o.dash) opt.strokeLineDash = [4, 4];
  return fixed(d, d, paths(gen.circle(d / 2, d / 2, d, opt)), o.style);
}
function checkmark(size = 22, o = {}) {
  const s = size / 22;
  return paths(gen.linearPath([[5 * s, 12 * s], [10 * s, 17 * s], [18 * s, 6 * s]], { seed: o.seed ?? S(), roughness: 0.6, strokeWidth: o.sw ?? 2, stroke: o.stroke ?? INK, disableMultiStroke: true }));
}

// ── ícones (traço à mão via rough.path) ───────────────────────────────────
const ICON_D = {
  hoje: 'M8 12 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  habitos: 'M3 12 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M8 12.5l2.5 2.5L16 9.5',
  financas: 'M3 6h18v13H3z M3 10h18M16 14h2',
  metas: 'M5 21V4M5 4h11l-2 4 2 4H5',
  midia: 'M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z',
  plus: 'M12 5v14M5 12h14',
  chevron: 'M9 6l6 6-6 6',
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  download: 'M12 4v11M7 10l5 5 5-5M4 19h16',
  arrow: 'M5 12h14M13 6l6 6-6 6',
};
function icon(name, size = 22, color = INK, sw = 1.6) {
  const d = gen.path(ICON_D[name], { seed: S(), roughness: 0.35, bowing: 0.5, strokeWidth: sw, stroke: color, disableMultiStroke: true });
  return `<svg width="${size}" height="${size}" viewBox="-1 -1 26 26" aria-hidden="true" style="flex-shrink: 0;">${paths(d)}</svg>`;
}

// ── itens das bibliotecas MIT ─────────────────────────────────────────────
const LIBS = process.env.LIBS_DIR || './excalidraw-libraries';
const kit = loadLibrary(LIBS + '/libraries/manuelernestog/universal-ui-kit.excalidrawlib');
const ux = loadLibrary(LIBS + '/libraries/gabrielamacakova/basic-ux-wireframing-elements.excalidrawlib');
const pick = (lib, n) => lib.find(i => i.name === n).elements;
function libItem(elements, size, o = {}) {
  const r = renderItem(elements, { skipText: o.skipText ?? true, pad: 4 });
  const h = o.height ?? Math.round(size * r.h / r.w);
  return r.svg.replace('<svg ', `<svg style="width: ${size}px; height: ${h}px; flex-shrink: 0; display: block;${o.style || ''}" `);
}
const LIB = {
  checked: () => libItem(pick(kit, 'Checkbox Checked'), 24),
  unchecked: () => libItem(pick(kit, 'Checkbox Unchecked'), 24),
  check: (s = 18) => libItem(pick(ux, 'Check mark'), s),
  forward: (s = 26) => libItem(pick(ux, 'Go forward arrow'), s),
};

// ── primitivas de layout ──────────────────────────────────────────────────
const NUM = 'font-variant-numeric: tabular-nums;';
function page(title, root, w, h) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${HELMET}
</helmet>
${root}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
`;
}
const NAV = [['hoje', 'Hoje', 'Main.dc.html'], ['habitos', 'Hábitos', 'Habitos.dc.html'], ['financas', 'Finanças', 'Financeiro.dc.html'], ['metas', 'Metas', 'Metas.dc.html'], ['midia', 'Mídia', 'Midia.dc.html']];
function nav(active) {
  const items = NAV.map(([k, label, href]) => {
    const on = k === active;
    const badge = on ? fixed(46, 30, paths(rectDrawable(46, 30, { r: 15, fill: C.yellow[0], fillStyle: 'solid', sw: 1.1 })), ' position: absolute; left: 50%; top: 2px; transform: translateX(-50%);') : '';
    return `<a href="${href}" aria-label="${label}" style="flex-grow: 1; flex-basis: 0; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 4px; min-height: 44px; padding-top: 6px; text-decoration: none; color: ${INK};">${badge}<span style="position: relative; display: inline-flex;">${icon(k, 22, INK, on ? 1.9 : 1.5)}</span><span style="font-size: 12px; ${on ? 'font-weight: 700;' : ''}">${label}</span></a>`;
  }).join('');
  return `<nav aria-label="Principal" style="flex-shrink: 0; height: 84px; box-sizing: border-box; padding: 4px 8px 20px 8px; display: flex; flex-direction: column; background: ${PAPER};">${hline(374, { sw: 1.4 })}<div style="display: flex; align-items: stretch; flex-grow: 1;">${items}</div></nav>`;
}
function phoneFrame() {
  return `<svg viewBox="0 0 390 844" width="390" height="844" aria-hidden="true" style="position: absolute; left: 0; top: 0; pointer-events: none;">${paths(gen.path(roundRectPath(384, 838, 40), { seed: 4242, roughness: 1.1, strokeWidth: 2.2, stroke: INK, bowing: 0.8 })).replace(/<path /g, '<path transform="translate(3 3)" ')}</svg>`;
}
function phone(inner, active, extra = '') {
  return `<div style="width: 390px; height: 844px; box-sizing: border-box; background: ${PAPER}; color: ${INK}; font-family: ${F}; font-size: 17px; line-height: 1.3; display: flex; flex-direction: column; position: relative; overflow: hidden;">` +
    `<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 14px; padding: 52px 20px 0 20px; overflow: hidden;">${inner}</div>` + nav(active) + phoneFrame() + extra + '</div>';
}
function header(kicker, title, right = '') {
  return `<div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 12px;"><div style="display: flex; flex-direction: column; gap: 2px;"><div style="font-size: 14px; color: ${MUTED};">${kicker}</div><h1 style="margin: 0; font-family: ${F}; font-size: 38px; font-weight: 400; line-height: 1;">${title}</h1></div>${right}</div>`;
}
function pill(text, color = 'green', w = 104) {
  return `<span style="position: relative; display: inline-flex; align-items: center; justify-content: center; height: 30px; width: ${w}px; font-size: 14px; color: ${INK}; white-space: nowrap;">${bg(w, 30, { r: 15, fill: C[color][0], fillStyle: 'solid', sw: 1.1 })}<span style="position: relative;">${text}</span></span>`;
}
function label(text) { return `<div style="font-size: 13px; color: ${MUTED}; letter-spacing: 0.04em; text-transform: uppercase;">${text}</div>`; }
function card(inner, o = {}) {
  const w = o.w ?? 350, h = o.h ?? 160;
  return `<section style="position: relative; box-sizing: border-box; padding: ${o.pad ?? '12px 14px'}; display: flex; flex-direction: column; gap: ${o.gap ?? 8}px;${o.style || ''}">${bg(w, h, { r: 10, sw: 1.3, fill: o.fill, fillStyle: o.fillStyle ?? 'solid', dash: o.dash })}${inner}</section>`;
}
function bullet(glyph, text, meta = '', o = {}) {
  const done = o.done, w = o.w ?? 322;
  const p = o.prio ? `<span style="color: ${C.orange[1]}; margin-left: 6px; font-size: 18px;">${'*'.repeat(o.prio)}</span>` : '';
  const m = meta ? `<span style="font-size: 14px; color: ${MUTED}; line-height: 24px; white-space: nowrap;">${meta}</span>` : '';
  const line = o.last ? '' : hline(w, { sw: 0.8, stroke: '#868e96' });
  return `<div style="display: flex; flex-direction: column;"><div style="display: flex; align-items: flex-start; gap: 10px; padding: 7px 0;"><span style="width: 20px; flex-shrink: 0; font-size: 22px; line-height: 24px; text-align: center; color: ${done ? MUTED : INK};">${glyph}</span><div style="flex-grow: 1; font-size: 17px; line-height: 24px; ${done ? `color: ${MUTED}; text-decoration: line-through;` : ''}">${text}${p}</div>${m}</div>${line}</div>`;
}
function stat(lbl, val, color = INK, size = 24) {
  return `<div style="display: flex; flex-direction: column; gap: 0; min-width: 0;"><div style="font-size: 13px; color: ${MUTED};">${lbl}</div><div style="font-size: ${size}px; line-height: 1.15; color: ${color}; ${NUM}">${val}</div></div>`;
}
function progress(w, pct, color = 'green', h = 12) {
  const inner = w * pct / 100;
  const outer = paths(rectDrawable(w, h, { sw: 1.2, r: 3, seed: S() }));
  const fill = inner > 2 ? paths(gen.rectangle(0, 0, inner, h, { seed: S(), roughness: 0.6, strokeWidth: 1, stroke: C[color][1], fill: C[color][1], fillStyle: 'hachure', hachureGap: 4, fillWeight: 1, hachureAngle: -41 })) : '';
  return fixed(w, h, fill + outer, ' width: 100%;');
}
function habitChip(name, done, streak, sub = '') {
  const w = 111, h = 66;
  const mark = done ? LIB.checked() : LIB.unchecked();
  return `<button style="position: relative; flex-grow: 1; flex-basis: 0; min-height: ${h}px; box-sizing: border-box; padding: 8px 8px 6px 8px; border: 0; background: transparent; display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 4px; font-family: ${F}; color: ${INK}; cursor: pointer; text-align: left;">${bg(w, h, { r: 8, fill: done ? C.green[0] : undefined, fillStyle: 'solid', sw: 1.2 })}<div style="position: relative; display: flex; align-items: center; gap: 6px; width: 100%;">${mark}<span style="font-size: 13px; line-height: 1.15;">${name}</span></div><div style="position: relative; display: flex; justify-content: space-between; width: 100%; font-size: 12px; color: ${MUTED}; ${NUM}"><span>${sub}</span><span>${streak}</span></div></button>`;
}
function ghostButton(text, w = 350, ic = 'plus') {
  return `<button style="position: relative; min-height: 44px; width: 100%; box-sizing: border-box; padding: 0 14px; border: 0; background: transparent; color: ${MUTED}; font-family: ${F}; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;">${bg(w, 44, { r: 8, dash: true, sw: 1.1, single: true })}${icon(ic, 18, MUTED)}<span style="position: relative;">${text}</span></button>`;
}
function primaryButton(text, w = 350) {
  return `<button style="position: relative; min-height: 50px; width: 100%; box-sizing: border-box; padding: 0 18px; border: 0; background: transparent; color: ${INK}; font-family: ${F}; font-size: 18px; cursor: pointer;">${bg(w, 50, { r: 8, fill: C.green[0], fillStyle: 'solid', sw: 1.5 })}<span style="position: relative;">${text}</span></button>`;
}
function row(left, right, o = {}) {
  const sub = o.sub ? `<div style="font-size: 13px; color: ${MUTED};">${o.sub}</div>` : '';
  return `<div style="display: flex; flex-direction: column;"><div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 7px 0;"><div style="display: flex; flex-direction: column; min-width: 0;"><div style="font-size: 16px;">${left}</div>${sub}</div><div style="font-size: 16px; ${NUM} white-space: nowrap;">${right}</div></div>${o.last ? '' : hline(o.w ?? 322, { sw: 0.8, stroke: '#868e96' })}</div>`;
}
function tx(date, desc, sub, amount, o = {}) {
  return `<div style="display: flex; flex-direction: column;"><div style="display: flex; align-items: center; gap: 10px; padding: 7px 0;"><span style="font-size: 13px; color: ${MUTED}; ${NUM} width: 42px; flex-shrink: 0;">${date}</span><div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column;"><span style="font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${desc}</span><span style="font-size: 12px; color: ${MUTED};">${sub}</span></div><span style="font-size: 16px; color: ${o.positive ? C.green[1] : INK}; ${NUM} white-space: nowrap;">${amount}</span></div>${o.last ? '' : hline(o.w ?? 322, { sw: 0.8, stroke: '#868e96' })}</div>`;
}

// ── 1. HOJE ───────────────────────────────────────────────────────────────
const hoje = [
  header('sexta · 18 set 2026', 'Hoje', pill('Tranquilo', 'green')),
  card(label('Bullets') +
    `<div style="display: flex; flex-direction: column;">${bullet('•', 'Revisar schema do Índice', '09:00', { prio: 2 })}${bullet('×', 'Rodar migração inicial', '', { done: true })}${bullet('–', 'Ideia: exportar metas para o Colab', '', { last: true })}</div>` +
    `<div style="position: relative; display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 10px;">${bg(322, 40, { r: 6, dash: true, sw: 1, single: true, stroke: '#868e96' })}<span style="position: relative; width: 20px; text-align: center; font-size: 22px; color: ${MUTED};">•</span><input type="text" aria-label="Novo bullet" placeholder="novo bullet" style="position: relative; flex-grow: 1; border: 0; background: transparent; font-family: ${F}; font-size: 17px; color: ${INK}; padding: 6px 0; outline: none;"></div>` +
    `<div style="display: flex; flex-direction: column; gap: 2px; padding-top: 4px;">${label('De dias anteriores')}<div style="display: flex; align-items: center; gap: 10px; min-height: 36px;"><span style="font-size: 13px; color: ${MUTED}; ${NUM}">15/09</span><span style="flex-grow: 1; font-size: 16px;">Ligar para o banco</span><a href="Main.dc.html" style="display: inline-flex; align-items: center; gap: 4px; font-size: 15px; text-decoration: none; color: ${INK}; min-height: 44px;">migrar ${LIB.forward(28)}</a></div></div>`,
    { h: 270 }),
  `<div style="display: flex; flex-direction: column; gap: 6px;">${label('Hábitos')}<div style="display: flex; gap: 8px;">${habitChip('Acordar às 5:30', true, '1 dia', '05:20')}${habitChip('Corrida / Exercícios', false, '0 dias', '30 min')}${habitChip('Estudo Faculdade', false, '0 dias', '60 min')}</div></div>`,
  card(`<div style="display: flex; justify-content: space-between; align-items: baseline;">${label('Financeiro · setembro')}<span style="font-size: 13px; color: ${MUTED}; ${NUM}">12 dias restantes</span></div>` +
    `<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;">${stat('Saldo do mês', 'R$ 4.955')}${stat('Por dia', 'R$ 413', C.green[1])}${stat('Gasto hoje', 'R$ 45')}</div>` +
    hline(322, { sw: 0.8, stroke: '#868e96' }) + `<div style="display: flex; justify-content: space-between; font-size: 14px;"><span style="color: ${MUTED};">Fatura Nubank · vence 05/11</span><span style="${NUM}">R$ 120,50</span></div>`, { h: 130 }),
  card(`<div style="display: flex; justify-content: space-between; align-items: baseline;"><div style="display: flex; align-items: center; gap: 8px;">${icon('home', 18)}<span style="font-size: 17px;">Comprar nossa casinha</span></div><span style="font-size: 14px; color: ${MUTED}; ${NUM}">1,25%</span></div>` +
    progress(322, 1.25) +
    `<div style="display: flex; justify-content: space-between; font-size: 13px; color: ${MUTED}; ${NUM}"><span>até 05/08/2035 · 3.243 dias</span><span>R$ 1.096/mês</span></div>` +
    `<div style="display: flex; justify-content: space-between; font-size: 14px; padding-top: 2px;"><span style="color: ${MUTED};">Lendo <span style="color: ${INK};">Bullet Journal Method</span></span><span style="color: ${MUTED}; ${NUM}">112/320 págs</span></div>`, { h: 118, gap: 6 }),
].join('');
fs.writeFileSync(`${OUT}/Main.dc.html`, page('Hoje', phone(hoje, 'hoje'), 390, 844));

// ── 2. HÁBITOS ────────────────────────────────────────────────────────────
const DAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
function dots(states) {
  return `<div style="display: flex; justify-content: space-between; gap: 4px;">${DAYS.map((d, i) => {
    const s = states[i];
    const dot = s === 'done' ? circle(18, { fill: C.green[1], fillStyle: 'hachure', stroke: C.green[1], gap: 3 }) : s === 'today' ? circle(18, { sw: 1.8 }) : s === 'off' ? circle(18, { stroke: '#adb5bd', dash: true, sw: 1 }) : circle(18, { stroke: '#868e96', sw: 1 });
    return `<div style="display: flex; flex-direction: column; align-items: center; gap: 2px;"><span style="font-size: 11px; color: ${MUTED};">${d}</span>${dot}</div>`;
  }).join('')}</div>`;
}
function habitCard(name, kind, states, streak, done, sub = '') {
  const mark = done
    ? `<button aria-label="Desmarcar ${esc(name)}" style="position: relative; width: 48px; height: 48px; border: 0; background: transparent; padding: 0; cursor: pointer; flex-shrink: 0;">${fixed(48, 48, paths(gen.circle(24, 24, 46, { seed: S(), roughness: 1, strokeWidth: 1.6, stroke: INK, fill: C.green[0], fillStyle: 'solid', curveFitting: 1 })) + `<g transform="translate(13 13)">${checkmark(22, { sw: 2.4 })}</g>`, ' position: absolute; left: 0; top: 0;')}</button>`
    : `<button aria-label="Marcar ${esc(name)}" style="position: relative; width: 48px; height: 48px; border: 0; background: transparent; padding: 0; cursor: pointer; flex-shrink: 0;">${fixed(48, 48, paths(gen.circle(24, 24, 46, { seed: S(), roughness: 1, strokeWidth: 1.6, stroke: INK, curveFitting: 1 })), ' position: absolute; left: 0; top: 0;')}</button>`;
  const subhtml = sub ? `<span style="color: ${C.green[1]};">${sub}</span> · ` : '';
  return card(`<div style="display: flex; align-items: center; gap: 10px;"><div style="flex-grow: 1; display: flex; flex-direction: column;"><div style="font-size: 18px;">${name}</div><div style="font-size: 13px; color: ${MUTED};">${subhtml}${kind}</div></div><div style="display: flex; flex-direction: column; align-items: flex-end;"><span style="font-size: 24px; line-height: 1; ${NUM}">${streak}</span><span style="font-size: 11px; color: ${MUTED};">sequência</span></div>${mark}</div>` + dots(states), { h: 128, gap: 10 });
}
const habitos = [
  header('semana 14 – 20 set', 'Hábitos', pill('2 de 3 hoje', 'green', 110)),
  habitCard('Acordar às 5:30', 'todo dia · até 05:30', ['done', 'done', 'miss', 'done', 'done', 'off', 'off'], '1', true, '05:20 hoje'),
  habitCard('Corrida / Exercícios', 'todo dia · 30 min', ['done', 'miss', 'done', 'miss', 'today', 'off', 'off'], '0', false),
  habitCard('Estudo Faculdade', 'seg – sex · 60 min', ['done', 'done', 'done', 'done', 'today', 'off', 'off'], '4', false),
  card(`<div style="display: flex; justify-content: space-between; align-items: baseline;">${label('Consistência · 30 dias')}<span style="font-size: 22px; ${NUM}">71%</span></div>${progress(322, 71, 'green', 10)}<div style="font-size: 13px; color: ${MUTED};">Meta vinculada: <span style="color: ${INK};">Estudo Faculdade → Formatura</span></div>`, { h: 92, gap: 6 }),
  ghostButton('Novo hábito'),
].join('');
fs.writeFileSync(`${OUT}/Habitos.dc.html`, page('Hábitos', phone(habitos, 'habitos'), 390, 844));

// ── 3. FINANCEIRO ─────────────────────────────────────────────────────────
const fab = `<a href="Lancar.dc.html" aria-label="Lançamento rápido" style="position: absolute; right: 20px; bottom: 100px; width: 58px; height: 58px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;">${fixed(58, 58, paths(gen.circle(29, 29, 56, { seed: S(), roughness: 1, strokeWidth: 1.8, stroke: INK, fill: C.green[0], fillStyle: 'solid', curveFitting: 1 })), ' position: absolute; left: 0; top: 0;')}<span style="position: relative;">${icon('plus', 28, INK, 2.2)}</span></a>`;
const financeiroInner = [
  header('setembro 2026', 'Financeiro', pill('Tranquilo', 'green')),
  card(`<div style="display: flex; justify-content: space-between; align-items: flex-end;">${stat('Saldo do mês', 'R$ 4.955,00', INK, 34)}<span style="font-size: 13px; color: ${MUTED}; ${NUM} padding-bottom: 6px;">12 dias restantes</span></div>` +
    `<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;">${stat('Por dia', 'R$ 412,92', C.green[1], 19)}${stat('Gasto hoje', 'R$ 45,00', INK, 19)}${stat('Contas abertas', 'R$ 0,00', INK, 19)}</div>` +
    hline(322, { sw: 0.8, stroke: '#868e96' }) + `<div style="font-size: 14px; color: ${MUTED};">Sua média diária é R$ 3 — há folga.</div>`, { h: 170, gap: 10, fill: C.yellow[0] }),
  card(label('Contas') + `<div style="display: flex; flex-direction: column;">${row('Conta corrente', 'R$ 5.955,00', { sub: 'corrente · padrão' })}${row('Carteira', 'R$ 0,00', { sub: 'dinheiro', last: true })}</div>`, { h: 118, gap: 4 }),
  card(label('Faturas') + row('Nubank · 11/2026', 'R$ 120,50', { sub: 'aberta · fecha 25/10 · vence 05/11', last: true }), { h: 76, gap: 4 }),
  card(label('Últimos lançamentos') + `<div style="display: flex; flex-direction: column;">${tx('26/09', 'Mercado', 'crédito · Roxinho ····1234 · fatura 11/26', '− R$ 120,50')}${tx('18/09', 'Almoço', 'pix · Conta corrente', '− R$ 45,00')}${tx('05/09', 'Salário', 'entrada · Conta corrente', '+ R$ 5.000,00', { positive: true, last: true })}</div>`, { h: 176, gap: 4 }),
].join('');
fs.writeFileSync(`${OUT}/Financeiro.dc.html`, page('Financeiro', phone(financeiroInner, 'financas', fab), 390, 844));

// ── 4. LANÇAMENTO RÁPIDO ──────────────────────────────────────────────────
function seg(items, active, w = 350) {
  const n = items.length, iw = (w - 8) / n;
  return `<div style="position: relative; display: flex; gap: 0; padding: 4px; min-height: 44px; box-sizing: border-box;">${bg(w, 44, { r: 8, sw: 1.1 })}${items.map(it => `<button style="position: relative; flex-grow: 1; flex-basis: 0; min-height: 36px; border: 0; background: transparent; font-family: ${F}; font-size: 16px; color: ${it === active ? INK : MUTED}; cursor: pointer;">${it === active ? bg(iw, 36, { r: 6, fill: C.green[0], fillStyle: 'solid', sw: 1 }) : ''}<span style="position: relative;">${it}</span></button>`).join('')}</div>`;
}
function chips(items, active) {
  return `<div style="display: flex; gap: 8px; flex-wrap: wrap;">${items.map(it => { const w = 22 + it.length * 9; return `<button style="position: relative; min-height: 36px; width: ${w}px; border: 0; background: transparent; font-family: ${F}; font-size: 15px; color: ${INK}; cursor: pointer; white-space: nowrap;">${bg(w, 36, { r: 18, fill: it === active ? C.blue[0] : undefined, fillStyle: 'solid', sw: it === active ? 1.3 : 1 })}<span style="position: relative;">${it}</span></button>`; }).join('')}</div>`;
}
function field(lbl, val) {
  return `<div style="display: flex; flex-direction: column;"><div style="display: flex; justify-content: space-between; align-items: center; min-height: 44px;"><span style="font-size: 15px; color: ${MUTED};">${lbl}</span><span style="font-size: 16px; display: inline-flex; align-items: center; gap: 4px;">${val}${icon('chevron', 16, MUTED)}</span></div>${hline(350, { sw: 0.8, stroke: '#868e96' })}</div>`;
}
const sheet = `<div style="position: absolute; left: 0; top: 0; width: 390px; height: 844px; background: rgba(255,255,255,0.72);"></div>` +
  `<div style="position: absolute; left: 0; bottom: 0; width: 390px; box-sizing: border-box; padding: 14px 20px 34px 20px; display: flex; flex-direction: column; gap: 14px;">${bg(390, 560, { r: 24, fill: PAPER, fillStyle: 'solid', sw: 2 })}` +
  `<div style="position: relative; align-self: center;">${fixed(44, 6, paths(gen.line(0, 3, 44, 3, { seed: S(), roughness: 0.8, strokeWidth: 3, stroke: '#868e96', disableMultiStroke: true })))}</div>` +
  `<div style="position: relative; display: flex; justify-content: space-between; align-items: center;"><h2 style="margin: 0; font-family: ${F}; font-size: 26px; font-weight: 400;">Lançamento rápido</h2><span style="font-size: 13px; color: ${MUTED};">Hoje · 18/09</span></div>` +
  `<div style="position: relative;">${seg(['Saída', 'Entrada', 'Aporte'], 'Saída')}</div>` +
  `<div style="position: relative; display: flex; flex-direction: column; gap: 2px;"><label for="valor" style="font-size: 13px; color: ${MUTED};">Valor</label><div style="display: flex; align-items: baseline; gap: 8px;"><span style="font-size: 26px; color: ${MUTED};">R$</span><input id="valor" type="text" inputmode="decimal" value="45,00" style="border: 0; background: transparent; font-family: ${F}; font-size: 52px; color: ${INK}; width: 100%; padding: 0; outline: none; ${NUM}"></div>${hline(350, { sw: 1.4 })}</div>` +
  `<div style="position: relative; display: flex; flex-direction: column; gap: 4px;"><label for="desc" style="font-size: 13px; color: ${MUTED};">Descrição</label><div style="position: relative; min-height: 44px; display: flex; align-items: center; padding: 0 12px;">${bg(350, 44, { r: 8, sw: 1.1 })}<input id="desc" type="text" value="Almoço" style="position: relative; border: 0; background: transparent; font-family: ${F}; font-size: 17px; color: ${INK}; width: 100%; outline: none;"></div></div>` +
  `<div style="position: relative;">${chips(['Pix', 'Débito', 'Crédito', 'Dinheiro'], 'Pix')}</div>` +
  `<div style="position: relative; display: flex; flex-direction: column;">${field('Conta', 'Conta corrente')}${field('Categoria', 'Lanche')}</div>` +
  `<div style="position: relative;">${primaryButton('Lançar saída de R$ 45,00')}</div></div>`;
fs.writeFileSync(`${OUT}/Lancar.dc.html`, page('Lançamento rápido', phone(financeiroInner, 'financas', sheet), 390, 844));

// ── 5. METAS ──────────────────────────────────────────────────────────────
function kv(k, v, color = INK) { return `<div style="display: flex; flex-direction: column;"><span style="font-size: 13px; color: ${MUTED};">${k}</span><span style="font-size: 17px; color: ${color}; ${NUM}">${v}</span></div>`; }
const metas = [
  header('1 ativa', 'Metas', ''),
  card(`<div style="display: flex; align-items: center; gap: 10px;"><span style="position: relative; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center;">${bg(44, 44, { r: 8, fill: C.green[0], fillStyle: 'solid', sw: 1.1 })}<span style="position: relative;">${icon('home', 24)}</span></span><div style="flex-grow: 1; display: flex; flex-direction: column;"><div style="font-size: 22px; line-height: 1.1;">Comprar nossa casinha</div><div style="font-size: 13px; color: ${MUTED};">financeira · prioridade 1 · até 05/08/2035</div></div></div>` +
    `<div style="display: flex; align-items: baseline; justify-content: space-between;"><span style="font-size: 34px; line-height: 1; ${NUM}">R$ 1.500</span><span style="font-size: 14px; color: ${MUTED}; ${NUM}">de R$ 120.000 · 1,25%</span></div>` +
    progress(322, 1.25, 'green', 14) +
    `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; padding-top: 2px;">${kv('Faltam', '3.243 dias')}${kv('Necessário por mês', 'R$ 1.096')}${kv('Ritmo atual', 'R$ 2.647/mês', C.green[1])}${kv('Projeção no ritmo', 'mai 2030', C.green[1])}</div>`, { h: 236, gap: 10, pad: '14px' }),
  card(label('Marcos') + `<div style="display: flex; flex-direction: column;">${row('Reserva de emergência', 'R$ 15.000', { sub: 'até dez 2027' })}${row('Entrada', 'R$ 60.000', { sub: 'até ago 2031' })}${row('Escritura e mudança', 'R$ 120.000', { sub: 'até ago 2035', last: true })}</div>`, { h: 170, gap: 4 }),
  card(label('Aportes') + tx('10/09', 'Primeiro aporte', 'manual · nota: começo', '+ R$ 1.500,00', { positive: true, last: true }) +
    `<div style="display: flex; gap: 8px; align-items: center;"><div style="flex-grow: 1;">${ghostButton('Registrar aporte', 230)}</div><a href="Metas.dc.html" style="display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 8px; font-size: 15px; text-decoration: none; color: ${INK};">${icon('download', 18)}CSV</a></div>`, { h: 132, gap: 6 }),
  ghostButton('Nova meta'),
].join('');
fs.writeFileSync(`${OUT}/Metas.dc.html`, page('Metas', phone(metas, 'metas'), 390, 844));

// ── 6. MÍDIA ──────────────────────────────────────────────────────────────
function mediaItem(kind, title, creator, meta, o = {}) {
  const col = { Livro: 'green', Jogo: 'orange', Curso: 'violet' }[kind];
  const bar = o.pct != null ? progress(250, o.pct, col, 8) : '';
  return `<div style="display: flex; flex-direction: column;"><div style="display: flex; gap: 12px; padding: 8px 0;"><span style="position: relative; width: 48px; height: 64px; flex-shrink: 0; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px; box-sizing: border-box;">${bg(48, 64, { r: 4, fill: C[col][0], fillStyle: 'hachure', gap: 5, sw: 1.1 })}<span style="position: relative; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;">${kind}</span></span><div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; justify-content: center;"><div style="font-size: 17px; line-height: 1.15;">${title}</div><div style="font-size: 13px; color: ${MUTED};">${creator}</div><div style="display: flex; justify-content: space-between; font-size: 13px; color: ${MUTED}; ${NUM}"><span>${meta}</span><span style="color: ${INK};">${o.stars || ''}</span></div>${bar}</div></div>${o.last ? '' : hline(322, { sw: 0.8, stroke: '#868e96' })}</div>`;
}
const midia = [
  header('livros, jogos e mais', 'Mídia', ''),
  seg(['Todos', 'Livros', 'Jogos', 'Cursos'], 'Todos'),
  card(label('Em andamento') + `<div style="display: flex; flex-direction: column;">${mediaItem('Livro', 'Bullet Journal Method', 'Ryder Carroll', '112 de 320 páginas · 35%', { pct: 35 })}${mediaItem('Jogo', '[jogo em andamento]', '[estúdio] · [plataforma]', '[progresso]', { pct: 0, last: true })}</div>`, { h: 212, gap: 2 }),
  card(label('Quero') + mediaItem('Curso', '[curso da faculdade]', '[instituição]', 'adicionado hoje', { last: true }), { h: 112, gap: 2 }),
  card(label('Concluídos · 2026') + mediaItem('Livro', '[último livro lido]', '[autor]', 'terminado em [data]', { last: true, stars: '8/10' }), { h: 112, gap: 2 }),
  ghostButton('Novo item'),
].join('');
fs.writeFileSync(`${OUT}/Midia.dc.html`, page('Mídia', phone(midia, 'midia'), 390, 844));

// ── 7. WIDGET ─────────────────────────────────────────────────────────────
function wrow(name, done, right, last = false) {
  return `<div style="display: flex; flex-direction: column;"><button aria-label="${esc(name)}" style="display: flex; align-items: center; gap: 10px; min-height: 40px; width: 100%; box-sizing: border-box; padding: 0 2px; border: 0; background: transparent; font-family: ${F}; color: ${INK}; cursor: pointer; text-align: left;">${done ? LIB.checked() : LIB.unchecked()}<span style="flex-grow: 1; font-size: 15px; ${done ? `color: ${MUTED}; text-decoration: line-through;` : ''}">${name}</span><span style="font-size: 13px; color: ${MUTED}; ${NUM}">${right}</span></button>${last ? '' : hline(300, { sw: 0.8, stroke: '#868e96' })}</div>`;
}
const widget = `<div style="width: 340px; height: 200px; box-sizing: border-box; background: ${PAPER}; color: ${INK}; font-family: ${F}; position: relative; padding: 14px 18px 10px 18px; display: flex; flex-direction: column; gap: 4px;">${bg(340, 200, { r: 28, sw: 2, fill: PAPER, fillStyle: 'solid' })}` +
  `<div style="position: relative; display: flex; justify-content: space-between; align-items: baseline;"><span style="font-size: 17px;">Índice · hábitos</span><span style="font-size: 12px; color: ${MUTED}; text-transform: uppercase;">sex 18</span></div>` +
  `<div style="position: relative; display: flex; flex-direction: column;">${wrow('Acordar às 5:30', true, '05:20 · 1d')}${wrow('Corrida / Exercícios', false, '30 min')}${wrow('Estudo Faculdade', false, '60 min', true)}</div></div>`;
fs.writeFileSync(`${OUT}/Widget.dc.html`, page('Widget de hábitos', widget, 340, 200));

// ── 8. WEB ────────────────────────────────────────────────────────────────
const COLW = 378.67, LEFTW = 781.33;
function wcard(title, inner, aside = '', o = {}) {
  const w = o.w ?? COLW, h = o.h ?? 200;
  return `<section style="position: relative; box-sizing: border-box; padding: 16px 20px; display: flex; flex-direction: column; gap: ${o.gap ?? 10}px;">${bg(w, h, { r: 10, sw: 1.3, fill: o.fill, fillStyle: 'solid' })}<div style="display: flex; justify-content: space-between; align-items: baseline;">${label(title)}${aside}</div>${inner}</section>`;
}
const topnav = ['Hoje', 'Financeiro', 'Hábitos', 'Metas', 'Mídia'].map((t, i) => `<a href="Web.dc.html" style="position: relative; font-size: 16px; color: ${i === 0 ? INK : MUTED}; text-decoration: none; padding: 4px 2px;">${t}${i === 0 ? `<span style="position: absolute; left: 0; right: 0; bottom: -4px; display: block;">${hline(44, { sw: 2 })}</span>` : ''}</a>`).join('');
const web = `<div style="width: 1280px; height: 900px; box-sizing: border-box; background: ${PAPER}; color: ${INK}; font-family: ${F}; font-size: 16px; line-height: 1.3; display: flex; flex-direction: column; overflow: hidden;">` +
  `<header style="height: 60px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 48px;"><div style="display: flex; align-items: center; gap: 36px; height: 52px;"><span style="font-size: 24px;">Índice</span><nav aria-label="Principal" style="display: flex; gap: 24px;">${topnav}</nav><span style="margin-left: auto; font-size: 14px; color: ${MUTED};">sexta · 18 set 2026</span></div>${hline(1184, { sw: 1.4 })}</header>` +
  `<div style="flex-grow: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; padding: 28px 48px; align-content: start;">` +
  `<div style="grid-column: span 2; display: flex; flex-direction: column; gap: 24px;">` +
  wcard('Hoje · 18/09 · sexta',
    `<div style="display: flex; flex-direction: column;">${bullet('•', 'Revisar schema do Índice', '09:00', { prio: 2, w: 741 })}${bullet('×', 'Rodar migração inicial', '', { done: true, w: 741 })}${bullet('○', 'Revisão do PR #1 com o time', '16:00', { w: 741 })}${bullet('–', 'Ideia: exportar metas para o Colab', '', { last: true, w: 741 })}</div>` +
    `<div style="display: flex; gap: 10px; align-items: center;"><span style="width: 20px; text-align: center; font-size: 22px; color: ${MUTED};">•</span><div style="position: relative; flex-grow: 1; min-height: 40px; display: flex; align-items: center; padding: 0 12px;">${bg(600, 40, { r: 6, sw: 1, single: true, stroke: '#868e96', dash: true })}<input type="text" aria-label="Novo bullet" placeholder="novo bullet" style="position: relative; width: 100%; border: 0; background: transparent; font-family: ${F}; font-size: 16px; color: ${INK}; outline: none;"></div><button style="position: relative; min-height: 40px; width: 110px; border: 0; background: transparent; font-family: ${F}; font-size: 16px; color: ${INK}; cursor: pointer;">${bg(110, 40, { r: 6, fill: C.green[0], fillStyle: 'solid', sw: 1.3 })}<span style="position: relative;">Adicionar</span></button></div>` +
    `<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 6px;">${hline(741, { sw: 0.8, stroke: '#868e96' })}${label('Pendentes de dias anteriores')}<div style="display: flex; align-items: center; gap: 12px; min-height: 36px;"><span style="font-size: 13px; color: ${MUTED}; ${NUM}">15/09</span><span style="flex-grow: 1;">Ligar para o banco</span><a href="Web.dc.html" style="display: inline-flex; align-items: center; gap: 6px; font-size: 15px; text-decoration: none; color: ${INK};">migrar para hoje ${LIB.forward(28)}</a></div></div>`, pill('Tranquilo', 'green'), { w: LEFTW, h: 330 }) +
  wcard('Hábitos', `<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;">${habitChip('Acordar às 5:30', true, '1 dia', '05:20')}${habitChip('Corrida / Exercícios', false, '0 dias', '30 min')}${habitChip('Estudo Faculdade', false, '4 dias', '60 min · seg–sex')}</div>`, `<span style="font-size: 13px; color: ${MUTED};">consistência 30 dias · 71%</span>`, { w: LEFTW, h: 140 }) +
  `</div><div style="display: flex; flex-direction: column; gap: 24px;">` +
  wcard('Financeiro · setembro', `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">${stat('Saldo do mês', 'R$ 4.955,00', INK, 24)}${stat('Por dia', 'R$ 412,92', C.green[1], 24)}${stat('Gasto hoje', 'R$ 45,00', INK, 24)}${stat('Dias restantes', '12', INK, 24)}</div><div style="font-size: 14px; color: ${MUTED};">Sua média diária é R$ 3 — há folga.</div>${hline(338, { sw: 0.8, stroke: '#868e96' })}<div style="display: flex; justify-content: space-between; font-size: 14px;"><span style="color: ${MUTED};">Fatura Nubank · vence 05/11</span><span style="${NUM}">R$ 120,50</span></div>`, pill('Tranquilo', 'green'), { h: 236, fill: C.yellow[0] }) +
  wcard('Metas', `<div style="display: flex; justify-content: space-between; font-size: 16px;"><span>Comprar nossa casinha</span><span style="color: ${MUTED}; ${NUM}">1,25%</span></div>${progress(338, 1.25)}<div style="display: flex; justify-content: space-between; font-size: 13px; color: ${MUTED}; ${NUM}"><span>até 05/08/2035</span><span>R$ 1.096/mês</span></div>`, '', { h: 122 }) +
  wcard('Em andamento', `<div style="display: flex; justify-content: space-between; font-size: 16px;"><span>Bullet Journal Method <span style="font-size: 13px; color: ${MUTED};">livro</span></span><span style="font-size: 14px; color: ${MUTED}; ${NUM}">112/320</span></div>${progress(338, 35, 'green', 8)}`, '', { h: 96 }) +
  `</div></div></div>`;
fs.writeFileSync(`${OUT}/Web.dc.html`, page('Índice Web · Hoje', web, 1280, 900));

console.log('ok', fs.readdirSync(OUT).filter(f => f.endsWith('.dc.html')).map(f => `${f}:${fs.statSync(`${OUT}/${f}`).size}`).join(' '));
