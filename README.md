# ATS CV Builder Indonesia 📄🇮🇩

Aplikasi web modern, ringan, dan mudah digunakan untuk membuat Curriculum Vitae (CV) berstandar **Applicant Tracking System (ATS)** berbahasa Indonesia.

Dirancang khusus untuk pencari kerja di Indonesia—mulai dari **Fresh Graduate (Lulusan Baru)** hingga **Profesional Berpengalaman**—agar menghasilkan dokumen lamaran kerja yang mudah dibaca oleh sistem ATS internasional (Workday, Taleo, Greenhouse, Lever, Glints, Jobstreet, Kalibrr) serta rekruter manusia.

---

## 🌟 Fitur Utama

1. **Format Single-Column Murni Sesuai Standar ATS**:
   - Mematuhi tata letak satu kolom tanpa sidebar atau tabel kompleks yang membingungkan parser ATS.
   - Heading bagian baku: `Ringkasan Profesional`, `Pengalaman Kerja`, `Pendidikan`, `Keahlian`, `Proyek & Portofolio`, `Sertifikasi & Lisensi`, `Pengalaman Organisasi`.
   - Bebas dari elemen yang menurunkan skor parsing: **tanpa foto, tanpa ikon/simbol dekoratif, tanpa grafik rating bintang/persentase, tanpa tabel multi-kolom**.

2. **Ekspor PDF Teks Asli (Selectable Real Text)**:
   - Menghasilkan PDF berbasis teks vektor murni (bukan screenshot gambar/raster).
   - Seluruh teks dapat diseleksi, dicari (Ctrl+F), dan diekstrak 100% oleh parser.
   - Paginasi A4 presisi dengan proteksi `break-inside: avoid` sehingga entri pengalaman/pendidikan tidak terpotong canggung di batas halaman.

3. **Penyembunyian Otomatis Bagian Kosong (Empty Section Auto-Hide)**:
   - Bagian yang tidak diisi (misal: jika belum memiliki sertifikasi atau proyek) otomatis tidak ditampilkan di CV tanpa meninggalkan ruang kosong.

4. **Dukungan Penuh Lulusan Baru (Fresh Graduate Mode)**:
   - Opsi pengaturan urutan bagian instan: posisikan **Pendidikan** dan **Pengalaman Organisasi / Proyek** di atas Pengalaman Kerja.
   - Dilengkapi preset data contoh khusus Fresh Graduate.

5. **2 Pilihan Data Contoh Fiktif Bahasa Indonesia**:
   - **Profesional Berpengalaman**: Senior Software Engineer (5+ tahun pengalaman, metrik pencapaian kuantitatif, arsitektur teknis).
   - **Fresh Graduate**: Lulusan Baru S1 Manajemen Bisnis (Cum Laude, pengalaman magang, kepemimpinan BEM, proyek riset).

6. **Penyimpanan Draft Lokal & Cadangan JSON**:
   - Otomatis tersimpan ke `localStorage` browser saat Anda mengetik (auto-save debounced).
   - Fitur **Ekspor JSON** untuk mencadangkan data ke file dan **Impor JSON** untuk memulihkan draft di perangkat lain.

7. **Salin Teks Polos (Plain Text ATS)**:
   - Salin seluruh isi CV ke clipboard dalam format teks polos berstruktur rapi hanya dengan 1 klik, siap ditempel ke formulir rekrutmen daring (*easy apply*).

8. **Evaluasi Kelengkapan Profil Real-Time**:
   - Indikator progres kelengkapan profil dan saran konstruktif (deteksi metrik angka, kata kerja aksi Bahasa Indonesia).
   - *Tanpa klaim palsu jaminan kelulusan 100% ATS.*

9. **Tanpa Ketergantungan Eksternal (Zero External Build Tooling)**:
   - Berjalan murni menggunakan standar web HTML5, CSS3, dan Vanilla JavaScript (ES Modules).
   - Tidak memerlukan instalasi package npm atau koneksi internet eksternal.

---

## 🚀 Cara Menjalankan Aplikasi Secara Lokal

Aplikasi ini dapat dijalankan menggunakan server lokal Python:

```bash
# Jalankan server lokal (Port default: 3000)
python server.py
```

Buka peramban (browser) Anda dan akses:
👉 **`http://localhost:3000`** atau **`http://127.0.0.1:3000`**

---

## 🧪 Pengujian Otomatis & Setup Environment Bersih

Aplikasi utama tidak membutuhkan dependency tambahan apa pun. Untuk menjalankan suite verifikasi statis dan pengujian browser/PDF otomatis dari environment/checkout bersih:

