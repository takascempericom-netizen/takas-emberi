<script>
document.addEventListener('DOMContentLoaded', function(){
  function findSectionByHeading(keyword){
    var hs = Array.from(document.querySelectorAll('h1,h2,h3'));
    var h = hs.find(function(el){ return (el.textContent||"").trim().toLowerCase().includes(keyword); });
    return h ? (h.closest('section') || h.parentElement) : null;
  }
  // Varsa ID ile yakala; yoksa başlığa göre bul
  var cat = document.getElementById('categories') || findSectionByHeading('kategoriler');
  var shared = document.getElementById('sharedListings') || findSectionByHeading('paylaşılan ilanlar');
  if (cat && shared && cat.parentNode) {
    cat.parentNode.insertBefore(shared, cat); // Paylaşılan İlanlar'ı Kategoriler'in üstüne al
  }
});
</script>
