// ilan-ver.init.js
(function () {
  const $ = (id) => document.getElementById(id);
  const setOptions = (sel, list, placeholder="Seçiniz") => {
    sel.innerHTML = "";
    const ph = document.createElement("option");
    ph.value=""; ph.textContent=placeholder;
    sel.appendChild(ph);
    (list||[]).forEach(v => {
      const o = document.createElement("option");
      o.value=v; o.textContent=v; sel.appendChild(o);
    });
    sel.disabled = !(list && list.length);
  };

  // Elemanlar
  const il = $("il"), ilce = $("ilce");
  const kategori = $("kategori"), altKategori = $("altKategori");
  const marka = $("marka"), model = $("model");
  const km = $("km"), durum = $("durum");

  // İller
  setOptions(il, Object.keys(window.DISTRICTS||{}), "Seçiniz");
  il.addEventListener("change", () => {
    setOptions(ilce, (window.DISTRICTS||{})[il.value]||[], "Önce il seçin");
  });

  // Kategoriler
  setOptions(kategori, Object.keys(window.CATEGORIES||{}), "Seçiniz");
  kategori.addEventListener("change", () => {
    const cat = kategori.value;
    const altlar = Object.keys(((window.CATEGORIES||{})[cat])||{});
    setOptions(altKategori, altlar, "Önce kategori seçin");
    setOptions(marka, [], "Önce alt kategori seçin");
    setOptions(model, [], "Önce marka seçin");
  });

  // Alt kategori
  altKategori.addEventListener("change", () => {
    const node = (((window.CATEGORIES||{})[kategori.value])||{})[altKategori.value]||{};
    setOptions(marka, node.markalar||[], "Önce alt kategori seçin");
    setOptions(model, [], "Önce marka seçin");
  });

  // Marka
  marka.addEventListener("change", () => {
    const node = (((window.CATEGORIES||{})[kategori.value]||{})[altKategori.value]||{}).modeller||{};
    setOptions(model, node[marka.value]||[], "Önce marka seçin");
  });

  // KM ve Durum
  setOptions(km, window.KM_OPTIONS||[], "Seçiniz");
  setOptions(durum, window.DURUM_OPTIONS||[], "Seçiniz");

  // Yayına Al butonu
  $("yayinaAl").addEventListener("click", () => {
    alert("İlan admin onayına gönderildi!");
  });
})();
