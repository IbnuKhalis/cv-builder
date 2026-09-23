# Proposal: Dukungan Bahasa Indonesia dan Inggris

## Ringkasan keputusan

ATS CV Builder akan mendukung Bahasa Indonesia (`id`) dan English (`en`) melalui dua pengaturan yang berdiri sendiri:

1. **Bahasa antarmuka** mengatur menu, tombol, label form, pesan validasi, onboarding, bantuan, dan status aplikasi.
2. **Bahasa dokumen CV** mengatur heading pada preview/PDF, contoh isi, panduan penulisan, action verbs, dan evaluasi kualitas isi.

Pilihan tersebut tidak menerjemahkan isi yang sudah ditulis pengguna secara otomatis. Pemisahan ini menjaga kontrol pengguna, menghindari terjemahan riwayat kerja yang menyesatkan, dan tetap sesuai dengan prinsip pemrosesan lokal.

## Mengapa fitur ini diperlukan

- Banyak pengguna Indonesia melamar perusahaan multinasional atau posisi remote yang meminta CV berbahasa Inggris.
- Mengganti heading saja tidak cukup. Placeholder, contoh bullet, saran ATS, validasi panjang teks, dan analisis deskripsi pekerjaan juga harus mengikuti bahasa dokumen.
- Sebagian pengguna lebih nyaman mengisi data melalui UI Bahasa Indonesia tetapi membutuhkan PDF English. Karena itu bahasa UI dan bahasa CV harus dapat dipilih terpisah.
- Model data yang eksplisit mencegah bahasa berubah tanpa sengaja ketika pengguna berpindah versi CV.

## Sasaran pengguna

### Skenario A: UI Indonesia, CV Inggris

Pengguna memahami petunjuk dalam Bahasa Indonesia, lalu memilih `English` untuk dokumen. Heading PDF menjadi `Professional Summary`, `Work Experience`, dan seterusnya. Contoh serta saran penulisan juga memakai English.

### Skenario B: UI Inggris, CV Indonesia

Pengguna memakai antarmuka English tetapi membuat dokumen untuk perusahaan Indonesia. Semua kontrol aplikasi memakai English, sedangkan heading PDF dan panduan isi memakai Bahasa Indonesia.

### Skenario C: Dua versi untuk lowongan berbeda

Pengguna menduplikasi CV Indonesia menjadi versi English. Perubahan bahasa dokumen hanya memengaruhi versi hasil duplikasi dan tidak mengubah versi asal.

## Ruang lingkup

### Termasuk dalam rilis pertama

- pemilih bahasa UI `Bahasa Indonesia | English`;
- pemilih bahasa dokumen per versi CV;
- terjemahan seluruh teks sistem yang terlihat pengguna;
- heading preview dan PDF dalam dua bahasa;
- contoh data profesional dan fresh graduate dalam dua bahasa;
- placeholder, contoh bullet pencapaian, action verbs, panduan ATS, checklist, dan pesan validasi yang sesuai bahasa;
- tokenisasi dan stopword Indonesia/Inggris untuk analisis deskripsi pekerjaan;
- nama file PDF yang aman dan netral bahasa;
- persistensi pilihan bahasa serta migrasi draft lama;
- atribut `lang` dokumen dan pengumuman aksesibel saat bahasa berubah;
- pengujian perilaku, visual, aksesibilitas, dan PDF untuk kedua bahasa.

### Di luar ruang lingkup awal

- terjemahan otomatis teks CV yang ditulis pengguna;
- layanan penerjemah, AI eksternal, atau upload data;
- bahasa selain Indonesia dan Inggris;
- konversi format tanggal bebas yang sudah dimasukkan pengguna;
- jaminan tata bahasa atau peluang lolos ATS.

## Prinsip UX

### Dua kontrol bahasa yang jelas

- **Bahasa aplikasi / App language** berada di menu `Lainnya / More` dan berlaku untuk seluruh aplikasi.
- **Bahasa CV / CV language** berada di langkah `Finalisasi / Finalize`, dekat preview dan aksi ekspor, serta berlaku untuk versi CV aktif.
- Tampilkan bantuan singkat: `Bahasa CV mengubah heading dan panduan. Isi yang Anda tulis tidak diterjemahkan otomatis.`
- Setelah bahasa CV berubah, tampilkan toast dan sorot preview agar dampaknya terlihat.

### Perubahan bahasa yang aman

- Mengganti bahasa UI tidak mengubah `cvState` atau isi dokumen.
- Mengganti bahasa CV memperbarui heading, placeholder, panduan, checklist, dan preview, tetapi tidak menulis ulang field pengguna.
- Jika pengguna memilih contoh data baru, tampilkan konfirmasi karena tindakan ini memang mengganti isi draft.
- Saat menduplikasi versi, tawarkan pilihan bahasa dokumen tujuan tanpa menerjemahkan isi.

