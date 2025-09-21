#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true
set +o histexpand 2>/dev/null || true

F="index.html"; [ -f "$F" ] || F="web/index.html"
[ -f "$F" ] || { echo "❌ index.html bulunamadı (./ veya ./web)"; exit 1; }
cp "$F" "$F.bak.$(date +%s)"

# 1) Topbar: sticky -> fixed (sabit)
sed -i 's/\.topbar{position:sticky; top:0; z-index:50;/\.topbar{position:fixed; top:0; left:0; right:0; z-index:100;/' "$F"

# 2) Body: üst bar için padding-top ekle
perl -0777 -pe 's/(padding-bottom:[^;]+;)/$1 padding-top: calc(64px + 8px);/s' -i "$F"

# 3) Dialog: z-index ve backdrop (her zaman üstte)
perl -0777 -pe 's/(dialog\{[^}]*)(\})/$1 z-index:200;$2/s' -i "$F"
perl -0777 -pe 's/(dialog\{[^}]*\})/\1\ndialog::backdrop{background:rgba(0,0,0,.45);}/s' -i "$F"

# 4) Canlı destek popover: mobil taşmayı kes
sed -i 's/min-width:320px; max-width:90vw;/min-width:min(320px, calc(100vw - 24px)); max-width:calc(100vw - 24px);/' "$F"

# 5) safeOpen polyfill ekle
perl -0777 -pe "s/(const \\$ = \\(s, r=document\\)=>r\\.querySelector\\(s\\);)/\\1\\n\\n    function safeOpen(sel){ const d=document.querySelector(sel); if(!d) return; if(typeof d.showModal==='function'){ d.showModal(); } else { d.setAttribute('open',''); } }/s" -i "$F"

# 6) Giriş/Kaydol butonlarını safeOpen'a bağla
perl -0777 -pe "s/\\$\\('#btnLoginOpen'\\)\\?\\.addEventListener\\('click',\\s*\\(\\)=>\\s*\\$\\('#dlgLogin'\\)\\?\\.showModal\\(\\)\\);/\\$\\('#btnLoginOpen'\\)\\?\\.addEventListener\\('click',\\s*\\(\\)=>\\s*safeOpen\\('#dlgLogin'\\)\\);/s" -i "$F"
perl -0777 -pe "s/\\$\\('#btnSignupOpen'\\)\\?\\.addEventListener\\('click',\\s*\\(\\)=>\\s*\\$\\('#dlgSignup'\\)\\?\\.showModal\\(\\)\\);/\\$\\('#btnSignupOpen'\\)\\?\\.addEventListener\\('click',\\s*\\(\\)=>\\s*safeOpen\\('#dlgSignup'\\)\\);/s" -i "$F"

# 7) Git commit + push
git add "$F"
git commit -m "fix(ui): modallar için safeOpen polyfill; topbar fixed + body padding-top; dialog z-index/backdrop; popover width"
git push
echo "✅ Bitti. Yedek: $F.bak.*"
