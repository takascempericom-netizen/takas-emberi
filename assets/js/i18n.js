/**
 * Çok hafif i18n:
 * - setLang('tr'|'en'|'ar') → lang ve dir ayarlanır, localStorage'a yazılır
 * - apply() → data-i18n, data-i18n-placeholder, data-i18n-aria-label çevirilerini uygular
 * - init() → sayfa açılışında lokal dili yükler + dropdown (#langSelect) ile senkron
 */

const DICT = {
  tr: {
    // Topbar & CTA
    "brand.slogan": "Takas Çemberi’ne Hoş Geldiniz",
    "brand.sub": "Toplulukla takas et, eşyana yeni bir hayat ver.",
    "cta.browse": "İlanlara Göz At",
    "cta.post": "Ücretsiz İlan Ver",
    "badge.free": "🎁 İlk ilan ücretsiz, sonrası ücretli",

    // Sections
    "sec.newlistings": "Yeni İlanlar",
    "sec.categories": "Kategoriler",

    // Categories
    "cat.home": "Ev & Hobi",
    "cat.home.desc": "Ev eşyaları, hobi ürünleri",
    "cat.real": "Taşınmaz",
    "cat.real.desc": "Ev, arsa, tarla",
    "cat.auto": "Motorlu Taşıtlar",
    "cat.auto.desc": "Araba, motosiklet, yedek parça",
    "cat.toy": "Oyuncak",
    "cat.toy.desc": "Her yaşa uygun oyuncaklar",
    "cat.fashion": "Giyim",
    "cat.fashion.desc": "Kadın, erkek, çocuk",
    "cat.appliance": "Beyaz Eşya",
    "cat.appliance.desc": "Ev aletleri, mutfak",
    "cat.tech": "Teknoloji",
    "cat.tech.desc": "Bilgisayar, telefon",
    "cat.furniture": "Mobilya",
    "cat.furniture.desc": "Koltuk, masa, dolap",

    // Features
    "feat.safe": "✅ Güvenli Takas<br/>SSL ve KVKK güvencesiyle güvenli işlemler.",
    "feat.easy": "📱 Kolay Kullanım<br/>Mobil uyumlu arayüz ile her yerde ilan ver.",
    "feat.support":"💬 Canlı Destek<br/>7/24 destek ekibi seninle.",

    // Dialogs
    "dlg.login.title": "Giriş Yap",
    "dlg.signup.title": "Kaydol",
    "dlg.login.btn": "Giriş Yap",
    "dlg.signup.btn": "Kaydol",
    "dlg.google.login": "Google ile Giriş",
    "dlg.google.signup": "Google ile Devam Et",
    "dlg.or.email": "veya e-posta ile",
    "dlg.or.form": "veya formu doldur",
    "dlg.email": "E-posta",
    "dlg.password": "Şifre",
    "dlg.password2": "Şifre (tekrar)",
    "dlg.forgot": "Şifremi Unuttum",
    "dlg.resend": "Doğrulama Mailini Tekrar Gönder",
    "dlg.name": "İsim",
    "dlg.surname": "Soyisim",
    "dlg.city": "Yaşadığı Şehir",
    "dlg.username": "Kullanıcı Adı",
    "dlg.kvkk": "KVKK Aydınlatma Metni",
    "dlg.privacy": "Gizlilik Politikası",

    // Slogans
    "_slogans": [
      "Evinizdeki eşyaları değerinde takas edin, atığı azaltın, birlikte kazanın.",
      "İhtiyacın olmayan başkasının hazinesi olabilir.",
      "Bütçe dostu takasla yeni başlangıçlar yap.",
      "Topluluk gücüyle sürdürülebilir alışveriş.",
      "Az tüket, çok paylaş: Takas Çemberi’ndesin."
    ],

    // System / misc
    "hint.listings.click": "İlan kartına tıkladığınızda kayıt penceresi açılır."
  },

  en: {
    "brand.slogan": "Welcome to Takas Çemberi",
    "brand.sub": "Trade with the community and give your items a new life.",
    "cta.browse": "Browse Listings",
    "cta.post": "Post for Free",
    "badge.free": "🎁 First listing free, others paid",

    "sec.newlistings": "New Listings",
    "sec.categories": "Categories",

    "cat.home": "Home & Hobby",
    "cat.home.desc": "Home goods, hobby items",
    "cat.real": "Real Estate",
    "cat.real.desc": "House, land, field",
    "cat.auto": "Vehicles",
    "cat.auto.desc": "Car, motorcycle, spare parts",
    "cat.toy": "Toys",
    "cat.toy.desc": "Toys for all ages",
    "cat.fashion": "Clothing",
    "cat.fashion.desc": "Women, men, kids",
    "cat.appliance": "Appliances",
    "cat.appliance.desc": "Home appliances, kitchen",
    "cat.tech": "Tech",
    "cat.tech.desc": "Computer, phone",
    "cat.furniture": "Furniture",
    "cat.furniture.desc": "Sofa, table, wardrobe",

    "feat.safe": "✅ Safe Barter<br/>Secure transactions with SSL and privacy compliance.",
    "feat.easy": "📱 Easy to Use<br/>Post listings anywhere with our mobile UI.",
    "feat.support":"💬 Live Support<br/>We’re here 24/7.",

    "dlg.login.title": "Log In",
    "dlg.signup.title": "Sign Up",
    "dlg.login.btn": "Log In",
    "dlg.signup.btn": "Sign Up",
    "dlg.google.login": "Continue with Google",
    "dlg.google.signup": "Continue with Google",
    "dlg.or.email": "or with email",
    "dlg.or.form": "or fill the form",
    "dlg.email": "Email",
    "dlg.password": "Password",
    "dlg.password2": "Password (repeat)",
    "dlg.forgot": "Forgot Password",
    "dlg.resend": "Resend Verification Email",
    "dlg.name": "First Name",
    "dlg.surname": "Last Name",
    "dlg.city": "City",
    "dlg.username": "Username",
    "dlg.kvkk": "KVKK Notice",
    "dlg.privacy": "Privacy Policy",

    "_slogans": [
      "Trade fairly, reduce waste, win together.",
      "What you don’t need may be someone’s treasure.",
      "Budget-friendly trading for a fresh start.",
      "Sustainable shopping powered by community.",
      "Consume less, share more."
    ],

    "hint.listings.click": "Click a card to open the sign-up dialog."
  },

  ar: {
    "brand.slogan": "مرحبًا بكم في حلقة المقايضة",
    "brand.sub": "بادِل مع المجتمع وأعطِ أغراضك حياةً جديدة.",
    "cta.browse": "تصفح الإعلانات",
    "cta.post": "أضف إعلانًا مجانًا",
    "badge.free": "🎁 الإعلان الأول مجانًا، وما بعده مدفوع",

    "sec.newlistings": "إعلانات جديدة",
    "sec.categories": "الفئات",

    "cat.home": "المنزل والهوايات",
    "cat.home.desc": "أغراض المنزل والهوايات",
    "cat.real": "العقارات",
    "cat.real.desc": "منزل، أرض، حقل",
    "cat.auto": "المركبات",
    "cat.auto.desc": "سيارة، دراجة، قطع غيار",
    "cat.toy": "الألعاب",
    "cat.toy.desc": "ألعاب لكل الأعمار",
    "cat.fashion": "الملابس",
    "cat.fashion.desc": "نساء، رجال، أطفال",
    "cat.appliance": "الأجهزة المنزلية",
    "cat.appliance.desc": "أجهزة المنزل والمطبخ",
    "cat.tech": "التقنية",
    "cat.tech.desc": "حاسوب، هاتف",
    "cat.furniture": "الأثاث",
    "cat.furniture.desc": "أريكة، طاولة، خزانة",

    "feat.safe": "✅ مقايضة آمنة<br/>معاملات آمنة وفق SSL والخصوصية.",
    "feat.easy": "📱 سهلة الاستخدام<br/>انشر إعلاناتك عبر الواجهة الملائمة للجوال.",
    "feat.support":"💬 دعم مباشر<br/>نحن معك على مدار الساعة.",

    "dlg.login.title": "تسجيل الدخول",
    "dlg.signup.title": "إنشاء حساب",
    "dlg.login.btn": "دخول",
    "dlg.signup.btn": "تسجيل",
    "dlg.google.login": "المتابعة عبر Google",
    "dlg.google.signup": "المتابعة عبر Google",
    "dlg.or.email": "أو عبر البريد الإلكتروني",
    "dlg.or.form": "أو املأ النموذج",
    "dlg.email": "البريد الإلكتروني",
    "dlg.password": "كلمة المرور",
    "dlg.password2": "تأكيد كلمة المرور",
    "dlg.forgot": "نسيت كلمة المرور",
    "dlg.resend": "إعادة إرسال رسالة التحقق",
    "dlg.name": "الاسم",
    "dlg.surname": "الكنية",
    "dlg.city": "المدينة",
    "dlg.username": "اسم المستخدم",
    "dlg.kvkk": "إشعار KVKK",
    "dlg.privacy": "سياسة الخصوصية",

    "_slogans": [
      "بادِل بعدل، وقلّل النفايات، واربحوا معًا.",
      "ما لا تحتاجه قد يكون كنزًا لغيرك.",
      "مقايضة موفّرة لبداية جديدة.",
      "تسوق مستدام بقوة المجتمع.",
      "استهلك أقل وشارك أكثر."
    ],

    "hint.listings.click": "عند النقر على البطاقة سيظهر حوار التسجيل."
  }
};

