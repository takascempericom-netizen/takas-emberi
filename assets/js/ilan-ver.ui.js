// assets/js/ilan-ver.ui.js
// Amaç: ilan-ver.html üzerinde sadece UI davranışları (backend yok)

(function(){
  const log = (...a)=>{ try{ console.debug('[ilan-ver.ui]', ...a);}catch(_){} };

  document.addEventListener('DOMContentLoaded', () => {
    log('hazır');

    // Basit guard: sayfada <h1>İlan Ver</h1> yoksa çalışmayı durdur
    if (!document.querySelector('h1')?.textContent?.toLowerCase()?.includes('ilan ver')) {
      return;
    }

    // Geçici uyarı: Bu sayfa şimdilik UI-only
    if (!document.getElementById('ui-only-note')) {
      const note = document.createElement('div');
      note.id = 'ui-only-note';
      note.style.cssText = 'margin:12px 0;padding:10px;border-radius:10px;background:#1f2937;color:#e5e7eb;font-size:14px';
      note.textContent = 'Bu sayfa şu an tasarım modunda (UI-only). Form davranışları yakında eklenecek.';
      const h1 = document.querySelector('h1');
      h1?.insertAdjacentElement('afterend', note);
    }

    // İleride: foto önizleme, kategori/alt kategori alan üretimi, 81 il dropdown, küfür filtresi, submit modal
  });
})();
