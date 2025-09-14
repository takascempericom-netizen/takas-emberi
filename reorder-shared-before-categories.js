<script>
(function(){
  // En yakın bölüm bloğunu, başlığa bakarak bul
  function findBlockByHeading(keywords){
    const heads = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]'));
    const norm = s => (s||'').toLowerCase().replace(/\s+/g,' ').trim();
    const hit = heads.find(h => keywords.some(k => norm(h.textContent).includes(k)));
    if(!hit) return null;
    // Başlıktan yukarı doğru en mantıklı blok kapsayıcıyı bul
    let p = hit;
    while(p && p.parentElement){
      if (/^(SECTION|DIV|MAIN|ARTICLE)$/i.test(p.tagName)) {
        // Çok sık görülen liste/section sınıflarını da hedefleyelim
        const cls = (p.className||'').toString().toLowerCase();
        if (/(section|container|cards|list|grid|wrapper|wrap|card)/.test(cls) || p.parentElement.tagName === 'MAIN') {
          return p;
        }
      }
      p = p.parentElement;
    }
    return hit.parentElement || hit;
  }

  function pick(id, keys){
    return document.getElementById(id) || findBlockByHeading(keys);
  }

  let tries = 0;
  function reorder(){
    const shared = pick('sharedListings', ['paylaşılan ilanlar','paylasilan ilanlar','shared listings']);
    const cats   = pick('categories', ['kategoriler','categories']);
    if (shared && cats && cats.parentNode) {
      if (shared !== cats && shared.nextElementSibling !== cats) {
        cats.parentNode.insertBefore(shared, cats);
        console.log('[home] Paylaşılan İlanlar, Kategoriler üstüne taşındı.');
      }
      return true;
    }
    return false;
  }

  // İlk deneme
  const okNow = reorder();

  // DOM geç yüklenirse: kısa süreli yokla (debounce’lu)
  if (!okNow) {
    const iv = setInterval(() => {
      tries++;
      if (reorder() || tries > 40) clearInterval(iv); // ~4 sn
    }, 100);
  }

  // Dinamik güncellemeler için gözlemci
  const mo = new MutationObserver(() => reorder());
  mo.observe(document.documentElement, {childList:true, subtree:true});
})();
</script>
