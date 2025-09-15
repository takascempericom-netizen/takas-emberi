// Minimal bildirim zili (Firestore'a bağlanmadan da çalışır)
(function(){
  const BUS_EVENT = "tc:bell:toggle";
  const state = { open:false };

  function $(sel, root=document){ return root.querySelector(sel); }
  function create(tag, opts={}){
    const el = document.createElement(tag);
    if (opts.className) el.className = opts.className;
    if (opts.text) el.textContent = opts.text;
    if (opts.title) el.title = opts.title;
    if (opts.attrs) Object.keys(opts.attrs).forEach(k=>el.setAttribute(k, opts.attrs[k]));
    return el;
  }

  // UI parçaları
  let panel, badge;

  function ensureUI(){
    if (!panel){
      panel = create("div", { className:"notif-panel" });
      Object.assign(panel.style, {
        position:"fixed", right:"16px", top:"74px", width:"320px", maxWidth:"92vw",
        background:"#fff", border:"1px solid #e5e7eb", borderRadius:"12px",
        boxShadow:"0 18px 40px rgba(0,0,0,.15)", zIndex: 95, display:"none"
      });
      panel.innerHTML = '<div style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:700">Bildirimler</div><div id="nb-list" style="max-height:260px;overflow:auto;padding:8px 10px;color:#111"></div>';
      document.body.appendChild(panel);
    }
    if (!badge){
      badge = $(".nav-bildir");
      if (badge && !badge.dataset.nb){
        badge.dataset.nb = "1";
        badge.addEventListener("click", (e)=>{ e.preventDefault(); toggle(); });
      }
    }
  }

  function toggle(){
    ensureUI();
    state.open = !state.open;
    panel.style.display = state.open ? "block" : "none";
  }

  // Dışarıdan toggle (home.html zaten bunu dispatch ediyor)
  window.addEventListener(BUS_EVENT, toggle);

  // Basit demo satırı (Firestore yokken bile boş kalmasın)
  document.addEventListener("DOMContentLoaded", ()=>{
    ensureUI();
    const list = document.getElementById("nb-list");
    if (list && !list.children.length){
      const p = create("div", { text:"Şimdilik bildiriminiz yok.", className:"nb-empty" });
      Object.assign(p.style, { padding:"6px 2px", color:"#6b7280" });
      list.appendChild(p);
    }
  });
})();
