
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, r=document)=> r.querySelector(s);
  const $$ = (s, r=document)=> Array.from(r.querySelectorAll(s));

  const panels = $$('.panel');
  const menuItems = $$('.menu-item');
  const cursor = $('.menu .cursor');
  const sfx = { move: $('#sfx-move'), confirm: $('#sfx-confirm'), back: $('#sfx-back') };

  // ---------- Audio / year
  function play(name){
    const on = JSON.parse(localStorage.getItem('audioOn') ?? 'true');
    if(!on) return;
    const a = sfx[name]; if(!a) return;
    try{ a.currentTime=0; a.play(); }catch{}
  }
  const btnAudio = $('#btn-audio');
  function setAudio(on){
    localStorage.setItem('audioOn', JSON.stringify(on));
    btnAudio?.setAttribute('aria-pressed', String(on));
    const label = btnAudio?.querySelector('span');
    if(label) label.textContent = on ? 'Sound' : 'Muted';
  }
  setAudio(JSON.parse(localStorage.getItem('audioOn') ?? 'true'));
  btnAudio?.addEventListener('click', ()=> setAudio(!JSON.parse(localStorage.getItem('audioOn') ?? 'true')));

  const yearEl = $('#year');
  if(yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ---------- Cursor + Panels
  let sel = 0;
  function updateCursor(){
    if(!cursor) return;
    const el = menuItems[sel];
    if(!el) return;
    menuItems.forEach(mi => mi.classList.toggle('selected', mi === el));
    const r = el.getBoundingClientRect(), pr = el.parentElement.getBoundingClientRect();
    cursor.style.transform = `translateY(${r.top - pr.top - 4}px)`;
  }

  function setActivePanel(id){
    panels.forEach(p => p.classList.toggle('active', p.id === `panel-${id}`));
  }

  function openPanel(id){
    setActivePanel(id);
    if(id !== 'home') play('confirm'); else play('back');
    if(location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
    if(id === 'experience') startKPI();
    if(id === 'home') requestAnimationFrame(() => requestAnimationFrame(() => bootHomeHud()));
    else if (typeof stopHudLoops === 'function') stopHudLoops();
  }

  menuItems.forEach((item, i)=>{
    item.addEventListener('mouseenter', ()=>{ sel=i; updateCursor(); });
    item.addEventListener('click', ()=>{ sel=i; updateCursor(); openPanel(item.dataset.panel); });
  });

  window.addEventListener('keydown', (e)=>{
    if(e.code==='ArrowUp' || e.code==='KeyW'){ e.preventDefault(); sel=(sel-1+menuItems.length)%menuItems.length; updateCursor(); play('move'); }
    if(e.code==='ArrowDown' || e.code==='KeyS'){ e.preventDefault(); sel=(sel+1)%menuItems.length; updateCursor(); play('move'); }
    if(e.code==='Enter'){
      e.preventDefault();
      if($('#panel-home')?.classList.contains('active')){
        const idx = menuItems.findIndex(mi=> mi.dataset.panel==='projects');
        if(idx>=0){ sel=idx; updateCursor(); openPanel('projects'); }
        return;
      }
      menuItems[sel]?.click();
    }
    if(e.code==='Escape'){ e.preventDefault(); openPanel('home'); sel = menuItems.findIndex(mi=> mi.dataset.panel==='home'); updateCursor(); }
    if(e.code==='KeyM'){ setAudio(!JSON.parse(localStorage.getItem('audioOn') ?? 'true')); }
  });

  window.addEventListener('hashchange', ()=> {
    const id = (location.hash || '#home').slice(1);
    const idx = menuItems.findIndex(mi => mi.dataset.panel === id);
    if(idx >= 0){ sel = idx; updateCursor(); openPanel(id); }
  });

  // ---------- Typewriter subline
  (function(){
    const el = document.querySelector('.type-line');
    if(!el) return;
    let lines = [];
    try{ lines = JSON.parse(el.dataset.rotate || '[]'); }catch{ lines = []; }
    if(!lines.length) return;
    let i=0;
    function setLine(s){
      if(el.childNodes[0]?.nodeType===3){ el.childNodes[0].textContent = s+' '; }
      else { el.insertBefore(document.createTextNode(s+' '), el.firstChild); }
    }
    function tick(){
      setLine(lines[i % lines.length]);
      i++;
      setTimeout(tick, 2200);
    }
    tick();
  })();

  // ---------- Experience KPI
  window.startKPI = function(){
    const nums = document.querySelectorAll('.kpi .num');
    nums.forEach(el=>{
      const target = Number(el.dataset.target || '0');
      const dur = 900; const start = performance.now();
      function step(t){
        const p = Math.min(1, (t - start) / dur);
        el.textContent = Math.floor(target * p);
        if(p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  };

  // ---------- Hero CTA (projects)
  $$('.cta').forEach(b => b.addEventListener('click', ()=> {
    const id = b.dataset.goto || 'projects';
    const idx = menuItems.findIndex(mi=> mi.dataset.panel===id);
    if(idx>=0){ sel=idx; updateCursor(); openPanel(id); }
  }));

  // ---------- Init
  const startId = (location.hash || '#home').slice(1);
  const startIdx = menuItems.findIndex(mi => mi.dataset.panel === startId);
  sel = startIdx >= 0 ? startIdx : 0;
  updateCursor();
  openPanel(menuItems[sel].dataset.panel);
});

/* HUD panels stay visible — no cycle */

const hudMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const hudReduce = () => hudMQ.matches;
const hudAccent = () => (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#d71e2b').trim() || '#d71e2b';

const hudLoops = {
  gaugeRaf: [],
  radialRaf: [],
  sparkTimers: [],
  logoTimer: null,
  sparkPoints: new Map()
};
let hudInventoryHover = false;

function setGaugePct(ring, pct){
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  ring.style.setProperty('--pct', String(v));
  ring.style.background = `conic-gradient(var(--accent) ${v}%, rgba(255,255,255,.08) 0)`;
}

function stopHudLoops(){
  hudLoops.gaugeRaf.forEach(id => cancelAnimationFrame(id));
  hudLoops.radialRaf.forEach(id => cancelAnimationFrame(id));
  hudLoops.sparkTimers.forEach(id => clearInterval(id));
  hudLoops.gaugeRaf = [];
  hudLoops.radialRaf = [];
  hudLoops.sparkTimers = [];
  if(hudLoops.logoTimer){ clearInterval(hudLoops.logoTimer); hudLoops.logoTimer = null; }
}

function easeOutCubic(p){ return 1 - Math.pow(1 - p, 3); }

function replayCssIntros(){
  if(hudReduce()) return;
  const els = [
    ...document.querySelectorAll('.hud-module'),
    ...document.querySelectorAll('.logo-cell')
  ];
  els.forEach(el => { el.style.animation = 'none'; });
  void document.querySelector('.hud-stage')?.offsetWidth;
  els.forEach(el => { el.style.animation = ''; });
}

function animateGauges(){
  hudLoops.gaugeRaf.forEach(id => cancelAnimationFrame(id));
  hudLoops.gaugeRaf = [];
  const rings = document.querySelectorAll('.gauge-cell .ring');
  rings.forEach((ring, idx) => {
    const span = ring.querySelector('span');
    const targetPct = Number(ring.dataset.pct || '0');
    const to = Number(span?.dataset.to || '0');
    const suffix = span?.dataset.suffix ?? '';
    if(hudReduce() || !span){
      setGaugePct(ring, targetPct);
      if(span) span.textContent = to + suffix;
      return;
    }
    setGaugePct(ring, 0);
    span.textContent = to + suffix;
    const delay = idx * 40;
    const dur = 520;
    const t0 = performance.now();
    function step(now){
      const p = Math.min(1, Math.max(0, (now - t0 - delay) / dur));
      const e = easeOutCubic(p);
      setGaugePct(ring, targetPct * e);
      if(span) span.textContent = Math.round(to * e) + suffix;
      if(p < 1){
        const id = requestAnimationFrame(step);
        hudLoops.gaugeRaf.push(id);
      }
    }
    const id = requestAnimationFrame(step);
    hudLoops.gaugeRaf.push(id);
  });
}

function drawRadial(cv, value){
  const DPR = Math.min(devicePixelRatio || 1, 2);
  const accent = hudAccent();
  const grid = 'rgba(255,255,255,.12)';
  const ink  = 'rgba(233,237,245,.92)';
  const w = cv.clientWidth || 0;
  const h = cv.clientHeight || 0;
  if(w < 36 || h < 36) return;
  cv.width = w * DPR; cv.height = h * DPR;
  const ctx = cv.getContext('2d');
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const cx = w/2, cy = h/2 + 4, r = Math.max(8, Math.min(w,h)/2 - 10);

  ctx.strokeStyle = grid; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();

  ctx.strokeStyle = accent; ctx.lineCap='round'; ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + Math.PI*2*value, false);
  ctx.stroke();

  ctx.fillStyle = ink; ctx.font = 'bold 14px ui-sans-serif, system-ui';
  const label = Math.round(value*100)+'%';
  const tw = ctx.measureText(label).width;
  ctx.fillText(label, cx - tw/2, cy + 5);
}

function drawSparkFrame(cv, pts, dashProgress = 1){
  const DPR = Math.min(devicePixelRatio || 1, 2);
  const accent = hudAccent();
  const grid = 'rgba(255,255,255,.12)';
  const w = cv.clientWidth || 0;
  const h = cv.clientHeight || 0;
  if(w < 36 || h < 24) return;
  cv.width = w * DPR; cv.height = h * DPR;
  const ctx = cv.getContext('2d');
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if(!pts.length) return;

  const min = Math.min(...pts), max = Math.max(...pts);
  const nx = i => pts.length === 1 ? w/2 : (i/(pts.length-1)) * (w-10) + 5;
  const ny = v => h - ((v - min) / Math.max(1e-6, (max-min))) * (h-10) - 5;

  ctx.strokeStyle = grid; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, h-1.5); ctx.lineTo(w, h-1.5); ctx.stroke();

  ctx.beginPath(); ctx.moveTo(nx(0), ny(pts[0]));
  let pathLen = 0;
  let px = nx(0), py = ny(pts[0]);
  for(let i=1;i<pts.length;i++){
    const x = nx(i), y = ny(pts[i]);
    pathLen += Math.hypot(x - px, y - py);
    ctx.lineTo(x, y);
    px = x; py = y;
  }
  ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const len = Math.max(1, pathLen);
  ctx.setLineDash([len, len]);
  ctx.lineDashOffset = len * (1 - dashProgress);
  ctx.stroke();
  ctx.setLineDash([]);

  if(dashProgress >= 0.98){
    const lx = nx(pts.length-1), ly = ny(pts[pts.length-1]);
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI*2); ctx.fill();
  }
}

function parseSparkPoints(cv){
  return (cv.dataset.points || '1,2,3').split(',').map(x=>parseFloat(x)).filter(n => !Number.isNaN(n));
}

function startSparkLive(cv){
  const key = cv.dataset.spark || cv;
  let pts = hudLoops.sparkPoints.get(key);
  if(!pts){ pts = parseSparkPoints(cv).slice(); hudLoops.sparkPoints.set(key, pts); }
  const timer = setInterval(() => {
    if(!document.querySelector('#panel-home')?.classList.contains('active')) return;
    const last = pts[pts.length-1] ?? 8;
    const next = Math.max(1, last + (Math.random() - 0.42) * 2.4);
    pts.push(Math.round(next * 10) / 10);
    if(pts.length > 16) pts.shift();
    drawSparkFrame(cv, pts, 1);
  }, 1200);
  hudLoops.sparkTimers.push(timer);
}

// ===== HUD mini-graphs (radial + sparkline) =====
function drawHudCanvases(opts = {}){
  const animate = opts.animate !== false && !hudReduce();
  const homeOn = document.querySelector('#panel-home')?.classList.contains('active');

  hudLoops.radialRaf.forEach(id => cancelAnimationFrame(id));
  hudLoops.radialRaf = [];

  document.querySelectorAll('canvas[data-radial]').forEach((cv, idx) => {
    const value = Math.max(0, Math.min(1, parseFloat(cv.dataset.value || '0')));
    if(!animate || !homeOn){
      drawRadial(cv, value);
      return;
    }
    const delay = idx * 40;
    const dur = 520;
    const t0 = performance.now();
    function step(now){
      const p = Math.min(1, Math.max(0, (now - t0 - delay) / dur));
      drawRadial(cv, value * easeOutCubic(p));
      if(p < 1){
        const id = requestAnimationFrame(step);
        hudLoops.radialRaf.push(id);
      }
    }
    const id = requestAnimationFrame(step);
    hudLoops.radialRaf.push(id);
  });

  document.querySelectorAll('canvas[data-spark]').forEach(cv => {
    const key = cv.dataset.spark || cv;
    if(!hudLoops.sparkPoints.has(key) || opts.reset){
      hudLoops.sparkPoints.set(key, parseSparkPoints(cv).slice());
    }
    const pts = hudLoops.sparkPoints.get(key);
    if(!animate || !homeOn){
      drawSparkFrame(cv, pts, 1);
      return;
    }
    const t0 = performance.now();
    const dur = 520;
    function step(now){
      const p = Math.min(1, (now - t0) / dur);
      drawSparkFrame(cv, pts, easeOutCubic(p));
      if(p < 1){
        const id = requestAnimationFrame(step);
        hudLoops.radialRaf.push(id);
      } else if(!hudReduce()){
        startSparkLive(cv);
      }
    }
    const id = requestAnimationFrame(step);
    hudLoops.radialRaf.push(id);
  });
}

function startLogoIdle(){
  if(hudLoops.logoTimer){ clearInterval(hudLoops.logoTimer); hudLoops.logoTimer = null; }
  const cells = Array.from(document.querySelectorAll('.logo-cell'));
  if(!cells.length || hudReduce()) return;
  const inventory = document.querySelector('.logo-inventory');
  let i = 0;
  if(inventory && !inventory.dataset.idleBound){
    inventory.dataset.idleBound = '1';
    inventory.addEventListener('mouseenter', () => { hudInventoryHover = true; });
    inventory.addEventListener('mouseleave', () => { hudInventoryHover = false; });
    inventory.addEventListener('focusin', () => { hudInventoryHover = true; });
    inventory.addEventListener('focusout', (e) => {
      if(!inventory.contains(e.relatedTarget)) hudInventoryHover = false;
    });
  }
  hudLoops.logoTimer = setInterval(() => {
    if(!document.querySelector('#panel-home')?.classList.contains('active')) return;
    if(hudInventoryHover || inventory?.matches(':hover')) return;
    cells.forEach(c => c.classList.remove('is-hot'));
    cells[i % cells.length].classList.add('is-hot');
    i = (i + 1) % cells.length;
  }, 700);
}

function bootHomeHud(){
  stopHudLoops();
  replayCssIntros();
  animateGauges();
  drawHudCanvases({ animate: true, reset: true });
  startLogoIdle();
}

window.addEventListener('resize', () => drawHudCanvases({ animate: false }));

// —— HUD feed rotator (fade/slide instead of hard swap) ——
(function(){
  const SPEED = 2200;
  const feeds = [...document.querySelectorAll('.feed')];
  feeds.forEach(ul=>{
    const items = (ul.dataset.rotate || '').split(',').map(s=>s.trim()).filter(Boolean);
    if(!items.length) return;
    let i = 0;
    const li = document.createElement('li');
    ul.appendChild(li);
    function apply(){
      li.textContent = items[i];
      i = (i+1) % items.length;
      li.classList.remove('is-out');
      li.classList.add('is-in');
    }
    function tick(){
      if(hudReduce()){
        if(!li.textContent) apply();
        return;
      }
      li.classList.remove('is-in');
      li.classList.add('is-out');
      setTimeout(apply, 240);
    }
    apply();
    if(hudReduce()) return;
    let timer = setInterval(tick, SPEED);
    ul.addEventListener('mouseenter', ()=> clearInterval(timer));
    ul.addEventListener('mouseleave', ()=> { clearInterval(timer); timer = setInterval(tick, SPEED); });
  });
})();

// —— HUD pointer tooltip ——
(function(){
  const tip = document.getElementById('hud-tip');
  if(!tip) return;
  if(tip.parentElement !== document.body) document.body.appendChild(tip);
  const sel = '.gauge-cell, .logo-cell, .protocol-list li, .radial, .spark';
  const hot = new Set();

  function esc(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function contentFor(el){
    const name = el.dataset.name || el.querySelector('.graph-label')?.textContent?.trim() || el.querySelector('.proto')?.textContent?.trim() || '';
    const cat = el.dataset.cat || '';
    const detail = el.dataset.detail || '';
    if(!name && !detail) return '';
    let html = '';
    if(name) html += `<span class="tip-name">${esc(name)}</span>`;
    if(cat) html += `<span class="tip-cat">${esc(cat)}</span>`;
    if(detail) html += `<span class="tip-detail">${esc(detail)}</span>`;
    return html;
  }

  function place(e){
    const x = (e.clientX ?? 0);
    const y = (e.clientY ?? 0);
    const pad = 14;
    tip.style.left = '0px';
    tip.style.top = '0px';
    const tw = tip.offsetWidth || 160;
    const th = tip.offsetHeight || 48;
    let left = x + pad;
    let top = y + pad;
    if(left + tw > innerWidth - 8) left = x - tw - pad;
    if(top + th > innerHeight - 8) top = y - th - pad;
    if(left < 8) left = 8;
    if(top < 8) top = 8;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function show(el, e){
    const html = contentFor(el);
    if(!html) return;
    tip.innerHTML = html;
    tip.hidden = false;
    place(e);
    el.classList.add('is-hot');
    hot.add(el);
  }

  function hide(el){
    if(el){ el.classList.remove('is-hot'); hot.delete(el); }
    if(!hot.size) tip.hidden = true;
  }

  document.querySelectorAll(sel).forEach(el => {
    el.addEventListener('mouseenter', (e) => show(el, e));
    el.addEventListener('mousemove', (e) => { if(!tip.hidden) place(e); });
    el.addEventListener('mouseleave', () => hide(el));
    el.addEventListener('focus', () => {
      const r = el.getBoundingClientRect();
      show(el, { clientX: r.left + r.width/2, clientY: r.bottom });
    });
    el.addEventListener('blur', () => hide(el));
  });
})();


// —— Projects dossier filter (scoped; does not touch Home HUD) ——
(function(){
  const root = document.getElementById('panel-projects');
  if(!root) return;
  const chips = Array.from(root.querySelectorAll('.dossier-chip'));
  const cards = Array.from(root.querySelectorAll('.dossier'));
  if(!chips.length || !cards.length) return;

  function apply(filter){
    chips.forEach(c => {
      const on = c.dataset.filter === filter;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-pressed', String(on));
    });
    cards.forEach(card => {
      const lane = card.dataset.lane || '';
      const show = filter === 'all' || lane === filter;
      card.classList.toggle('is-off', !show);
    });
    root.classList.toggle('is-filtered', filter !== 'all');
  }

  chips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      apply(chip.dataset.filter || 'all');
    });
  });
})();
