# Rencana kerja: ATS CV Builder Indonesia

Dokumen ini adalah sumber status improvement. Seluruh item **Sprint 1 hingga Sprint 7** (termasuk proposal dukungan penuh bilingual `Bahasa Indonesia` & `English` pada [BILINGUAL_SUPPORT_PROPOSAL.md](BILINGUAL_SUPPORT_PROPOSAL.md)) telah selesai diimplementasikan dan lulus pengujian otomatis (`tests/verify.py` & `tests/test_fixes.py`).

## Berikutnya

*(Tidak ada antrean tertunda — seluruh target Sprint 1 hingga Sprint 7 telah tuntas dan terverifikasi).*

## Keputusan Teknis yang Diterapkan

- **Pemisahan Bahasa Aplikasi (`interfaceLanguage`) & Bahasa Dokumen CV (`documentLanguage`)**:
  - `interfaceLanguage` (`id` | `en`) disimpan pada preferensi aplikasi (`ats_cv_builder_ui_preferences_v1`) dan dapat diganti secara instan melalui menu `Lainnya / More` tanpa me-reload halaman dan tanpa menyentuh isi maupun bahasa dokumen CV pengguna.
  - `documentLanguage` (`id` | `en`) disimpan sebagai bagian dari state setiap versi CV (`version: 2`), menentukan heading kanonik preview/PDF (`Ringkasan Profesional` vs `Professional Summary`, `Pengalaman Kerja` vs `Work Experience`, dll.), label keahlian, kata periode aktif (`Sekarang` vs `Present`), placeholder contoh, serta kamus kata kerja tindakan (*action verbs*) dan *stopwords* pencocok lowongan.
- **Mode Editor Hibrida**: Wizard 5 langkah (`1. Profil`, `2. Pengalaman`, `3. Pendidikan`, `4. Keahlian`, `5. Finalisasi`) ditetapkan sebagai mode default untuk mengurangi beban kognitif, dilengkapi tombol pengalih **`Mode: 5 Langkah` / `Semua Bagian`** (`#btn-toggle-editor-mode`) agar pengguna tetap dapat melihat seluruh bagian sekaligus kapan pun diinginkan.
- **Penyimpanan Multi-Versi**: Menggunakan `localStorage` dengan struktur koleksi terindeks (`indonesian_ats_cv_builder_versions_v1`) yang otomatis menyinkronkan versi aktif ke kunci utama (`indonesian_ats_cv_builder_draft_v1`), dilengkapi migrasi idempotent untuk draft lama (`documentLanguage: "id"`), deteksi data korup non-destruktif, dan tombol unduh cadangan JSON langsung saat kuota penuh.
- **Analisis Deskripsi Lowongan Lokal Bilingual**: Menggunakan ekstraksi kata kunci berbasis tokenisasi dan frekuensi lokal di browser dengan *stopwords* terpisah (`STOPWORDS_ID` & `STOPWORDS_EN`) yang otomatis mengikuti `documentLanguage` CV aktif, mempertahankan istilah teknis/akronim/versi (`Node.js`, `C++`, `CI/CD`, `S1`, `GPA`, `IPK`, `B2B`), serta menampilkan lencana bahasa analisis aktif tanpa klaim peluang lolos ATS.

## Selesai

### Baseline MVP
- [x] MVP editor, live preview, contoh data, autosave dasar, backup JSON, teks polos, dan ekspor melalui print browser tersedia.
- [x] Layout desktop dan mobile dasar telah diuji tanpa horizontal overflow pada 390 px.
- [x] PDF contoh terbukti A4, selectable, tanpa gambar raster, dan tidak kehilangan bullet pada stress test terdahulu.