const RTL = new Set(["ar"]);

function setAttrsForLang(lang) {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = RTL.has(lang) ? "rtl" : "ltr";
  document.body?.classList.toggle("rtl", RTL.has(lang));
}

function t(key, lang) {
  const L = DICT[lang] || DICT.tr;
  return L[key] ?? DICT.tr[key] ?? key;
}

function apply(root = document) {
  const lang = getLang();
  // textContent / innerHTML
  root.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const html = t(key, lang);
    if (/<br\/?>/i.test(html)) el.innerHTML = html;
    else el.textContent = html;
  });
  // placeholder
  root.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.setAttribute("placeholder", t(key, lang));
  });
  // aria-label
  root.querySelectorAll("[data-i18n-aria-label]").forEach(el => {
    const key = el.getAttribute("data-i18n-aria-label");
    el.setAttribute("aria-label", t(key, lang));
  });
  // slogan listesi
  const sEl = root.querySelector("#slogan");
  if (sEl && Array.isArray(DICT[lang]?._slogans)) {
    sEl.dataset.slogans = JSON.stringify(DICT[lang]._slogans);
  }
}

function getLang() {
  try {
    return localStorage.getItem("tc_lang") || "tr";
  } catch { return "tr"; }
}

function setLang(lang) {
  const L = ["tr","en","ar"].includes(lang) ? lang : "tr";
  try { localStorage.setItem("tc_lang", L); } catch {}
  setAttrsForLang(L);
  apply();
  // dropdown senkron
  const sel = document.getElementById("langSelect");
  if (sel) sel.value = L;
}

function init() {
  const lang = getLang();
  setAttrsForLang(lang);
  apply();
  // dropdown wire
  const sel = document.getElementById("langSelect");
  if (sel) {
    sel.value = lang;
    sel.addEventListener("change", e => setLang(e.target.value));
  }
  // sekmeler arası senkron
  window.addEventListener("storage", (e)=>{
    if (e.key === "tc_lang") setLang(getLang());
  });
  // dışarı aç
  if (!window.__i18n) window.__i18n = {};
  Object.assign(window.__i18n, { setLang, getLang, apply, t });
}

init();
export {};
