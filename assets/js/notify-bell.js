// assets/js/notify-bell.js
'use strict';

(function(){
  // Stil (çakışmayı önlemek için izole sınıflar)
  const css = `
  .tc-bell-wrap{position:fixed;top:12px;right:12px;z-index:9999;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
  .tc-bell-btn{display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:12px;border:0;
    background:linear-gradient(180deg,#0f172a,#0a1222); color:#fff; box-shadow:0 6px 18px rgba(0,0,0,.25); cursor:pointer}
  .tc-bell-badge{position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border-radius:999px;font-size:11px;
    padding:2px 6px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.3)}
  .tc-dd{position:absolute;top:50px;right:0;width:320px;max-height:60vh;overflow:auto;background:#0f172a;color:#e5e7eb;
    border:1px solid #1f2937;border-radius:14px;box-shadow:0 12px 28px rgba(0,0,0,.35);display:none}
  .tc-dd.open{display:block}
  .tc-dd h4{margin:10px 12px 6px;font-size:13px;letter-spacing:.2px;color:#93a3b8}
  .tc-dd ul{margin:0;padding:0;list-style:none}
  .tc-dd li{border-top:1px solid #1f2937;padding:10px 12px}
  
  .tc-dd li.tc-new{background:rgba(255,211,61,.18);} .tc-dd li.tc-new .tc-msg{color:#ffd33d;}
.tc-dd li:first-child{border-top:0}
  .tc-msg{font-weight:700;color:#e7ebf6}
  .tc-time{font-size:11px;color:#93a3b8;margin-top:3px}
  @media (max-width:560px){ .tc-dd{right:6px;left:6px;width:auto} .tc-bell-wrap{right:6px} }
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // Kap: buton + badge + dropdown
  const wrap = document.createElement('div'); wrap.className = 'tc-bell-wrap';
  const btn  = document.createElement('button'); btn.className='tc-bell-btn'; btn.setAttribute('aria-label','Bildirimler'); btn.innerText='🔔';
  const badge= document.createElement('span'); badge.className='tc-bell-badge'; badge.textContent='0'; badge.style.display='none';
  const dd   = document.createElement('div'); dd.className='tc-dd';
  dd.innerHTML = `<h4>Bildirimler</h4><ul id="tc-dd-list"></ul>`;
  wrap.appendChild(btn); wrap.appendChild(badge); wrap.appendChild(dd); document.body.appendChild(wrap);

  const listEl = dd.querySelector('#tc-dd-list');
  let items = []; let unread = 0;

  function fmtTime(ms){
    try{
      const d=new Date(ms); const pad=n=>String(n).padStart(2,'0');
      return `${pad(d.getDate())}.${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }catch(_){ return ''; }
  }
  function render(){
    badge.style.display = unread>0 ? '' : 'none';
    badge.textContent = String(unread);
    if(items.length===0){
      listEl.innerHTML = `<li><div class="tc-msg">Henüz bildirimin yok.</div><div class="tc-time">Yeni gelişmeler burada görünecek.</div></li>`;
      return;
    }
    listEl.innerHTML = items.map(x=>(
      `<li class="${x.unread ? "tc-new" : ""}">`<div class="tc-msg">${x.message.replace(/</g,'&lt;')}</div><div class="tc-time">${fmtTime(x.at)}</div></li>`
    )).join('');
  }
  function addItem(msg, at){
    items.unshift({message:msg, at: at || Date.now(), unread:true});
    if(items.length>20) items = items.slice(0,20);
    unread++; render();
  }

  // Dropdown toggle
  btn.addEventListener(\'click\', ()=>{ const isOpen = dd.classList.toggle(\'open\'); if(isOpen){ unread=0; try{ items = items.map(i=>Object.assign({}, i, {unread:false})); }catch(_){ items.forEach(i=>i.unread=false); } render(); } });
  document.addEventListener('click', (e)=>{
    if(!wrap.contains(e.target)) dd.classList.remove('open');
  });

  // bildirimler.js notify() → tc:notify eventleri
  window.addEventListener('tc:notify', (ev)=>{
    const d = ev.detail || {};
    addItem(d.message || 'Yeni bildirim', d.at);
  }, {passive:true});

  window.addEventListener("tc:bell:toggle", ()=>btn.click(), {passive:true});

  // Sayfa yüklendiğinde çiz
  render();
})();


/* tc-inline anchor mode */
(function(){
  // Basit stil garanti (varsa etkisiz kalır)
  try{
    var st = document.createElement('style');
    st.textContent = '.tc-dd{display:none;position:fixed;z-index:2147483647;} .tc-dd.open{display:block;}';
    document.head.appendChild(st);
  }catch(_){}

  let dd = null;
  function ensureDD(){
    dd = document.querySelector('.tc-dd');
    if(!dd){
      // notify-bell henüz çizilmemiş olabilir; biraz sonra tekrar dene
      setTimeout(ensureDD, 300);
    }
  }
  ensureDD();

  function clamp(x, min, max){ return Math.max(min, Math.min(max, x)); }

  function toggleAt(anchor){
    if(!dd){ ensureDD(); return; }
    // Önce görünür yapıp genişlik ölç
    dd.style.visibility = 'hidden';
    dd.classList.add('open');
    const rect = anchor.getBoundingClientRect();
    const w = dd.offsetWidth || 280;
    const left = clamp(rect.left, 8, (window.innerWidth - w - 8));
    const top  = rect.bottom + 8;
    dd.style.left = left + 'px';
    dd.style.top  = top  + 'px';
    // Toggle
    const willOpen = !dd.dataset._open || dd.dataset._open === '0';
    dd.dataset._open = willOpen ? '1' : '0';
    if(willOpen){
      dd.classList.add('open');
    }else{
      dd.classList.remove('open');
    }
    dd.style.visibility = '';
  }

  // Nav’daki 🔔 Bildirimler linkine tıklandığında, dropdown’ı butonun altında aç
  document.addEventListener('click', function(ev){
    var a = ev.target && ev.target.closest && ev.target.closest('a.nav-bildir');
    if(a){
      ev.preventDefault();
      toggleAt(a);
      return;
    }
    // Dışarı tıklarsan kapat
    var inside = ev.target && ev.target.closest && (ev.target.closest('.tc-dd') || ev.target.closest('.tc-bell'));
    if(!inside && dd){
      dd.classList.remove('open');
      dd.dataset._open = '0';
    }
  }, {passive:false});

  // Eski tetikleyici ile de çalış (ilk nav-bildir’i baz al)
  window.addEventListener('tc:bell:toggle', function(){
    var a = document.querySelector('a.nav-bildir');
    if(a) toggleAt(a);
  });
})();
