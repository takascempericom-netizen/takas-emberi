#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true
set +o histexpand 2>/dev/null || true

F="index.html"; [ -f "$F" ] || F="web/index.html"
[ -f "$F" ] || { echo "❌ index.html bulunamadı"; exit 1; }
cp "$F" "$F.bak.$(date +%s)"

# 1) Topbar: sticky -> fixed (mobil/masaüstü sabit)
sed -i 's/position:sticky; top:0; z-index:50;/position:fixed; top:0; left:0; right:0; z-index:100;/' "$F"

# 2) Body: üst bar için padding-top ekle
perl -0777 -pe 's/(padding-bottom:[^;]+;)/$1 padding-top: calc(64px + 8px);/s' -i "$F"

# 3) Dialog her zaman üstte olsun + eski Safari fallback için z-index
perl -0777 -pe 's/(dialog\{[^}]*)(\})/$1 z-index:200;$2/s' -i "$F"

# 4) Canlı destek popover: küçük ekranlarda taşmayı kes
sed -i 's/min-width:320px; max-width:90vw;/min-width:min(320px, calc(100vw - 24px)); max-width:calc(100vw - 24px);/' "$F"

# 5) safeOpen(): dialog.showModal yoksa open attrib ile aç
sed -i '/const \$ = (s, r=document)=>r.querySelector(s);/a \  function safeOpen(sel){ const d=document.querySelector(sel); if(!d) return; if(typeof d.showModal==="function"){ d.showModal(); } else { d.setAttribute("open",""); } }' "$F"

# 6) Login/Kaydol tıklamaları safeOpen kullansın
perl -0777 -pe "s/\\$\\('#btnLoginOpen'\\)\\?\\.addEventListener\\('click',\\s*\\(\\)=>\\s*\\$\\('#dlgLogin'\\)\\?\\.showModal\\(\\)\\);/$('#btnLoginOpen')?.addEventListener('click', ()=> safeOpen('#dlgLogin'));/s" -i "$F"
perl -0777 -pe "s/\\$\\('#btnSignupOpen'\\)\\?\\.addEventListener\\('click',\\s*\\(\\)=>\\s*\\$\\('#dlgSignup'\\)\\?\\.showModal\\(\\)\\);/$('#btnSignupOpen')?.addEventListener('click', ()=> safeOpen('#dlgSignup'));/s" -i "$F"

# 7) Commit + push
git add "$F"
git commit -m "ui: topbar fixed + body padding-top; dialog safeOpen polyfill; popover width; fix login/signup open"
git push
echo "✅ Bitti. Yedek: $F.bak.*"