### Sprint 1 - Keandalan
- [x] Integrasikan `hasAnyCVContent` dan `mergeWithDefaults` dari `storage.js` ke inisialisasi dan impor `app.js`; verifikasi setiap field tunggal bertahan setelah refresh.
- [x] Tambahkan status autosave gagal dan tindakan backup (`#btn-backup-on-error`) serta peringatan pemulihan storage rusak (`#corrupt-storage-alert`) tanpa menimpa data mentah sebelum pengguna mengedit.
- [x] Ubah CSS print agar pengalaman sangat panjang mengalir antarhalaman tanpa ruang kosong besar, tetapi header entri tetap bersama konten awal (`break-after: avoid` pada `.cv-item-header` & `.cv-item-submeta`, `break-inside: avoid; orphans: 2; widows: 2` pada `li`).
- [x] Jalankan dan rapikan tes `tests/test_fixes.py`; pastikan server test memakai port terisolasi dan berhenti setelah tes.
- [x] Tambahkan pemeriksaan visual PDF 1, 2, dan 4+ halaman serta ekstraksi semua bullet (100% utuh untuk 1 halaman, 75 bullet, dan 130 bullet).

### Sprint 2 - UX Inti
- [x] Implementasikan wizard lima langkah dengan navigasi lompat (`#wizard-steps-nav`), tombol `Sebelumnya`/`Lanjut`, dan toggle tampilan semua bagian (`#btn-toggle-editor-mode`) di atas satu state (`cvState`).
- [x] Terapkan jalur onboarding Fresh Graduate/Profesional (`#select-career-track`) pada urutan bagian, teks panduan, contoh poin pencapaian, dan kriteria checklist.
- [x] Tambahkan validasi inline (`aria-describedby`, `.field-error`) dan tombol **`Perbaiki sekarang →`** dari checklist langsung menuju langkah dan field yang bermasalah.
- [x] Pisahkan **Kelengkapan Data** (`#data-completeness-percent`) dari **Kualitas Isi & Dampak** (`#content-quality-percent`) dan gunakan label status jujur (`Perlu Dilengkapi`, `Dasar Selesai`, `Perlu Diperkuat`, `Siap Ditinjau`).
- [x] Sederhanakan header: CTA utama **Unduh PDF**, tombol **Salin Teks**, pemilih versi CV, dan menu dropdown **Lainnya ▾**.
- [x] Implementasikan pratinjau mobile fokus dengan bar aksi mengambang (`← Kembali Mengedit` & `Unduh PDF`), kontrol zoom desktop (`Fit`, `90%`, `100%`), dan indikator estimasi halaman A4 dinamis (`#preview-page-count`).
- [x] Perbaiki aksesibilitas modal (`role="dialog"`, `aria-modal="true"`, Escape, jebakan fokus Tab, pengembalian fokus), ID/label unik pada kartu dinamis, dan dukungan `prefers-reduced-motion`.

### Sprint 3 - Kesiapan Melamar
- [x] Tambahkan pemeriksaan diagnostik pra-ekspor (`#pre-export-summary-box`) di dalam modal cetak PDF yang menampilkan nama file, estimasi halaman A4, peringatan kontak/URL, daftar bagian kosong/disembunyikan, dan tombol `Kembali Memperbaiki`.
- [x] Tambahkan penyusun bullet pencapaian terstruktur (*Tindakan + Metode + Dampak*) di setiap kartu Pengalaman yang hasilnya langsung ditambahkan ke textarea deskripsi dan dapat diedit.
- [x] Tambahkan pengelolaan beberapa versi CV lokal (`#modal-versions-manager`) untuk membuat baru, menduplikasi, mengubah nama, beralih versi, dan menghapus versi dengan migrasi skema otomatis.
- [x] Tambahkan panel urutan dan visibilitas bagian (`#section-order-list`) untuk mengatur urutan naik/turun (`↑`/`↓`) dan menyembunyikan/menampilkan bagian opsional.

