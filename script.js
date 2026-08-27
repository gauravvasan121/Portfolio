
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, r=document)=> r.querySelector(s);
  const $$ = (s, r=document)=> Array.from(r.querySelectorAll(s));

  const panels = $$('.panel');
  const menuItems = $$('.menu-item');
  const cursor = $('.menu .cursor');
  const sfx = { move: $('#sfx-move'), confirm: $('#sfx-confirm'), back: $('#sfx-back') };

  // ---------- Audio/Theme/Year
  function play(name){
    const on = JSON.parse(localStorage.getItem('audioOn') ?? 'true');
    if(!on) return;
    const a = sfx[name]; if(!a) return;
    try{ a.currentTime=0; a.play(); }catch{}
  }
  const btnAudio = $('#btn-audio');
  const btnTheme = $('#btn-theme');
  function setAudio(on){
    localStorage.setItem('audioOn', JSON.stringify(on));
    btnAudio?.setAttribute('aria-pressed', String(on));
  }
  setAudio(JSON.parse(localStorage.getItem('audioOn') ?? 'true'));
  btnAudio?.addEventListener('click', ()=> setAudio(!JSON.parse(localStorage.getItem('audioOn') ?? 'true')));
  btnTheme?.addEventListener('click', ()=> document.documentElement.classList.toggle('light'));
  $('#year') && ($('#year').textContent = new Date().getFullYear());

  // ---------- Cursor + Panels
  let sel = 0;
  function updateCursor(){
    if(!cursor) return;
    const el = menuItems[sel];
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
  }

  // ---------- Menu events
  menuItems.forEach((item, i)=>{
    item.addEventListener('mouseenter', ()=>{ sel=i; updateCursor(); });
    item.addEventListener('click', ()=>{ sel=i; updateCursor(); openPanel(item.dataset.panel); });
  });

  // ---------- Global keyboard (classic)
  window.addEventListener('keydown', (e)=>{
    if(e.code==='ArrowUp' || e.code==='KeyW'){ e.preventDefault(); sel=(sel-1+menuItems.length)%menuItems.length; updateCursor(); play('move'); }
    if(e.code==='ArrowDown' || e.code==='KeyS'){ e.preventDefault(); sel=(sel+1)%menuItems.length; updateCursor(); play('move'); }
    if(e.code==='Enter'){ e.preventDefault(); menuItems[sel].click(); }
    if(e.code==='Escape'){ e.preventDefault(); openPanel('home'); }
    if(e.code==='KeyM'){ setAudio(!JSON.parse(localStorage.getItem('audioOn') ?? 'true')); }
    if(e.code==='KeyT'){ document.documentElement.classList.toggle('light'); }
  });

  // ---------- Hash routing
  window.addEventListener('hashchange', ()=> {
    const id = (location.hash || '#home').slice(1);
    const idx = menuItems.findIndex(mi => mi.dataset.panel === id);
    if(idx >= 0){ sel = idx; updateCursor(); openPanel(id); }
  });

  // ---------- Hero bats (restored)
  (function(){
    const c = document.getElementById('hero-bats');
    if(!c) return;
    const dpr = Math.min(devicePixelRatio||1, 2);
    function rs(){ c.width=innerWidth*dpr; c.height=innerHeight*dpr; }
    rs(); addEventListener('resize', rs);
    const ctx = c.getContext('2d');
    const dots = Array.from({length: 36}, ()=> ({
      x: Math.random()*c.width, y: Math.random()*c.height, vx: (Math.random()*0.35+0.08)*dpr, t: Math.random()*Math.PI*2, r: (Math.random()*1.4+0.6)*dpr
    }));
    function loop(){
      ctx.clearRect(0,0,c.width,c.height);
      dots.forEach(b=>{
        b.t += 0.03;
        b.x += b.vx; b.y += Math.sin(b.t)*0.25;
        if(b.x > c.width+10*dpr){ b.x = -10*dpr; b.y = Math.random()*c.height; }
        ctx.fillStyle = 'rgba(215,30,43,0.45)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
        ctx.fill();
      });
      requestAnimationFrame(loop);
    }
    loop();
  })();

  // ---------- Typewriter subline (restored)
  (function(){
    const el = document.querySelector('.type-line');
    if(!el) return;
    const lines = JSON.parse(el.dataset.rotate || '[]');
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

  // ---------- Experience KPI (restored)
  window.startKPI = function(){
    const nums = document.querySelectorAll('.kpi .num');
    nums.forEach(el=>{
      const target = Number(el.dataset.target || '0');
      let cur = 0; const dur = 900; const start = performance.now();
      function step(t){
        const p = Math.min(1, (t - start) / dur);
        cur = Math.floor(target * p + (p<1?0:0));
        el.textContent = cur;
        if(p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  };

  // ---------- Hero CTA + Enter opens Projects
  $$('.cta').forEach(b => b.addEventListener('click', ()=> {
    const id = b.dataset.goto || 'projects';
    const idx = menuItems.findIndex(mi=> mi.dataset.panel===id);
    if(idx>=0){ sel=idx; updateCursor(); openPanel(id); }
  }));
  window.addEventListener('keydown', (e)=>{
    if(e.code==='Enter' && $('#panel-home')?.classList.contains('active')){
      const idx = menuItems.findIndex(mi=> mi.dataset.panel==='projects');
      if(idx>=0){ sel=idx; updateCursor(); openPanel('projects'); }
    }
  });

  // ---------- Init
  const startId = (location.hash || '#home').slice(1);
  const startIdx = menuItems.findIndex(mi => mi.dataset.panel === startId);
  sel = startIdx >= 0 ? startIdx : 0;
  updateCursor();
  openPanel(menuItems[sel].dataset.panel);
});


// ——— Hero insight counters + slide dots ———
(function(){
  const hero = document.getElementById('panel-home'); if(!hero) return;

  // Count-up just for the numbers in the Impact slide
  const nums = hero.querySelectorAll('.insights .num');
  let ran = false;
  function runCounters(){
    if(ran) return; ran = true;
    nums.forEach(el=>{
      const target = Number(el.dataset.target||'0'); let cur=0; const start=performance.now(), dur=900;
      function step(t){ const p=Math.min(1,(t-start)/dur); cur=Math.floor(target*p); el.textContent=cur; if(p<1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    });
  }

  // Start counters when Home is active on load or when returning to Home
  const _openPanel = window.openPanel;
  if(typeof _openPanel === 'function'){
    window.openPanel = function(id){
      _openPanel(id);
      if(id === 'home') runCounters();
    };
  }
  if(hero.classList.contains('active')) runCounters();

  // Slide dots (desktop)
  const dots = Array.from(hero.querySelectorAll('.insight-dots .dot'));
  const slides = Array.from(hero.querySelectorAll('.insights .slide'));
  function showSlide(n){
    slides.forEach(s => s.classList.toggle('active', s.dataset.slide === String(n)));
    dots.forEach(d => d.classList.toggle('active', d.dataset.goto === String(n)));
  }
  dots.forEach(d => d.addEventListener('click', ()=> showSlide(d.dataset.goto)));

  // Keyboard: ←/→ switches slides (desktop only)
  window.addEventListener('keydown', (e)=>{
    if(!hero.classList.contains('active')) return;
    if(matchMedia('(max-width: 900px)').matches) return; // stacked on mobile
    const cur = Number((slides.find(s=>s.classList.contains('active'))?.dataset.slide)||1);
    if(e.code==='ArrowLeft'){ e.preventDefault(); showSlide(Math.max(1, cur-1)); }
    if(e.code==='ArrowRight'){ e.preventDefault(); showSlide(Math.min(3, cur+1)); }
  });
})();

/* HUD panels stay visible — no cycle */

// ===== Bat HUD mini-graphs (radial + sparkline) =====
(function(){
  const DPR = Math.min(devicePixelRatio || 1, 2);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#d71e2b';
  const grid = 'rgba(255,255,255,.12)';
  const ink  = 'rgba(233,237,245,.92)';

  // Radial gauges
  document.querySelectorAll('canvas[data-radial]').forEach(cv=>{
    const value = Math.max(0, Math.min(1, parseFloat(cv.dataset.value || '0')));
    const w = (cv.clientWidth || 140), h = (cv.clientHeight || 86);
    cv.width = w * DPR; cv.height = h * DPR;
    const ctx = cv.getContext('2d'); ctx.scale(DPR, DPR);
    const cx = w/2, cy = h/2 + 4, r = Math.min(w,h)/2 - 10;

    // background ring
    ctx.strokeStyle = grid; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();

    // arc
    ctx.strokeStyle = accent; ctx.lineCap='round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + Math.PI*2*value, false);
    ctx.stroke();

    // value text
    ctx.fillStyle = ink; ctx.font = 'bold 14px ui-sans-serif, system-ui';
    const label = Math.round(value*100)+'%';
    const tw = ctx.measureText(label).width;
    ctx.fillText(label, cx - tw/2, cy + 5);
  });

  // Sparklines
  document.querySelectorAll('canvas[data-spark]').forEach(cv=>{
    const pts = (cv.dataset.points || '1,2,3').split(',').map(x=>parseFloat(x));
    const w = (cv.clientWidth || 160), h = (cv.clientHeight || 48);
    cv.width = w * DPR; cv.height = h * DPR;
    const ctx = cv.getContext('2d'); ctx.scale(DPR, DPR);

    const min = Math.min(...pts), max = Math.max(...pts);
    const nx = i => (i/(pts.length-1)) * (w-10) + 5;
    const ny = v => h - ((v - min) / Math.max(1e-6, (max-min))) * (h-10) - 5;

    // grid line
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h-1.5); ctx.lineTo(w, h-1.5); ctx.stroke();

    // path
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(nx(0), ny(pts[0]));
    for(let i=1;i<pts.length;i++) ctx.lineTo(nx(i), ny(pts[i]));
    ctx.stroke();

    // last point glow
    const lx = nx(pts.length-1), ly = ny(pts[pts.length-1]);
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI*2); ctx.fill();
  });
})();

// —— HUD feed rotator (cycles bullet text) ——
(function(){
  const SPEED = 2200; // ms per item
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
