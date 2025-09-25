// /admin/users.js — Kullanıcı Listesi (arama, rol filtresi, sayfalama, rol/ban/silme)
import {
  collection, query, where, orderBy, limit, startAfter, getDocs,
  updateDoc, doc, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const esc = (s)=> String(s ?? "").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m]));
const fmtDate = (ts)=>{
  try{
    if(!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if(isNaN(d)) return "-";
    const pad = n=> String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }catch{ return "-"; }
};
const debounce = (fn, ms)=>{ let t=null; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

export async function mountUsers({ auth, db, el }){
  if(!el) return;

  // ---- STATE ----
  let lastDoc = null;
  let loading = false;
  const state = { text:"", role:"all", pageSize:20, selected: new Set() };

  // ---- UI ----
  el.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
      <input id="u-q" type="search" placeholder="Ad/E-posta ara…" style="flex:1;min-width:220px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px" />
      <select id="u-role" style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px">
        <option value="all">Tüm roller</option>
        <option value="admin">admin</option>
        <option value="moderator">moderator</option>
        <option value="support">support</option>
        <option value="user">user</option>
        <option value="banned">sadece banlı</option>
      </select>
      <select id="u-size" title="Sayfa boyutu" style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px">
        <option value="10">10</option>
        <option value="20" selected>20</option>
        <option value="50">50</option>
      </select>
      <button id="u-refresh" class="btn-ghost" type="button">Yenile</button>
      <button id="u-next" class="btn-ghost" type="button">Sonraki ›</button>
      <div style="flex:1"></div>
      <button id="u-del-selected" class="btn-ghost" type="button" style="border-color:#ef4444;color:#b91c1c">Seçilenleri Sil</button>
    </div>

    <div class="card" style="border:none">
      <div class="body" style="padding:0">
        <div style="overflow:auto">
          <table id="u-table" style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f8fafc;border-bottom:1px solid #e5e7eb">
                <th style="text-align:center;padding:10px 6px;width:36px">
                  <input id="u-check-all" type="checkbox" />
                </th>
                <th style="text-align:left;padding:10px 12px;white-space:nowrap">Kullanıcı</th>
                <th style="text-align:left;padding:10px 12px">E-posta</th>
                <th style="text-align:left;padding:10px 12px;white-space:nowrap">Rol</th>
                <th style="text-align:left;padding:10px 12px;white-space:nowrap">Durum</th>
                <th style="text-align:left;padding:10px 12px;white-space:nowrap">Üyelik</th>
                <th style="text-align:left;padding:10px 12px;white-space:nowrap">Son Giriş</th>
                <th style="text-align:left;padding:10px 12px">İşlem</th>
              </tr>
            </thead>
            <tbody id="u-tbody">
              <tr><td colspan="8" style="padding:16px;color:#64748b">Liste yükleniyor…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const $ = (s)=> el.querySelector(s);
  const qInput   = $("#u-q");
  const roleSel  = $("#u-role");
  const sizeSel  = $("#u-size");
  const btnRef   = $("#u-refresh");
  const btnNext  = $("#u-next");
  const btnDelSel= $("#u-del-selected");
  const tbody    = $("#u-tbody");
  const checkAll = $("#u-check-all");

  qInput.addEventListener("input", debounce(()=> reload(true), 400));
  roleSel.addEventListener("change", ()=> reload(true));
  sizeSel.addEventListener("change", ()=>{ state.pageSize = Number(sizeSel.value)||20; reload(true); });
  btnRef.addEventListener("click", ()=> reload(true));
  btnNext.addEventListener("click", ()=> reload(false));
  btnDelSel.addEventListener("click", onDeleteSelected);
  tbody.addEventListener("click", onActionClick);
  tbody.addEventListener("change", onRowCheckChange);
  checkAll.addEventListener("change", onToggleAll);

  await reload(true);

  async function reload(reset){
    if(loading) return;
    loading = true;
    try{
      if(reset){
        lastDoc = null;
        state.selected.clear();
        checkAll.checked = false;
        tbody.innerHTML = `<tr><td colspan="8" style="padding:16px;color:#64748b">Yükleniyor…</td></tr>`;
      }
      state.text = qInput.value.trim().toLowerCase();
      state.role = roleSel.value;

      const col = collection(db, "users");
      const whereParts = [];
      if(state.role === "banned"){
        whereParts.push(where("banned","==",true));
      }else if(state.role !== "all"){
        whereParts.push(where("role","==",state.role));
      }

      const pageLim = limit(state.pageSize || 20);

      let q;
      try{
        q = query(col, ...whereParts, orderBy("createdAt","desc"), ...(lastDoc?[startAfter(lastDoc)]:[]), pageLim);
      }catch{
        q = query(col, ...whereParts, orderBy("displayName"), ...(lastDoc?[startAfter(lastDoc)]:[]), pageLim);
      }

      const snap = await getDocs(q);
      const rows = [];
      let used = 0;

      snap.forEach(d=>{
        const x = d.data() || {};
        const uid   = d.id;
        const name  = x.displayName || x.name || "(adsız)";
        const email = x.email || "-";
        const photo = x.photoURL || x.avatar || "";
        const role  = (x.role || "user").toString();
        const banned= !!x.banned;
        const createdAt = x.createdAt || x.created_at || x._created || null;
        const lastLogin = x.lastLoginAt || x.lastLogin || x._lastLogin || x.lastSignInTime || null;

        const needle = state.text;
        const hay = `${name} ${email}`.toLowerCase();
        if(needle && !hay.includes(needle)) return;

        used++;
        rows.push(`
          <tr style="border-top:1px solid #e5e7eb" data-uid="${esc(uid)}">
            <td style="text-align:center;padding:10px 6px"><input type="checkbox" class="u-check" data-uid="${esc(uid)}"></td>
            <td style="padding:10px 12px;display:flex;gap:10px;align-items:center;min-width:220px">
              <img src="${esc(photo||"/assets/img/seffaf.png")}" alt="" style="width:32px;height:32px;border-radius:999px;border:1px solid #e5e7eb;object-fit:cover;background:#fff">
              <div>
                <div style="font-weight:600">${esc(name)}</div>
                <div style="font-size:12px;color:#64748b">UID: ${esc(uid)}</div>
              </div>
            </td>
            <td style="padding:10px 12px">${esc(email)}</td>
            <td style="padding:10px 12px">
              <span class="role-pill" style="display:inline-block;padding:3px 8px;border:1px solid #cbd5e1;border-radius:999px;background:#f8fafc">${esc(role)}</span>
            </td>
            <td style="padding:10px 12px">
              ${banned ? `<span style="color:#b91c1c;font-weight:600">BANLI</span>` : `<span style="color:#16a34a">Aktif</span>`}
            </td>
            <td style="padding:10px 12px">${esc(fmtDate(createdAt))}</td>
            <td style="padding:10px 12px">${esc(fmtDate(lastLogin))}</td>
            <td style="padding:10px 12px;white-space:nowrap">
              <a href="/profile.html?uid=${encodeURIComponent(uid)}" target="_blank" style="margin-right:8px;text-decoration:none;border:1px solid #e5e7eb;border-radius:10px;padding:6px 8px">Profili Gör</a>
              <button data-act="role" data-uid="${esc(uid)}" data-role="${esc(role)}" style="margin-right:6px;border:1px solid #e5e7eb;border-radius:10px;padding:6px 8px;background:#fff;cursor:pointer">Rol Değiştir</button>
              <button data-act="ban"  data-uid="${esc(uid)}" data-banned="${banned ? "1":"0"}" style="margin-right:6px;border:1px solid ${banned?"#ef4444":"#e5e7eb"};border-radius:10px;padding:6px 8px;background:${banned?"#fee2e2":"#fff"};cursor:pointer">${banned?"Banı Kaldır":"Banla"}</button>
              <button data-act="del"  data-uid="${esc(uid)}" style="border:1px solid #ef4444;border-radius:10px;padding:6px 8px;background:#fff;color:#b91c1c;cursor:pointer">Sil</button>
            </td>
          </tr>
        `);
      });

      lastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;

      if(used===0){
        tbody.innerHTML = `<tr><td colspan="8" style="padding:16px;color:#64748b">Kayıt bulunamadı.</td></tr>`;
      }else{
        tbody.innerHTML = rows.join("");
      }
    }catch(e){
      console.error("Kullanıcı listesi hata:", e);
      tbody.innerHTML = `<tr><td colspan="8" style="padding:16px;color:#b91c1c">Hata: ${esc(e?.message||e)}</td></tr>`;
    }finally{
      loading = false;
    }
  }

  function onRowCheckChange(ev){
    const cb = ev.target.closest('.u-check');
    if(!cb) return;
    const uid = cb.getAttribute('data-uid');
    if(cb.checked){ state.selected.add(uid); } else { state.selected.delete(uid); }
    syncHeaderCheckbox();
  }

  function onToggleAll(ev){
    const on = ev.target.checked;
    el.querySelectorAll('.u-check').forEach(cb=>{
      cb.checked = on;
      const uid = cb.getAttribute('data-uid');
      if(on) state.selected.add(uid); else state.selected.delete(uid);
    });
  }

  function syncHeaderCheckbox(){
    const checks = el.querySelectorAll('.u-check');
    const total = checks.length;
    const marked = Array.from(checks).filter(c=>c.checked).length;
    checkAll.indeterminate = marked>0 && marked<total;
    checkAll.checked = total>0 && marked===total;
  }

  async function onDeleteSelected(){
    if(state.selected.size===0){ alert("Silmek için kullanıcı seçin."); return; }
    const me = auth?.currentUser?.uid;
    if(me && state.selected.has(me)){
      const okSelf = confirm("Kendi kullanıcı kaydınızı da silmek üzeresiniz. Devam edilsin mi?");
      if(!okSelf) return;
    }
    const ok = confirm(`${state.selected.size} kullanıcı Firestore'dan silinsin mi? (Auth hesabı silinmez)`);
    if(!ok) return;

    try{
      btnDelSel.disabled = true;
      for(const uid of Array.from(state.selected)){
        await deleteUserCascade(uid);
        state.selected.delete(uid);
        const tr = el.querySelector(`tr[data-uid="${CSS.escape(uid)}"]`);
        tr?.remove();
      }
      syncHeaderCheckbox();
      // Liste boşaldıysa yenile
      if(!tbody.querySelector('tr')) await reload(true);
      alert("Silme işlemi tamamlandı.");
    }catch(e){
      console.error(e); alert("Bazı kayıtlar silinemedi: " + (e?.message||e));
    }finally{
      btnDelSel.disabled = false;
    }
  }

  async function deleteUserCascade(uid){
    // 1) Alt koleksiyon: inbox/*
    try{
      const inboxCol = collection(db, "users", uid, "inbox");
      const snap = await getDocs(inboxCol);
      const ops = [];
      snap.forEach(d=> ops.push(deleteDoc(doc(db,"users",uid,"inbox", d.id))));
      await Promise.all(ops);
    }catch(e){ /* alt koleksiyon yoksa sorun değil */ }

    // 2) users/{uid} belgesini sil
    await deleteDoc(doc(db,"users", uid));
  }

  async function onActionClick(ev){
    const btn = ev.target.closest("button[data-act]");
    if(!btn) return;
    const uid = btn.getAttribute("data-uid");
    const act = btn.getAttribute("data-act");

    const me = auth?.currentUser?.uid;
    if(uid && me && uid===me && (act==="ban" || act==="role" || act==="del")){
      const ok = confirm("Kendi hesabınız üzerinde işlem yapıyorsunuz. Devam edilsin mi?");
      if(!ok) return;
    }

    if(act==="role"){
      const current = btn.getAttribute("data-role") || "user";
      const next = prompt("Yeni rol (admin/moderator/support/user):", current);
      if(!next) return;
      const role = (next||"").toString().trim().toLowerCase();
      if(!["admin","moderator","support","user"].includes(role)){ alert("Geçersiz rol."); return; }
      try{
        btn.disabled = true;
        await updateDoc(doc(db,"users", uid), { role, roleUpdatedAt: serverTimestamp() });
        btn.setAttribute("data-role", role);
        const pill = btn.closest("tr")?.querySelector(".role-pill");
        if(pill) pill.textContent = role;
        alert("Rol güncellendi.");
      }catch(e){
        console.error(e); alert("Rol güncellenemedi: " + (e?.message||e));
      }finally{ btn.disabled = false; }
      return;
    }

    if(act==="ban"){
      const banned = btn.getAttribute("data-banned")==="1";
      const conf = confirm(banned ? "Ban kaldırılsın mı?" : "Kullanıcı banlansın mı?");
      if(!conf) return;
      try{
        btn.disabled = true;
        await updateDoc(doc(db,"users", uid), banned ? { banned:false, unbannedAt: serverTimestamp() } : { banned:true, bannedAt: serverTimestamp() });
        const cell = btn.closest("tr")?.children?.[4];
        if(cell) cell.innerHTML = banned
          ? `<span style="color:#16a34a">Aktif</span>`
          : `<span style="color:#b91c1c;font-weight:600">BANLI</span>`;
        btn.textContent = banned ? "Banla" : "Banı Kaldır";
        btn.setAttribute("data-banned", banned ? "0" : "1");
        btn.style.background = banned ? "#fff" : "#fee2e2";
        btn.style.borderColor = banned ? "#e5e7eb" : "#ef4444";
      }catch(e){
        console.error(e); alert("İşlem başarısız: " + (e?.message||e));
      }finally{ btn.disabled = false; }
      return;
    }

    if(act==="del"){
      const ok = confirm("Bu kullanıcı Firestore'dan silinsin mi? (Auth hesabı silinmez)");
      if(!ok) return;
      try{
        btn.disabled = true;
        await deleteUserCascade(uid);
        // UI’dan düşür
        const tr = btn.closest('tr');
        const cb = tr?.querySelector('.u-check');
        if(cb?.checked) state.selected.delete(uid);
        tr?.remove();
        syncHeaderCheckbox();
        // tablo boş kaldıysa yenile
        if(!tbody.querySelector('tr')) await reload(true);
      }catch(e){
        console.error(e); alert("Silinemedi: " + (e?.message||e));
      }finally{ btn.disabled = false; }
      return;
    }
  }
}

// Fallback uyumluluk: index.html 'mod?.mountUsers || mod?.mount' çağırıyor
export function mount(ctx){ return mountUsers(ctx); }