### Sprint 4 - Relevansi Lowongan
- [x] Tambahkan analisis lokal deskripsi pekerjaan (`#jd-input-textarea` & `#jd-match-results`) dengan daftar kata kunci yang sudah ada di CV dan yang belum ditemukan.
- [x] Uji kualitas rekomendasi kata kunci lowongan secara lokal tanpa klaim peluang lolos seleksi.

### Sprint 5 - Fondasi Bilingual
- [x] Tambahkan `documentLanguage: "id" | "en"` pada state setiap CV dan naikkan versi skema payload (`version: 2`).
- [x] Buat migrasi idempotent untuk draft/versi lama; nilai kosong atau tidak valid dinormalisasi menjadi `id` tanpa kehilangan data.
- [x] Simpan `interfaceLanguage` secara terpisah pada preferensi aplikasi (`ats_cv_builder_ui_preferences_v1`); gunakan bahasa browser hanya pada kunjungan pertama.
- [x] Buat `js/i18n.js`, `js/locales/id.js`, dan `js/locales/en.js` dengan key semantik (373 key setara 1:1), interpolasi aman, fallback `id`, serta warning development untuk key hilang.
- [x] Tambahkan tes kesetaraan key katalog (`verifyCatalogKeyParity()`), fallback, locale invalid, interpolasi, dan migrasi data.

### Sprint 6 - UI dan Dokumen Bilingual
- [x] Tambahkan pemilih `Bahasa Aplikasi / App Language` (`#select-interface-language`) di menu `Lainnya / More` tanpa reload halaman.
- [x] Tambahkan pemilih `Bahasa Dokumen CV / CV Language` (`#select-document-language` pada langkah `Finalisasi / Finalize` & `#select-preview-doc-language` pada toolbar pratinjau) dan simpan per versi CV.
- [x] Migrasikan seluruh string statis dan dinamis dari HTML/JS ke katalog locale, termasuk modal, toast, status autosave, validasi, checklist, onboarding, dan pre-export.
- [x] Lokalkan heading preview/PDF, placeholder, contoh bullet, builder pencapaian, action verbs, panduan ATS, serta data contoh profesional/fresh graduate (`sampleDataExperiencedEn` & `sampleDataFreshGradEn`).
- [x] Pastikan pergantian bahasa tidak mengubah isi CV, langkah aktif, fokus, posisi scroll, urutan bagian, atau visibilitas bagian.
- [x] Atur `html[lang]` sesuai bahasa UI dan atribut `lang` preview (`#cv-live-document[lang]`) sesuai bahasa CV; umumkan perubahan melalui live region (`#a11y-live-announcer`).

### Sprint 7 - Analisis dan Verifikasi Bilingual
- [x] Tambahkan normalisasi token dan stopword terpisah (`STOPWORDS_ID` & `STOPWORDS_EN`) untuk deskripsi pekerjaan Bahasa Indonesia dan English.
- [x] Tampilkan bahasa analisis yang aktif (`Bahasa Analisis: Indonesia (ID)` / `Analysis Language: English (EN)`) dan pertahankan istilah teknis, akronim, angka versi, serta nama tools.
- [x] Uji kombinasi matriks UI `id/en` × dokumen `id/en`, termasuk dua versi CV dengan bahasa berbeda.
- [x] Uji impor/ekspor JSON baru dan legacy, refresh, duplikasi versi, serta perpindahan versi.
- [x] Uji visual pada 390 × 844 dan 1366 × 900; pastikan label English tidak overflow atau terpotong (`scrollWidth - innerWidth == 0`).
- [x] Hasilkan PDF 1, 2, dan 4+ halaman untuk kedua bahasa; periksa ukuran A4, selectable text, heading, clipping, halaman kosong, dan ekstraksi teks.
- [x] Inventaris seluruh string yang terlihat pengguna dan pastikan tidak ada campuran locale pada alur utama.

Rujukan implementasi: [BILINGUAL_SUPPORT_PROPOSAL.md](BILINGUAL_SUPPORT_PROPOSAL.md).
