# 📑 PDF & JSON Bounding Box Inspector & NLP Cümle Editörü

PDF belgeleri üzerindeki OCR ve layout verilerini görselleştiren, Türkçe NLP kurallarıyla cümle segmentasyonu yapan, 6 farklı tablo tipine göre akıllı okuma sırası belirleyen ve BBox düzenlemelerine imkan tanıyan web tabanlı etkileşimli editör.

---

## 🚀 Temel Özellikler

- **🧠 Akıllı Türkçe NLP Cümle Ayrıştırma:**
  - `vb.`, `sn.`, `Madde 16:` gibi kısaltma ve istisnaları bölmez.
  - Birden fazla satıra yayılan cümlelerin tüm satır kutularına **aynı `sentence_id`**'yi atar.

- **📊 6 Tipli Tablo Sınıflandırma & Okuma Sırası Motoru:**
  - **A_MATRIX:** Klasik Satır × Sütun matris tablosu (Z-okuma sırası).
  - **B_KEY_VALUE:** Etiket : Değer form tabloları.
  - **C_PARALLEL_TEXT:** Sütun bazlı çoklu paragraf tablosu (Önce sol sütun baştan sona, sonra sağ sütun; satır içi NLP cümle birleştirme desteğiyle).
  - **D_MERGED_CELLS:** Birleşik hücreli / hiyerarşik tablolar.
  - **E_FORMULA:** Matematiksel ve formül tabloları.
  - **F_HYBRID_NOTE:** Dipnotlu ve açıklamalı tablolar.

- **🎯 Etkileşimli Bounding Box Editörü:**
  - 8 tutamaç ile BBox boyutlandırma ve sürükleyerek taşıma.
  - Serbest çizim modu (**Draw Mode**) ile yeni BBox oluşturma.
  - ID ve metin düzenleme, cümle birleştirme (**Add to Existed**), silme ve güncel JSON indirme.

- **🔊 TTS Sesli Okuma:**
  - Belgeyi veya seçili cümleyi belirlenen okuma sırasına göre seslendirme ve hız kontrolü (0.75x - 2.0x).

---

## 📂 Proje Yapısı

```text
directly_detect_bbox/
├── index.html               # Ana web arayüzü
├── table-tester.html        # Tablo laboratuvarı ve test arayüzü
├── css/style.css            # Modern karanlık/aydınlık tema stilleri
├── js/
│   ├── app.js               # Uygulama mantığı ve durum yönetimi
│   ├── bbox-parser.js       # JSON ve koordinat ayrıştırma motoru
│   ├── table-classifier.js  # 6 tipli tablo okuma sırası motoru
│   ├── sentence-splitter.js # NLP cümle ve BBox hesaplayıcı
│   ├── overlay.js           # BBox çizim, seçim, sürükleme ve boyutlandırma
│   ├── pdf-viewer.js        # PDF render ve sayfa ölçekleme
│   └── tts-reader.js        # Sesli okuma yöneticisi
└── sample_data/             # Örnek PDF ve JSON test verileri
```

---

## 🛠️ Hızlı Başlangıç

Derleme (build) gerektirmez. Doğrudan statik sunucuyla çalıştırılabilir:

```bash
python -m http.server 8080
```

Tarayıcınızda açın:
👉 **`http://localhost:8080`**

---

## 📖 Hızlı Kullanım

1. **Yükle:** PDF ve JSON dosyalarınızı üst bardan yükleyin.
2. **İncele & Seç:** PDF üzerindeki numaralandırılmış kutulara tıklayarak sağ panelden cümle ve tablo bilgilerini görün.
3. **Tablo Tipi Değiştir:** Tablo hücreleri için sağ panelden tablo tipini (örn. `C — Paralel Paragraf`) seçip anında okuma sırasını güncelleyin.
4. **Düzenle:** Tutamaçlarla kutuları yeniden boyutlandırın veya yeni kutular çizin.
5. **Dışa Aktar:** **JSON İndir** butonu ile düzenlenen verileri kaydedin.
