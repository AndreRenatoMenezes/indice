// Conversor mínimo de itens .excalidrawlib → SVG, usando o rough.js com o seed
// de cada elemento (o mesmo motor do Excalidraw). Cobre rectangle, ellipse,
// diamond, line, arrow, draw/freedraw e text.
const rough = require('roughjs');
const { getStroke } = require('perfect-freehand');
const gen = rough.generator();

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function opts(el, extra={}) {
  const solid = (el.strokeStyle || 'solid') === 'solid';
  const o = {
    seed: el.seed || 1, roughness: el.roughness ?? 1,
    strokeWidth: solid ? el.strokeWidth : el.strokeWidth + 0.5,
    fillWeight: (el.strokeWidth||1)/2, hachureGap: (el.strokeWidth||1)*4, hachureAngle: -41,
    stroke: extra.stroke || el.strokeColor || '#1e1e1e',
    disableMultiStroke: !solid,
    preserveVertices: true,
  };
  if (el.strokeStyle === 'dashed') o.strokeLineDash = [8, 8 + el.strokeWidth];
  if (el.strokeStyle === 'dotted') o.strokeLineDash = [1.5, 6 + el.strokeWidth];
  const bg = extra.fill !== undefined ? extra.fill : el.backgroundColor;
  if (bg && bg !== 'transparent') { o.fill = bg; o.fillStyle = el.fillStyle || 'hachure'; }
  return o;
}

function cornerRadius(x, el) {
  if (el.roundness) {
    if (el.roundness.type === 2) return x * 0.25;
    const fixed = el.roundness.value ?? 32; const cutoff = fixed / 0.25;
    return x <= cutoff ? x * 0.25 : fixed;
  }
  if (el.strokeSharpness === 'round') return x * 0.25;
  return 0;
}

