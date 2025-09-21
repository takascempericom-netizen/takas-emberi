#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true
set +o histexpand 2>/dev/null || true

F="index.html"; [ -f "$F" ] || F="web/index.html"
[ -f "$F" ] || { echo "❌ index.html bulunamadı (./ veya ./web)"; exit 1; }
cp "$F" "$F.bak.$(date +%s)"

# 1) env() fallback'larını kaldır (CSS env fallback desteklenmez)
perl -0777 -pe 's/env\(\s*safe-area-inset-bottom\s*,\s*0(?:px)?\s*\)/env(safe-area-inset-bottom)/g' -i "$F"

# 2) padding-bottom satırının sonuna ; ekle (özellikle .bottom-nav bloğu)
perl -0777 -pe 's/(padding-bottom:\s*env\(safe-area-inset-bottom\))\s*([}])/\\1;\\2/g' -i "$F"

# 3) Topbar: sticky -> fixed (sabit kalması için)
perl -0777 -pe 's/\.topbar\{position:sticky; top:0; z-index:50;/\.topbar{position:fixed; top:0; left:0; right:0; z-index:100;/g' -i "$F"

# 4) Body: üst barda çakışma olmasın diye padding-top ekle (yoksa)
if ! perl -0777 -ne 'print 1 if /body\s*\{[^}]*padding-top:/s' "$F" >/dev/null; then
  perl -0777 -pe 's/(body\s*\{[^}]*padding-bottom:[^;]+;)/$1 padding-top: calc(64px + 8px);/s' -i "$F"
fi

# 5) Git
git add "$F"
git commit -m "fix(css): env() fallback kaldırıldı; eksik ; eklendi; topbar fixed; body padding-top"
git push
echo "✅ Düzeltildi. Yedek: $F.bak.*"