```bash
# 1. Satu perintah setup dependency test yang dipin (hanya untuk development/QA)
python -m pip install -r requirements-dev.txt && python -m playwright install chromium

# 2. Jalankan pemeriksaan statis, arsitektur, dan HTTP server
python tests/verify.py

# 3. Jalankan suite pengujian end-to-end browser, aksesibilitas, bilingual, mobile 390x844, dan PDF A4
python tests/test_fixes.py
```

---

## 📁 Struktur Direktori Proyek

```
CV Builder/
├── index.html          # Halaman utama aplikasi (Editor + Live Preview + Modals)
├── server.py           # Server HTTP statis lokal berbasis modul Python standard
├── README.md           # Dokumentasi teknis & panduan penggunaan
├── css/
│   ├── style.css       # Desain antarmuka editor, cards, modals, dan layout responsif
│   └── cv-ats.css      # Desain dokumen CV berstandar ATS (Layar & @media print)
└── js/
    ├── data.js         # Model data awal, preset contoh fiktif, & aturan tips ATS
    ├── storage.js      # Manajemen LocalStorage & Impor/Ekspor berkas JSON
    ├── ats-checker.js  # Penganalisis kepatuhan format & kelengkapan profil
    └── app.js          # Pengendali logika utama, DOM binding, dan live preview
```

---

## 🖨️ Panduan Mengunduh PDF di Browser

1. Klik tombol **"Unduh PDF"** di pojok kanan atas aplikasi.
2. Pada jendela dialog cetak peramban (*Print Dialog*):
   - **Tujuan (Destination):** Pilih `Simpan sebagai PDF (Save as PDF)`.
   - **Ukuran Kertas (Paper Size):** Pilih `A4`.
   - **Margin:** Pilih `Default` atau `None`.
   - **Header & Footer:** Hilangkan centang (nonaktifkan) agar URL dan tanggal browser tidak tercetak di tepi dokumen.
3. Klik **Simpan (Save)**. Berkas PDF Anda siap dikirim ke portal karir!

---

## ⚠️ Batasan Teknis & Catatan Etis

1. **Jaminan Skor ATS**: Tidak ada aplikasi atau algoritma pihak ketiga yang dapat menjamin pelamar 100% lolos seleksi kerja, karena keputusan akhir tetap bergantung pada kesesuaian kualifikasi kandidat dengan deskripsi pekerjaan yang dicari oleh masing-masing perusahaan. Aplikasi ini memastikan bahwa format dokumen Anda mematuhi standar teknis terbaik yang dapat dipindai secara optimal oleh mesin ATS tanpa mengalami kesalahan pembacaan teks (*parsing error*).
2. **Pengaturan Cetak Peramban**: Browser Chromium (Google Chrome, Microsoft Edge, Brave) dan Firefox menangani konversi cetak ke PDF teks vektor secara sempurna. Pastikan opsi 'Header & Footer' dimatikan agar hasil cetak bersih.

---

## Dokumentasi Proyek

- [Kebutuhan produk dan acceptance criteria](docs/PRD.md)
- [Desain pengalaman dan aksesibilitas](docs/DESIGN.md)
- [Arsitektur dan alur data](docs/ARCHITECTURE.md)
- [Roadmap dan status implementasi](docs/TODO.md)
- [Proposal improvement lengkap](docs/IMPROVEMENT_PROPOSAL.md)
- [Proposal dukungan Bahasa Indonesia dan English](docs/BILINGUAL_SUPPORT_PROPOSAL.md)
- [Laporan QA dan production readiness](docs/QA_PRODUCTION_READINESS.md)
- [Re-verifikasi QA 23 September 2026](docs/QA_REVERIFICATION_2026-09-23.md)
- [Rencana deployment VPS](docs/VPS_DEPLOYMENT_PLAN.md)

## Aturan Khusus Proyek

- Pertahankan aplikasi sebagai web app lokal berbasis Vanilla HTML, CSS, dan ES modules. Tambahkan dependency hanya jika manfaatnya jelas dan sudah disetujui.
- Pertahankan keluaran PDF yang sederhana, dapat diseleksi sebagai teks, dan mudah dipindai ATS.
- Proses data CV di perangkat pengguna. Jangan menambahkan upload eksternal, telemetry, atau pengiriman data tanpa persetujuan eksplisit.
- Ikuti arsitektur serta konvensi yang sudah ada dan hindari refactor di luar kebutuhan fitur.
- Saat mengimplementasikan roadmap, perbarui `docs/TODO.md` dan tambahkan pengujian perilaku untuk alur kritis yang berubah.
