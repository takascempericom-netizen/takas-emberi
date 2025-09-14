// Global sözlükler (import yok). HTML'de <script src="data.globals.js"></script> ile yüklenecek.
window.DISTRICTS = {
  "Adana": ["Seyhan","Yüreğir","Çukurova","Sarıçam"],
  "Ankara": ["Çankaya","Keçiören","Yenimahalle","Mamak","Etimesgut"],
  "Antalya": ["Konyaaltı","Muratpaşa","Kepez","Alanya"],
  "Bursa": ["Osmangazi","Yıldırım","Nilüfer","İnegöl"],
  "İstanbul": ["Kadıköy","Üsküdar","Beşiktaş","Bakırköy","Esenyurt","Pendik","Kartal","Maltepe","Ümraniye","Ataşehir"],
  "İzmir": ["Konak","Karşıyaka","Bornova","Buca","Bayraklı"]
};

window.CATEGORIES = {
  "Elektronik": {
    "Telefon": {
      markalar: ["Apple","Samsung","Xiaomi","Huawei"],
      modeller: {
        "Apple": ["iPhone 11","iPhone 12","iPhone 13","iPhone 14"],
        "Samsung": ["S20","S21","S22","A52"],
        "Xiaomi": ["Redmi Note 10","Redmi Note 11","Mi 11"],
        "Huawei": ["P30","P40","Mate 40"]
      }
    },
    "Bilgisayar": {
      markalar: ["Lenovo","Asus","HP","Acer"],
      modeller: {
        "Lenovo": ["IdeaPad","ThinkPad","Legion"],
        "Asus": ["VivoBook","TUF","ROG"],
        "HP": ["Pavilion","Envy","Omen"],
        "Acer": ["Aspire","Nitro","Swift"]
      }
    },
    "Televizyon": {
      markalar: ["LG","Samsung","Sony","Philips"],
      modeller: {
        "LG": ["NanoCell","OLED C1","UQ75"],
        "Samsung": ["Q60","Q70","Crystal UHD"],
        "Sony": ["Bravia X75","Bravia X90"],
        "Philips": ["Ambilight 7300","PUS8506"]
      }
    }
  },
  "Vasıta": {
    "Otomobil": {
      markalar: ["Renault","Fiat","BMW","Volkswagen","Toyota"],
      modeller: {
        "Renault": ["Clio","Megane","Symbol"],
        "Fiat": ["Egea","Linea","Punto"],
        "BMW": ["1.16","3.20","5.20"],
        "Volkswagen": ["Golf","Polo","Passat"],
        "Toyota": ["Corolla","Yaris","Auris"]
      }
    },
    "Motosiklet": {
      markalar: ["Honda","Yamaha","Bajaj","Kuba"],
      modeller: {
        "Honda": ["CBF150","CBR250R","PCX"],
        "Yamaha": ["R25","MT-07","NMax"],
        "Bajaj": ["Pulsar 200NS","Dominar 400"],
        "Kuba": ["Blueberry","Superlight"]
      }
    }
  },
  "Emlak": {
    "Konut": {
      markalar: ["Belirtilmemiş"],
      modeller: { "Belirtilmemiş": ["1+1","2+1","3+1","4+1"] }
    },
    "Arsa": {
      markalar: ["Belirtilmemiş"],
      modeller: { "Belirtilmemiş": ["Tarla","İmarlı Arsa","Bağ/Bahçe"] }
    }
  }
};

window.KM_OPTIONS = [
  "0-10.000","10.001-25.000","25.001-50.000","50.001-100.000","100.001-150.000","150.001+"
];

window.DURUM_OPTIONS = ["Sıfır","İkinci El","Hasarlı","Parça Niyetine"];
