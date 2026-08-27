
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
    if(id === 'home') requestAnimationFrame(drawHudCanvases);
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
    let i=0, txt='', removing=false;
    function tick(){
      const full = lines[i % lines.length];
      txt = removing ? full.slice(0, txt.length-1) : full.slice(0, txt.length+1);
      if(el.childNodes[0]?.nodeType===3){ el.childNodes[0].textContent = txt+' '; }
      else { el.insertBefore(document.createTextNode(txt+' '), el.firstChild); }
      if(!removing && txt===full){ removing=true; setTimeout(tick, 1200); return; }
      if(removing && txt===''){ removing=false; i++; }
      setTimeout(tick, removing ? 22 : 30);
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

// ===== HUD mini-graphs (radial + sparkline) =====
function drawHudCanvases(){
  const DPR = Math.min(devicePixelRatio || 1, 2);
  const accent = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#d71e2b').trim() || '#d71e2b';
  const grid = 'rgba(255,255,255,.12)';
  const ink  = 'rgba(233,237,245,.92)';

  document.querySelectorAll('canvas[data-radial]').forEach(cv=>{
    const value = Math.max(0, Math.min(1, parseFloat(cv.dataset.value || '0')));
    const w = Math.max(cv.clientWidth || 140, 40);
    const h = Math.max(cv.clientHeight || 86, 40);
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
  });

  document.querySelectorAll('canvas[data-spark]').forEach(cv=>{
    const pts = (cv.dataset.points || '1,2,3').split(',').map(x=>parseFloat(x));
    const w = Math.max(cv.clientWidth || 160, 40);
    const h = Math.max(cv.clientHeight || 48, 24);
    cv.width = w * DPR; cv.height = h * DPR;
    const ctx = cv.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...pts), max = Math.max(...pts);
    const nx = i => (i/(pts.length-1)) * (w-10) + 5;
    const ny = v => h - ((v - min) / Math.max(1e-6, (max-min))) * (h-10) - 5;

    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h-1.5); ctx.lineTo(w, h-1.5); ctx.stroke();

    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(nx(0), ny(pts[0]));
    for(let i=1;i<pts.length;i++) ctx.lineTo(nx(i), ny(pts[i]));
    ctx.stroke();

    const lx = nx(pts.length-1), ly = ny(pts[pts.length-1]);
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI*2); ctx.fill();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  drawHudCanvases();
  requestAnimationFrame(drawHudCanvases);
});
window.addEventListener('resize', () => drawHudCanvases());

// —— HUD feed rotator (cycles bullet text) ——
(function(){
  const SPEED = 2200;
  const feeds = [...document.querySelectorAll('.feed')];
  feeds.forEach(ul=>{
    const items = (ul.dataset.rotate || '').split(',').map(s=>s.trim()).filter(Boolean);
    if(!items.length) return;
    let i = 0;
    const li = document.createElement('li');
    ul.appendChild(li);
    function tick(){
      li.textContent = items[i];
      i = (i+1) % items.length;
    }
    tick();
    let timer = setInterval(tick, SPEED);
    ul.addEventListener('mouseenter', ()=> clearInterval(timer));
    ul.addEventListener('mouseleave', ()=> timer = setInterval(tick, SPEED));
  });
})();