### Empty state dan bantuan penulisan

- Empty state mengikuti bahasa dokumen agar contoh yang disalin pengguna sesuai dengan CV.
- Builder pencapaian menyediakan action verbs dan pola kalimat sesuai bahasa dokumen.
- Bila isi tampak didominasi bahasa lain, tampilkan peringatan nonblocking: `Sebagian besar isi tampak berbeda dari bahasa CV yang dipilih.` Jangan menghalangi ekspor.

## Terminologi kanonis

| Konsep | Bahasa Indonesia | English |
| --- | --- | --- |
| Ringkasan | Ringkasan Profesional | Professional Summary |
| Pengalaman | Pengalaman Kerja | Work Experience |
| Pendidikan | Pendidikan | Education |
| Keahlian | Keahlian | Skills |
| Proyek | Proyek | Projects |
| Sertifikasi | Sertifikasi | Certifications |
| Organisasi | Organisasi | Organizations |
| Sedang berlangsung | Sekarang | Present |
| Unduh | Unduh PDF | Download PDF |
| Finalisasi | Finalisasi | Finalize |

Gunakan daftar ini sebagai sumber istilah produk. Hindari variasi istilah untuk konsep yang sama dalam satu locale.

## Model data dan persistensi

### State CV per versi

Tambahkan properti berikut pada skema CV:

```js
{
  documentLanguage: "id", // "id" | "en"
  // properti CV lain tetap sama
}
```

- `documentLanguage` disimpan pada setiap versi CV.
- Draft dan versi lama tanpa properti ini dimigrasikan ke `id` agar perilaku lama tidak berubah.
- Naikkan versi skema payload secara eksplisit dan pertahankan migrasi format sebelumnya.

### Preferensi aplikasi

Bahasa UI tidak termasuk isi CV dan disimpan terpisah:

```js
const UI_PREFERENCES_KEY = "ats_cv_builder_ui_preferences_v1";
{
  interfaceLanguage: "id"
}
```

Urutan penentuan bahasa UI:

1. preferensi tersimpan;
2. bahasa browser bila diawali `id` atau `en`;
3. fallback `id`.

Jangan memakai bahasa browser untuk mengubah bahasa dokumen CV yang sudah ada.

## Arsitektur lokalisasi

### Modul yang disarankan

```text
js/
├── i18n.js               # locale aktif, t(), interpolasi, fallback, event perubahan
└── locales/
    ├── id.js             # seluruh string UI Bahasa Indonesia
    └── en.js             # seluruh string UI English
```

API minimal:

```js
t("wizard.profile.title")
t("validation.required", { field: t("fields.email") })
setInterfaceLanguage("en")
getInterfaceLanguage()
getDocumentCopy(documentLanguage)
```

Aturan implementasi:

- gunakan key semantik, bukan kalimat asli sebagai key;
- fallback per key ke Bahasa Indonesia dan tampilkan peringatan development bila key hilang;
- dukung interpolasi sederhana tanpa memasukkan HTML mentah;
- jangan menggunakan `innerHTML` untuk string terjemahan yang mengandung data pengguna;
- string pada `index.html`, `app.js`, `ats-checker.js`, dan `data.js` harus dipindahkan ke katalog sesuai tanggung jawabnya;
- data contoh dan action verbs dapat berada pada berkas locale atau modul konten terpisah selama API konsisten;
- format waktu `Tersimpan ...` memakai `Intl.DateTimeFormat` sesuai locale;
- set `document.documentElement.lang` mengikuti bahasa UI. Container preview diberi `lang` sesuai bahasa CV.

### Analisis deskripsi pekerjaan

- gunakan stopword dan normalisasi token terpisah untuk `id` dan `en`;
- pilih tokenizer berdasarkan bahasa dokumen;
- pertahankan istilah teknis, akronim, angka versi, dan nama tools;
- jangan menerjemahkan keyword;
- tambahkan fixture English agar rekomendasi tidak didominasi kata umum seperti `the`, `and`, `with`, `for`.

## Detail perilaku

### Heading preview dan PDF

Semua heading berasal dari `documentLanguage`, bukan dari bahasa UI. Kontak, nama institusi, jabatan, dan deskripsi tetap berasal dari input pengguna.

### Validasi dan quality checker

- Pesan tampil dalam bahasa UI agar instruksi mudah dipahami.
- Aturan linguistik mengikuti bahasa dokumen. Contoh: action verbs dan rentang kata ringkasan menggunakan sumber konten locale dokumen.
- Nama kategori dalam checklist mengikuti bahasa UI, sedangkan contoh kalimat yang disarankan mengikuti bahasa dokumen.

### Impor dan ekspor JSON

