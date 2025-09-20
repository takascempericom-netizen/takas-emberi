// assets/js/ilan-ver.ui.js (UI-only)
(function(){
  const $  = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const log = (...a)=>{ try{ console.debug('[ilan-ver.ui]', ...a);}catch(_){} };

  const TR_81 = ["Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan","Artvin","Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Iğdır","Isparta","İstanbul","İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kilis","Kırıkkale","Kırklareli","Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Mardin","Mersin","Muğla","Muş","Nevşehir","Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Şanlıurfa","Şırnak","Tekirdağ","Tokat","Trabzon","Tunceli","Uşak","Van","Yalova","Yozgat","Zonguldak"];

  const CATS = {
    "tasit": {
      name:"Motorlu Taşıtlar",
      subs:{
        "otomobil":"Otomobil",
        "motosiklet":"Motosiklet",
        "yedek-parca":"Yedek Parça"
      }
    },
    "tasinmaz": {
      name:"Taşınmaz",
      subs:{
        "ev":"Ev/Daire",
        "arsa":"Arsa",
        "tarla":"Tarla"
      }
    },
    "ev-hobi": { name:"Ev & Hobi", subs:{ "ev-esyasi":"Ev eşyası","hobi":"Hobi" } },
    "oyuncak": { name:"Oyuncak", subs:{ "cocuk":"Çocuk","koleksiyon":"Koleksiyon" } },
    "giyim": { name:"Giyim", subs:{ "kadin":"Kadın","erkek":"Erkek","cocuk":"Çocuk" } },
    "beyaz-esya": { name:"Beyaz Eşya", subs:{ "mutfak":"Mutfak","camasir":"Çamaşır" } },
    "teknoloji": { name:"Teknoloji", subs:{ "telefon":"Telefon","bilgisayar":"Bilgisayar","aksesuar":"Aksesuar" } },
    "mobilya": { name:"Mobilya", subs:{ "koltuk":"Koltuk","masa":"Masa","dolap":"Dolap" } },
  };

  // Küfür filtresi (örnek liste; genişletebiliriz)
  const BAD_WORDS = ["piç","oç","orospu","sürtük","ibne","yavşak","amk","aq","sikerim","sik","pezevenk","kahpe","mal","salak","gerizekalı"];

  function fillCities(sel){
    sel.innerHTML = '<option value="" selected>-- İl seçin --</option>' + TR_81.map(x=>`<option value="${x}">${x}</option>`).join('');
  }

  function fillSubcats(catSel, subSel){
    const cat = catSel.value;
    subSel.innerHTML = '';
    if(!cat || !CATS[cat]) { subSel.innerHTML = '<option value="">(Önce kategori seçin)</option>'; subSel.disabled = true; return; }
    subSel.disabled = false;
    subSel.innerHTML = '<option value="" selected>-- Alt kategori --</option>' + Object.entries(CATS[cat].subs).map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
  }

  function makeInput({id,label,type="text",placeholder="",attrs=""}){
    return `
      <div>
        <label for="${id}">${label}</label>
        ${type==="select"
          ? `<select id="${id}" ${attrs}></select>`
          : `<input id="${id}" type="${type}" placeholder="${placeholder}" ${attrs}/>`}
      </div>`;
  }

  function renderDynamicFields(cat, sub){
    const box = $("#dynFields");
    box.innerHTML = "";
    if(cat==="tasit" && sub==="motosiklet"){
      box.className = "row";
      box.innerHTML = [
        makeInput({id:"marka", label:"Marka"}),
        makeInput({id:"model", label:"Model"}),
        makeInput({id:"yil",   label:"Yıl", type:"text", placeholder:"Örn: 2017"}),
      ].join("");
    }else if(cat==="tasinmaz" && sub==="ev"){
      box.className = "row";
      box.innerHTML = [
        makeInput({id:"kat", label:"Kat"}),
        makeInput({id:"m2",  label:"m²", type:"text"}),
        makeInput({id:"oda", label:"Oda Sayısı"}),
      ].join("");
    }else if(cat==="tasinmaz" && (sub==="arsa"||sub==="tarla")){
      box.className = "row";
      box.innerHTML = [
        makeInput({id:"m2",  label:"m²", type:"text"}),
        makeInput({id:"imar",label:"İmar Durumu"}),
      ].join("");
    }else{
      box.className = "row row-1";
      // Diğer kategoriler için zorunlu alan yok; boş bırakıyoruz
    }
  }

  function checkBadWords(...texts){
    const joined = texts.filter(Boolean).join(" ").toLowerCase();
    const hits = BAD_WORDS.filter(w=> joined.includes(w));
    return hits;
  }

  function wirePhotos(){
    const grid = $("#fotoGrid");
    $$(".slot input", grid).forEach((inp, idx)=>{
      inp.addEventListener("change", ()=>{
        const f = inp.files?.[0];
        if(!f) return;
        if(!/^image\//.test(f.type)){ alert("Sadece görsel yükleyin."); inp.value=""; return; }
        const url = URL.createObjectURL(f);
        const slot = inp.closest(".slot");
        slot.querySelector("span")?.remove();
        let img = slot.querySelector("img");
        if(!img){ img = document.createElement("img"); slot.appendChild(img); }
        img.src = url;
        let x = slot.querySelector(".x");
        if(!x){
          x = document.createElement("button");
          x.type = "button";
          x.className = "x";
          x.textContent = "×";
          slot.appendChild(x);
          x.addEventListener("click", ()=>{
            inp.value = "";
            img.remove();
            x.remove();
            if(!slot.querySelector("span")){
              const s = document.createElement("span");
              s.textContent = "Görsel ekle";
              slot.appendChild(s);
            }
          });
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    log("hazır");

    // İl doldur
    fillCities($("#city"));

    // Kategori->Alt kategori
    const catSel = $("#cat");
    const subSel = $("#subcat");
    catSel.addEventListener("change", ()=>{
      fillSubcats(catSel, subSel);
      renderDynamicFields(catSel.value, "");
    });
    subSel.addEventListener("change", ()=>{
      renderDynamicFields(catSel.value, subSel.value);
    });

    // Foto önizleme
    wirePhotos();

    // Küfür filtresi (anlık)
    const title = $("#title");
    const desc  = $("#desc");
    const err   = $("#errNote");
    const ok    = $("#okNote");
    function liveCheck(){
      const hits = checkBadWords(title.value, desc.value);
      if(hits.length){
        ok.style.display  = "none";
        err.style.display = "block";
        err.textContent = `Bazı ifadeler topluluk kurallarına aykırı: ${hits.join(", ")}. Lütfen düzeltin.`;
      }else{
        err.style.display = "none";
        ok.style.display  = (title.value.length || desc.value.length) ? "block" : "none";
      }
    }
    ["input","change","keyup"].forEach(ev=>{
      title.addEventListener(ev, liveCheck);
      desc .addEventListener(ev, liveCheck);
    });

    // Submit: UI-only modal
    $("#ilanForm").addEventListener("submit", (e)=>{
      e.preventDefault();
      const hits = checkBadWords(title.value, desc.value);
      if(hits.length){
        err.style.display="block";
        err.textContent = `Topluluk kurallarına aykırı kelime(ler): ${hits.join(", ")}. İlanınız onaya alınmıyor, lütfen düzeltin.`;
        return;
      }
      const modal = $("#modal");
      modal.style.display = "flex";
      $("#modalOk").onclick = ()=>{
        modal.style.display = "none";
        window.location.href = "/home.html";
      };
    });
  });
})();
