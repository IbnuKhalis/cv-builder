# Arsitektur: ATS CV Builder Indonesia

## Gambaran sistem

Aplikasi adalah web statis tanpa backend dan tanpa dependency runtime eksternal.

- `index.html` menyediakan struktur editor, toolbar, modal, dan wadah preview.
- `css/style.css` mengatur UI aplikasi serta layout responsif.
- `css/cv-ats.css` mengatur dokumen CV dan aturan cetak A4.
- `js/data.js` menyimpan skema default, contoh fiktif, dan data panduan.
- `js/storage.js` menangani localStorage, migrasi/normalisasi draft, serta impor-ekspor JSON.
- `js/ats-checker.js` menghitung kelengkapan dan menghasilkan rekomendasi.
- `js/app.js` mengelola state, binding DOM, render form, preview, interaksi, autosave, dan print.
- `server.py` menyediakan server statis lokal dengan MIME type dan no-cache untuk development.
- `tests/` berisi pemeriksaan struktur dan regresi browser/PDF.

Untuk dukungan bilingual, tambahkan `js/i18n.js` sebagai API lokalisasi serta katalog `js/locales/id.js` dan `js/locales/en.js`. Hindari menambahkan dependency runtime untuk kebutuhan ini.

## Alur data

1. Saat startup, `storage.js` membaca payload localStorage.
2. Draft dinormalisasi terhadap skema `defaultEmptyCV`; data rusak menghasilkan fallback aman.
3. `app.js` menyimpan state aktif dan merender editor serta preview dari state yang sama.
4. Perubahan field memperbarui state, preview, checklist, lalu autosave secara debounce.
5. Ekspor JSON mengambil state aktif; impor JSON divalidasi dan dinormalisasi sebelum mengganti state.
6. Ekspor PDF memakai print engine browser dan stylesheet `@media print` agar output tetap berupa teks.
7. Bahasa UI dibaca dari preferensi lokal terpisah; bahasa dokumen dibaca dari versi CV aktif.
8. Render UI memakai locale antarmuka, sedangkan preview, contoh isi, dan aturan linguistik memakai locale dokumen.

## Aturan implementasi

- Gunakan satu fungsi normalisasi dan satu fungsi pendeteksi draft; jangan duplikasi logika di `app.js`.
- Semua output HTML dari data pengguna harus di-escape.
- Pisahkan penilaian kelengkapan dari kualitas isi agar UI tidak menyiratkan skor ATS absolut.
- Perubahan wizard sebaiknya tetap menggunakan satu state, bukan membuat salinan state per langkah.
- Multi-version CV, bila dibuat, harus mempunyai versi skema dan migrasi eksplisit.
- Analisis deskripsi pekerjaan berjalan lokal dan tidak menyimpan deskripsi tanpa pemberitahuan.
- Gunakan key lokalisasi semantik dengan fallback per key ke `id`; jangan jadikan kalimat tampilan sebagai key.
- `interfaceLanguage` adalah preferensi aplikasi dan tidak boleh dimasukkan ke state CV.
- `documentLanguage` adalah bagian state setiap versi CV dan menerima nilai `id` atau `en` saja.
- Migrasi payload lama harus idempotent dan menetapkan `documentLanguage: "id"` bila properti belum ada atau tidak valid.
- Pesan checker memakai bahasa UI, sedangkan contoh kalimat, action verbs, tokenisasi, dan stopword memakai bahasa dokumen.
- Jangan memasukkan HTML mentah dari katalog locale; interpolasi nilai dinamis harus tetap di-escape.

## Pilihan teknologi dan alasannya

Vanilla HTML, CSS, dan ES Modules dipertahankan karena aplikasi kecil, lokal, mudah dijalankan, dan tidak membutuhkan build. Python hanya digunakan untuk server development. Chromium/Playwright dan alat PDF dipakai untuk verifikasi, bukan sebagai dependency aplikasi pengguna.

## Batasan operasional

- localStorage dapat dibersihkan browser dan memiliki kapasitas terbatas; ekspor JSON tetap diperlukan sebagai backup.
- `window.print()` bergantung pada dialog dan pengaturan browser pengguna.
- CSS pagination berbeda tipis antarbrowser; Chrome/Edge menjadi target verifikasi utama dan Firefox diperiksa secara manual bila diperlukan.
- Data CV mengandung informasi pribadi; jangan menambahkan telemetry, upload, atau layanan eksternal tanpa keputusan produk dan persetujuan pengguna.

## Kontrak lokalisasi

API minimal menyediakan `t(key, params)`, setter/getter bahasa UI, fallback key, dan akses ke konten bahasa dokumen. Kesetaraan key katalog `id` dan `en` harus diuji otomatis. Preferensi UI disimpan pada kunci terpisah seperti `ats_cv_builder_ui_preferences_v1`, sedangkan perubahan skema CV menaikkan versi payload dan tetap dapat membaca format lama.

Spesifikasi data, perilaku, serta risiko implementasi tersedia di [BILINGUAL_SUPPORT_PROPOSAL.md](BILINGUAL_SUPPORT_PROPOSAL.md).
