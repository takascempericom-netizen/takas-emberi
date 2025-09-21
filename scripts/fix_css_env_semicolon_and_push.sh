#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true
set +o histexpand 2>/dev/null || true

F="index.html"; [ -f "$F" ] || F="web/index.html"
[ -f "$F" ] || { echo "❌ index.html bulunamadı (./ veya ./web)"; exit 1; }
cp "$F" "$F.bak.$(date +%s)"

# 1) env() fallback'larını kaldır (lint hatası kaynağı)
perl -0777 -pe 's/env\(\s*safe-area-inset-bottom\s*,\s*0(?:px)?\s*\)/env(safe-area-inset-bottom)/g' -i "$F"

# 2) padding-bottom:env(...) sonuna ; ekle (kapatma öncesi)
perl -0777 -pe 's/(padding-bottom:\s*env\(safe-area-inset-bottom\))\s*}/$1;}/g' -i "$F"

# 3) Topbar: sticky → fixed (her ekranda sabit)
sed -i 's/\.topbar{position:sticky; top:0; z-index:50;/\.topbar{position:fixed; top:0; left:0; right:0; z-index:100;/' "$F"

# 4) Body: üst bar için padding-top ekle (yoksa ekle)
perl -0777 -pe 's/(body\s*\{[^}]*padding-bottom:[^;]+;)/$1 padding-top: calc(64px + 8px);/s' -i "$F"

# 5) Canlı destek popover: mobil taşmayı kes
sed -i 's/min-width:320px; max-width:90vw;/min-width:min(320px, calc(100vw - 24px)); max-width:calc(100vw - 24px);/' "$F"

# 6) Güvenlik: dialog z-index (eski Safari için)
perl -0777 -pe 's/(dialog\{[^}]*)(\})/$1 z-index:200;$2/s' -i "$F"

# 7) Git commit + push
git add "$F"
git commit -m "fix(css): remove env() fallbacks, add missing semicolons; topbar fixed; body padding-top; popover width"
git push

echo "✅ Bitti. Yedek: $F.bak.*"
