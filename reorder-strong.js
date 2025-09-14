<script>
(function(){
  function norm(s){ return (s||'').toLowerCase().replace(/\s+/g,' ').trim(); }
  function findHeadByIdOrText(id, keywords){
    var el = id ? document.getElementById(id) : null;
    if (el) return el;
    var hs = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]'));
    return hs.find(h => keywords.some(k => norm(h.textContent).includes(k))) || null;
  }
  function commonAncestor(a,b){
    if(!a || !b) return null;
    var s = new Set();
    for(var x=a; x; x=x.parentElement){ s.add(x); }
    for(var y=b; y; y=y.parentElement){ if(s.has(y)) return y; }
    return document.body;
  }

  function moveSlice(){
    var sharedH = findHeadByIdOrText('sharedListings', ['paylaşılan ilanlar','paylasilan ilanlar','shared listings']);
    var catsH   = findHeadByIdOrText('categories', ['kategoriler','categories']);
    if(!sharedH || !catsH) return false;

    // Aynı büyük kapsayıcı içinde olduklarından emin ol
    var root = commonAncestor(sharedH, catsH);
    if(!root) return false;

    // Taşınacak dilim: shared heading'den categories bloğuna kadar
    var range = document.createRange();
    range.setStartBefore(sharedH);

    // Bitişi: categories başlığından hemen önce
    range.setEndBefore(catsH);

    // Eğer zaten sharedH, catsH'den yukarıdaysa (doğru sıradaysa) çık
    if(range.collapsed) return true;

    // Dilimi al ve categories'in önüne bırak
    var frag = range.cloneContents();
    range.deleteContents();
    catsH.parentNode.insertBefore(frag, catsH);

    // Grid/Flex ortamında sırayı da garantile (order)
    var shBlock = sharedH.closest('section,article,div') || sharedH.parentElement;
    var caBlock = catsH.closest('section,article,div') || catsH.parentElement;
    if (shBlock && caBlock && shBlock.parentElement === caBlock.parentElement) {
      shBlock.style.order = 0;
      caBlock.style.order = 1;
    }
    console.log('[home] Paylaşılan İlanlar: başlık+içerik dilim olarak Kategoriler üstüne taşındı.');
    return true;
  }

  function run(){
    try { moveSlice(); } catch(e){ console.warn('[home] reorder error', e); }
  }
  document.addEventListener('DOMContentLoaded', run);
  // Geç yüklemeler için tekrarlı deneme + gözlemci
  var tries = 0, iv = setInterval(function(){ if(moveSlice() || ++tries>40) clearInterval(iv); }, 100);
  new MutationObserver(run).observe(document.documentElement, {childList:true, subtree:true});
})();
</script>
