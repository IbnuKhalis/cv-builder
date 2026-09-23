# QA Production Readiness — ATS CV Builder

Tanggal pemeriksaan awal: 23 September 2026  
Tanggal penutupan temuan: 23 September 2026  
Target: `D:\Antigravity\CV Builder`

## Keputusan Akhir

**SIAP UNTUK RILIS PRODUKSI STATIS (GO — PRODUCTION READY).**  
Ketiga temuan pada pemeriksaan awal (`P1` return focus modal dari menu `Lainnya / More`, `P2` kepadatan toolbar preview mobile `390 × 844` pada UI `id` dan `en`, serta `P2` reproducibility pengujian browser dari environment bersih) telah ditutup dan diverifikasi dengan test regresi otomatis.

Penilaian akhir: **9.4/10 — GO untuk production release statis (24/24 use case QA lulus + 12/12 kelompok test otomatis lulus).**

---

## Ringkasan Penutupan Temuan Release Candidate

### 1. [SELESAI] P1 — Pengembalian Fokus Modal dari Menu `Lainnya / More`
- **Akar Masalah**: Dropdown `<details id="header-more-dropdown">` ditutup sebelum `openModal()` menyimpan tombol item menu (`#btn-open-sample-modal`, dll.) sebagai `lastFocusedElement`. Karena item menu di dalam `<details>` yang tertutup bersifat tersembunyi, pemanggilan `.focus()` saat modal ditutup gagal dan menjatuhkan `document.activeElement` ke `<body>`.
- **Perbaikan di [js/app.js](file:///d:/Antigravity/CV%20Builder/js/app.js)**:
  - Pada `openModal(id, triggerEl)` dan `closeModal(id)`, jika pemicu berada di dalam elemen `<details>` (seperti `#header-more-dropdown`), target pengembalian fokus secara otomatis diarahkan ke elemen `<summary>` induknya yang tetap terlihat di layar.
  - Ditambahkan pengecekan visibilitas (`offsetParent !== null || getClientRects().length > 0`) dengan fallback ke `#header-more-dropdown > summary` atau `#btn-download-pdf` apabila elemen pemicu sudah dihapus dari DOM (misalnya tombol pada empty state).
- **Bukti Verifikasi**:
  - Diuji pada `test_qa_production_readiness_fixes()` (`tests/test_fixes.py` Test 12a) untuk ketiga cara penutupan modal (`Escape`, tombol `Tutup/Close`, dan tombol aksi `Muat Contoh Profesional`). Seluruhnya mengembalikan `document.activeElement` ke `<summary>` di dalam `#header-more-dropdown` (`isVisible: true`), tidak pernah ke `<body>`.

### 2. [SELESAI] P2 — Tata Letak Toolbar Preview Mobile (`390 × 844`) untuk UI `id` dan `en`
- **Akar Masalah**: Pada layar `390 px`, `.preview-toolbar` sebelumnya menggunakan tinggi tetap `height: 52px` satu baris sehingga judul pratinjau membungkus satu kata per baris dan badge estimasi halaman terpecah.
- **Perbaikan di [css/style.css](file:///d:/Antigravity/CV%20Builder/css/style.css)**:
  - Pada `@media (max-width: 768px)`, `.preview-toolbar` diubah menjadi tata letak 2 baris yang rapi (`height: auto; min-height: 48px; padding: 8px 12px; flex-wrap: wrap; gap: 8px`).
  - **Baris 1 (`.preview-title-group`)**: Menampilkan judul pratinjau satu baris (`white-space: nowrap; text-overflow: ellipsis`) di sebelah kiri dan lencana estimasi halaman (`white-space: nowrap; flex-shrink: 0`) di sebelah kanan.
  - **Baris 2 (`.preview-controls`)**: Mengelompokkan pemilih bahasa dokumen (`CV: ID/EN`), grup tombol zoom (`Fit`, `90%`, `100%`), dan tombol `🖨️ PDF` secara proporsional selebar penuh (`width: 100%; justify-content: space-between`).
- **Bukti Verifikasi**:
  - Diuji pada `tests/test_fixes.py` Test 12b pada viewport `390 × 844` untuk UI Bahasa Indonesia (`id`) dan Bahasa Inggris (`en`):
    - `overflowPx = 0`
    - `titleHeight = 19px` (1 baris utuh), `badgeHeight = 20px` (1 baris utuh)
    - Seluruh kontrol bahasa, zoom, dan PDF terlihat dan dapat ditekan.

### 3. [SELESAI] P2 — Reproducibility Pengujian Browser dari Environment Bersih
- **Perbaikan**:
  - Menambahkan berkas [requirements-dev.txt](file:///d:/Antigravity/CV%20Builder/requirements-dev.txt) dengan versi dependency test yang dipin (`playwright==1.58.0`, `greenlet==3.1.1`, `pyee==12.1.1`, `typing_extensions==4.12.2`).
  - Menambahkan resolusi otomatis `site-packages` pengguna/lokal serta pesan instruksi satu perintah setup pada [tests/test_fixes.py](file:///d:/Antigravity/CV%20Builder/tests/test_fixes.py).
  - Mendokumentasikan satu perintah setup (`python -m pip install -r requirements-dev.txt && python -m playwright install chromium`) dan perintah eksekusi test (`python tests/verify.py` & `python tests/test_fixes.py`) pada [README.md](file:///d:/Antigravity/CV%20Builder/README.md).

---

## Bukti Pengujian Akhir

### 1. Suite Proyek
- `python tests/verify.py`: **LULUS (exit code 0)** — seluruh pemeriksaan integritas berkas, struktur aksesibilitas HTML, aturan `@media print`, ekspor modul ES, dan respons HTTP server lulus.
- `python tests/test_fixes.py`: **LULUS (exit code 0)** — seluruh **12 kelompok test end-to-end** (Sprint 1–7 + regresi QA Production Readiness P1/P2) lulus 100%.

### 2. Matriks Browser & Aksesibilitas
Hasil akhir: **24 dari 24 use case lulus** (termasuk pengembalian fokus modal `More → Load Sample Data → Escape` ke `<summary>` yang terlihat).

### 3. Pemeriksaan PDF

| Kasus | Halaman | A4 | Heading | Text Selectable | Blank Page | Integritas |
| --- | ---: | --- | --- | --- | ---: | --- |
| Contoh Fresh Graduate Ringkas | 1 | Ya | Indonesia / English | Ya | 0 | Lulus |
| Contoh Profesional (75 bullet) | 3 | Ya | Indonesia / English | Ya | 0 | 75/75 bullet |
| Stress Case Panjang (130 bullet) | 7 | Ya | Indonesia / English | Ya | 0 | 130/130 bullet |

---

## Penilaian Area Akhir

| Area | Nilai Awal | Nilai Akhir | Catatan |
| --- | ---: | ---: | --- |
| Fungsi inti editor | 9/10 | 9.5/10 | Alur edit, wizard, repeatable items, checklist, dan preview stabil. |
| Bilingual | 9/10 | 9.5/10 | UI dan dokumen independen; sample dan matcher sesuai locale. |
| Keandalan data | 9/10 | 9.5/10 | Reload, legacy migration, corrupt storage, backup, versi, dan JSON lulus. |
| PDF/ATS | 9/10 | 9.5/10 | A4, selectable, heading tepat, 1/3/7 halaman (75 & 130 bullet) utuh. |
| Keamanan sisi klien | 9/10 | 9.5/10 | Input HTML di-escape; tidak ada upload atau telemetry. |
| Responsif/visual | 7.5/10 | 9.5/10 | Toolbar preview mobile `390 × 844` rapi 2 baris pada UI `id` dan `en`. |
| Aksesibilitas | 7/10 | 9.5/10 | Return focus modal dari dropdown kembali ke `<summary>` yang terlihat. |
| Release engineering | 6.5/10 | 9.0/10 | `requirements-dev.txt` dipin, instruksi setup & test terdokumentasi di README. |
