#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true
set +o histexpand 2>/dev/null || true

F="index.html"; [ -f "$F" ] || F="web/index.html"
[ -f "$F" ] || { echo "❌ index.html bulunamadı (./ veya ./web)"; exit 1; }

# 0) Çöp backup/tmp dosyalarını temizle (yeni yedek üretmiyoruz)
rm -f index.html.bak.* index.html.tmp* 2>/dev/null || true

# 1) CSS: env fallback'larını kaldır
perl -0777 -pe 's/env\(\s*safe-area-inset-bottom\s*,\s*0(?:px)?\s*\)/env(safe-area-inset-bottom)/g' -i "$F"

# 2) CSS: padding-bottom satırının sonuna ';' ekle (özellikle .bottom-nav)
perl -0777 -pe 's/(padding-bottom:\s*env\(safe-area-inset-bottom\))\s*([}])/\\1;\\2/g' -i "$F"

# 3) Dialog: z-index ve backdrop ekle
perl -0777 -pe 's/(dialog\{[^}]*)(\})/$1 z-index:200;$2/s' -i "$F"
grep -q 'dialog::backdrop' "$F" || printf '\n%s\n' 'dialog::backdrop{background:rgba(0,0,0,.45);}' >> "$F"

# 4) Login/Kaydol açılışı: showModal fallback (open attribute)
perl -0777 -pe "s/\\$\\('#btnLoginOpen'\\)\\?\\.addEventListener\\('click',\\s*\\(\\)=>\\s*\\$\\('#dlgLogin'\\)\\?\\.showModal\\(\\)\\);/\$\\('#btnLoginOpen'\\)?.addEventListener('click',()=>{const d=document.querySelector('#dlgLogin');if(!d)return;d.showModal?d.showModal():d.setAttribute('open','');});/s" -i "$F"
perl -0777 -pe "s/\\$\\('#btnSignupOpen'\\)\\?\\.addEventListener\\('click',\\s*\\(\\)=>\\s*\\$\\('#dlgSignup'\\)\\?\\.showModal\\(\\)\\);/\$\\('#btnSignupOpen'\\)?.addEventListener('click',()=>{const d=document.querySelector('#dlgSignup');if(!d)return;d.showModal?d.showModal():d.setAttribute('open','');});/s" -i "$F"

# 5) Git: sadece ana dosyayı commit et ve pushla
git add "$F"
git commit -m "fix(ui): CSS env() + ';' düzeltildi; modallar için showModal fallback; dialog z-index/backdrop"
git push
echo "✅ Düzeltildi ve push edildi."
