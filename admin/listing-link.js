/**
 * Mevcut admin listelerinden tek tıkla detay sayfasına gitmek için yardımcılar.
 * Çalışma mantığı:
 * - openListing(id): direkt /admin/listing.html?id=ID adresine götürür
 * - autoLink(): sayfadaki data-doc-id / data-id / [data-open-listing] taşıyan öğeleri linke çevirir
 * - event delegation ile tıklamaları da yakalar
 */

export function openListing(id){
  if(!id){ alert("ID yok"); return; }
  location.href = `/admin/listing.html?id=${encodeURIComponent(id)}`;
}

// Bulunabilecek id adaylarını topla
function pickIdFrom(el){
  return el?.dataset?.docId || el?.dataset?.id || el?.getAttribute?.("data-open-listing") || null;
}

export function autoLink(root=document){
  // 1) data-doc-id / data-id / data-open-listing olan tüm öğeleri linke çevir
  const candidates = root.querySelectorAll("[data-doc-id],[data-id],[data-open-listing]");
  candidates.forEach(el=>{
    const id = pickIdFrom(el);
    if(!id) return;
    // İçeriği <a> ile sar
    if(el.tagName !== "A"){
      const a = document.createElement("a");
      a.href = `/admin/listing.html?id=${encodeURIComponent(id)}`;
      a.textContent = el.textContent?.trim() || id;
      a.style.textDecoration = "none";
      a.style.fontWeight = "600";
      el.replaceWith(a);
    }else{
      el.href = `/admin/listing.html?id=${encodeURIComponent(id)}`;
    }
  });

  // 2) data-open-listing butonları/ikonları için event delegation (tıklayınca gider)
  root.addEventListener("click", (e)=>{
    const t = e.target.closest("[data-open-listing],[data-doc-id],[data-id]");
    if(!t) return;
    const id = pickIdFrom(t);
    if(!id) return;
    // Eğer zaten <a> ise bırak; değilse engelle ve yönlendir
    if(t.tagName !== "A"){
      e.preventDefault();
      openListing(id);
    }
  }, { passive:false });
}

// DOM hazır olunca otomatik çalış
if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", ()=>autoLink(document));
}else{
  autoLink(document);
}