- Ekspor menyertakan `documentLanguage`.
- Impor menerima draft lama tanpa bahasa dan menetapkannya ke `id`.
- Nilai bahasa tidak valid dinormalisasi ke `id`.
- Bahasa UI tidak ikut diekspor karena merupakan preferensi aplikasi, bukan isi CV.

### Nama file PDF

Gunakan pola stabil seperti `<nama>-<target-posisi>-cv.pdf`, dibersihkan dari karakter ilegal. Jangan bergantung pada terjemahan kata `CV` atau `resume`.

## Acceptance criteria

1. Pengguna dapat memilih Bahasa Indonesia atau English untuk UI tanpa reload.
2. Seluruh teks sistem yang terlihat berubah; tidak ada campuran locale kecuali nama produk, istilah teknis, atau input pengguna.
3. Bahasa UI bertahan setelah refresh dan berlaku untuk semua versi.
4. Bahasa CV disimpan per versi dan tidak berubah saat berpindah versi lain.
5. Mengganti bahasa UI tidak mengubah satu pun data CV.
6. Mengganti bahasa CV tidak menerjemahkan atau menghapus input pengguna.
7. Preview dan PDF menggunakan heading sesuai bahasa CV.
8. Contoh data profesional dan fresh graduate tersedia penuh dalam kedua bahasa.
9. Checklist, validasi, bullet builder, panduan ATS, dan pre-export diagnostics memiliki copy yang sesuai.
10. Analisis lowongan English membuang stopword English dan tetap menemukan keyword teknis.
11. Draft lama dimuat sebagai dokumen Bahasa Indonesia tanpa kehilangan data.
12. JSON round-trip mempertahankan bahasa dokumen.
13. `html[lang]` mengikuti bahasa UI dan preview memiliki atribut `lang` sesuai bahasa CV.
14. Seluruh alur dapat dijalankan dengan keyboard dan pergantian bahasa diumumkan melalui live region.
15. PDF Indonesia dan English tetap A4, selectable, tidak clipping, dan urutan ekstraksi teks benar.

## Strategi pengujian

### Unit dan struktur

- semua key `id` dan `en` memiliki pasangan;
- fallback bekerja untuk key yang sengaja dihilangkan pada fixture test;
- interpolasi meng-escape nilai dinamis;
- locale invalid kembali ke `id`;
- migrasi payload lama menambahkan `documentLanguage: "id"`.

### Browser flow

- fresh visit dengan browser `id-ID` dan `en-US`;
- ganti UI `id → en → id` tanpa reload dan tanpa perubahan data;
- UI Indonesia + CV English serta UI English + CV Indonesia;
- buat dua versi dengan bahasa CV berbeda lalu berpindah versi;
- impor/ekspor JSON untuk draft lama dan baru;
- jalankan onboarding, wizard, checklist, JD matcher, modal, serta pre-export pada kedua locale.

### Visual dan PDF

- viewport 390 x 844 dan 1366 x 900 untuk kedua UI;
- cek label English yang lebih panjang tidak overflow atau terpotong;
- PDF satu, dua, dan empat halaman untuk `id` serta `en`;
- ekstraksi teks memastikan heading benar, isi tetap utuh, dan tidak ada teks UI masuk PDF.

## Risiko dan mitigasi

- **String terlewat dan UI bercampur bahasa:** buat tes kesetaraan key serta inventaris string literal yang tampil ke pengguna.
- **Copy English memperlebar tombol:** lakukan visual regression di mobile dan izinkan label membungkus pada komponen yang tepat.
- **Bahasa dokumen merusak draft lama:** gunakan migrasi idempotent dan fixture payload versi lama.
- **Ekspektasi auto-translate:** jelaskan di dekat pemilih bahwa isi tidak diterjemahkan otomatis.
- **Analisis kata kunci salah locale:** gunakan `documentLanguage` sebagai sumber tunggal dan tampilkan bahasa analisis di panel.

## Urutan implementasi yang direkomendasikan

1. Tambahkan model bahasa dan migrasi tanpa mengubah tampilan.
2. Buat fondasi `i18n.js`, katalog `id/en`, fallback, dan tes kesetaraan key.
3. Migrasikan shell UI serta komponen statis.
4. Migrasikan komponen dinamis, validasi, checklist, modal, dan status.
5. Lokalkan heading preview/PDF, bantuan isi, action verbs, serta contoh data.
6. Tambahkan analisis lowongan per bahasa.
7. Jalankan matriks regresi data, UI, aksesibilitas, dan PDF.

## Definition of done

Fitur dianggap selesai bila seluruh acceptance criteria terpenuhi, tidak ada string sistem Indonesia yang muncul pada UI English atau sebaliknya, draft lama aman, dua versi CV dapat memakai bahasa berbeda, dan PDF kedua bahasa lolos pemeriksaan visual serta ekstraksi teks.
