<script>
(function(){
  const pickSection = (id, keywords) => {
    let el = id ? document.getElementById(id) : null;
    if (el) return el;
    const hs = Array.from(document.querySelectorAll('h1,h2,h3'));
    const key = (t) => (t||'').trim().toLowerCase();
    return (hs.find(h => keywords.some(k => key(h.textContent).includes(k)))||{}).closest?.('section') || null;
  };

  function run(){
    const cat = pickSection('categories', ['kategoriler','categories']);
    const shared = pickSection('sharedListings', ['paylaşılan ilanlar','shared listings']);
    if (cat && shared && cat.parentNode) {
      if (shared.nextElementSibling !== cat) {
        cat.parentNode.insertBefore(shared, cat);
        console.log('[home] Paylaşılan İlanlar kategori üstüne taşındı.');
      }
    } else {
      console.log('[home] Bölümler bulunamadı:', {cat:!!cat, shared:!!shared});
    }
  }

  // İlk çalıştırma
  document.addEventListener('DOMContentLoaded', run);
  // Geç/async yüklemeler için gözlemci
  const mo = new MutationObserver(() => run());
  mo.observe(document.documentElement, {childList:true, subtree:true});
})();
</script>