function pathsOf(drawable) {
  return gen.toPaths(drawable).map(p =>
    `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill||'none'}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
}

function freedrawPath(points, el) {
  const stroke = getStroke(points, { size: (el.strokeWidth||1) * 4.25, thinning: 0.6, smoothing: 0.5, streamline: 0.5, easing: t => Math.sin((t*Math.PI)/2), simulatePressure: el.simulatePressure ?? true, last: true });
  if (!stroke.length) return '';
  const d = stroke.reduce((acc,[x0,y0],i,arr)=>{ const [x1,y1]=arr[(i+1)%arr.length]; acc.push(x0.toFixed(2),y0.toFixed(2),((x0+x1)/2).toFixed(2),((y0+y1)/2).toFixed(2)); return acc; }, ['M',...stroke[0].map(n=>n.toFixed(2)),'Q']).join(' ') + ' Z';
  return `<path d="${d}" fill="${el.strokeColor}" stroke="none"/>`;
}

function arrowhead(points, el, which) {
  // ponta simples estilo Excalidraw: duas linhas a ~20° com 30px (limitadas pelo comprimento)
  const n = points.length; if (n < 2) return '';
  const [x2,y2] = which==='end' ? points[n-1] : points[0];
  const [x1,y1] = which==='end' ? points[n-2] : points[1];
  const dx = x2-x1, dy = y2-y1, len = Math.hypot(dx,dy) || 1;
  const size = Math.min(30, len*0.5) ; const ang = Math.atan2(dy,dx);
  const a = ang + Math.PI - Math.PI/9, b = ang + Math.PI + Math.PI/9;
  const p1=[x2+Math.cos(a)*size, y2+Math.sin(a)*size], p2=[x2+Math.cos(b)*size, y2+Math.sin(b)*size];
  return pathsOf(gen.linearPath([p1,[x2,y2],p2], {...opts(el), fill: undefined, fillStyle: undefined}));
}

function renderElement(el, fontFamily) {
  const t = el.type; let inner = '';
  const o = opts(el);
  if (t === 'rectangle' || t === 'embeddable' || t === 'image') {
    const w = el.width, h = el.height, r = cornerRadius(Math.min(w,h), el);
    if (r > 0) {
      const d = `M ${r} 0 L ${w-r} 0 Q ${w} 0, ${w} ${r} L ${w} ${h-r} Q ${w} ${h}, ${w-r} ${h} L ${r} ${h} Q 0 ${h}, 0 ${h-r} L 0 ${r} Q 0 0, ${r} 0`;
      inner = pathsOf(gen.path(d, o));
    } else inner = pathsOf(gen.rectangle(0,0,w,h,o));
  } else if (t === 'ellipse') {
    inner = pathsOf(gen.ellipse(el.width/2, el.height/2, el.width, el.height, {...o, curveFitting: 1}));
  } else if (t === 'diamond') {
    const w=el.width,h=el.height; inner = pathsOf(gen.polygon([[w/2,0],[w,h/2],[w/2,h],[0,h/2]], o));
  } else if (t === 'line' || t === 'arrow') {
    const pts = el.points || [[0,0]];
    const curved = el.roundness || el.strokeSharpness === 'round';
    const lo = {...o}; if (t === 'arrow' || !el.backgroundColor || el.backgroundColor==='transparent') { delete lo.fill; delete lo.fillStyle; }
    inner = pathsOf(curved && pts.length > 2 ? gen.curve(pts, lo) : gen.linearPath(pts, lo));
    if (t === 'arrow') { if ((el.endArrowhead ?? 'arrow') && el.endArrowhead !== null) inner += arrowhead(pts, el, 'end'); if (el.startArrowhead) inner += arrowhead(pts, el, 'start'); }
  } else if (t === 'freedraw' || t === 'draw') {
    inner = freedrawPath(el.points || [], el);
  } else if (t === 'text') {
    const fs = el.fontSize || 20, lh = fs * 1.25, lines = String(el.text||'').split('\n');
    const anchor = el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start';
    const x = el.textAlign === 'center' ? el.width/2 : el.textAlign === 'right' ? el.width : 0;
    const total = lines.length * lh; const top = el.verticalAlign === 'middle' ? (el.height - total)/2 : el.verticalAlign === 'bottom' ? el.height-total : 0;
    inner = lines.map((ln,i)=>`<text x="${x}" y="${(top + i*lh + fs*0.85).toFixed(2)}" font-family="${fontFamily}" font-size="${fs}" fill="${el.strokeColor}" text-anchor="${anchor}">${esc(ln)}</text>`).join('');
  } else return '';
  const cx = el.width/2, cy = el.height/2;
  const rot = el.angle ? ` rotate(${(el.angle*180/Math.PI).toFixed(3)} ${cx} ${cy})` : '';
  const op = el.opacity != null && el.opacity < 100 ? ` opacity="${el.opacity/100}"` : '';
  return `<g transform="translate(${el.x} ${el.y})${rot}"${op}>${inner}</g>`;
}

function bbox(elements) {
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for (const el of elements) {
    if (el.type==='line'||el.type==='arrow'||el.type==='freedraw'||el.type==='draw') {
      for (const [px,py] of (el.points||[[0,0]])) { x0=Math.min(x0,el.x+px); y0=Math.min(y0,el.y+py); x1=Math.max(x1,el.x+px); y1=Math.max(y1,el.y+py); }
    } else { x0=Math.min(x0,el.x); y0=Math.min(y0,el.y); x1=Math.max(x1,el.x+el.width); y1=Math.max(y1,el.y+el.height); }
  }
  return {x0,y0,x1,y1};
}

// Devolve {svg, w, h}: `svg` é um <svg> com viewBox no bbox do item (com margem), sem tamanho fixo.
function renderItem(elements, { fontFamily = 'Excalifont', pad = 6, skipText = false, style = '', extraAttrs = '' } = {}) {
  const els = elements.filter(e => !e.isDeleted && (!skipText || e.type !== 'text'));
  const b = bbox(els); const w = b.x1-b.x0+pad*2, h = b.y1-b.y0+pad*2;
  const body = els.map(e => renderElement(e, fontFamily)).join('');
  const svg = `<svg viewBox="${(b.x0-pad).toFixed(2)} ${(b.y0-pad).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"${style?` style="${style}"`:''}${extraAttrs}>${body}</svg>`;
  return { svg, w, h };
}

function loadLibrary(path) {
  const d = JSON.parse(require('fs').readFileSync(path,'utf8'));
  return d.libraryItems ? d.libraryItems.map(it => ({ name: it.name || '', elements: it.elements })) : (d.library||[]).map(g => ({ name:'', elements: g }));
}

module.exports = { renderItem, loadLibrary, gen, pathsOf, esc };
