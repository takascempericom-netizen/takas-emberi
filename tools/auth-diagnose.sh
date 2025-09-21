#!/usr/bin/env bash
set -euo pipefail
shopt -s globstar nullglob

echo "1) Kullanılan Firebase SDK sürümleri:"
grep -RnoE "https://www.gstatic.com/firebasejs/[0-9]+\.[0-9]+(\.[0-9]+)?/" -- **/*.html **/*.js | \
  sed -E "s@.*firebasejs/([^/]+)/.*@\1@" | sort -u

echo; echo "2) initializeApp çağrıları (birden fazlaysa oturum sıfırlanabilir):"
grep -RnoE "\binitializeApp\s*\(" -- **/*.js **/*.html || true

echo; echo "3) getApps() ile tekil init koruması var mı:"
grep -RnoE "getApps\s*\(\)\s*\.length" -- **/*.js **/*.html || true

echo; echo "4) onAuthStateChanged içinde direkt yönlendirme (yarım saniyelik null durumda atabilir):"
grep -RnoE "onAuthStateChanged\s*\([^,]+,\s*[^)]*(location|href|replace|assign)" -- **/*.js **/*.html || true

echo; echo "5) auth.html/login yönlendirmeleri ve signOut tetikleyenler:"
grep -RnoE "auth\.html|login\.html|sign(in|out)|/auth\." -- **/*.js **/*.html | sed -E "s/^/   /" || true

echo; echo "6) setPersistence kullanımı (Session ise yeni sekmede/out-of-scope logout gibi davranır):"
grep -RnoE "setPersistence\(|browser(Session|Local|None)Persistence" -- **/*.js **/*.html || true

echo; echo "7) Yanlışlıkla çağrılan signOut:"
grep -RnoE "\.signOut\s*\(" -- **/*.js **/*.html || true

echo; echo "8) Oturum verisini temizleyen komutlar:"
grep -RnoE "localStorage\.clear|sessionStorage\.clear|document\.cookie\s*=" -- **/*.js **/*.html || true

echo; echo "9) Kodda authDomain ve farklı origin/ipuçları:"
grep -RnoE "authDomain\s*:\s*\"[^\"]+\"" -- **/*.js **/*.html || true
grep -RnoE "https?://[A-Za-z0-9\.\-]+" -- **/*.js **/*.html | \
  grep -E "takas|cember|vercel|firebaseapp|web\.app" | cut -d: -f1 | sort -u || true

echo; echo "10) user==null iken anında redirect eden guardlar:"
grep -RnoEn "onAuthStateChanged\([^)]*\)\s*;|if\s*\(\s*!user\s*\)\s*{[^}]*location" -- **/*.js **/*.html || true

echo; echo "11) firebase/auth modülünü çoklu import (state reset riski):"
grep -RnoE "from\s+\"https://www\.gstatic\.com/firebasejs/[^\"/]+/firebase-auth\.js\"" -- **/*.js **/*.html | sed -E "s/^/   /" || true

echo; echo "12) permission-denied / popup-closed-by-user izleri:"
grep -RnoE "permission-denied|popup-closed-by-user" -- **/*.js **/*.html || true

echo; echo "---- NOTLAR ----"
cat <<TXT
• Aynı sayfada initializeApp iki kez çalışırsa Auth sıfırlanır.
• onAuthStateChanged içinde user null olduğu ilk tickte hemen redirect ediyorsanız atma yaşanır; kısa gecikme ve/veya getRedirectResult kullanın.
• setPersistence(browserSessionPersistence) yaptıysanız sekme/alan değişiminde oturum kayboluyor gibi görünür; browserLocalPersistence kullanın.
• Firebase Console > Auth > Settings > Authorized domains: takascemberi.com, www.takascemberi.com, takas-emberi.vercel.app hepsi ekli olmalı.
TXT
