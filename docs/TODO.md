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

### Audit Kesiapan V0.2 & Hardening Integritas Data (9 Oktober 2026)
- [x] **F1**: Propagasi kegagalan penyimpanan secara atomik dan rollback draft jika koleksi versi gagal disimpan (`js/storage.js`).
- [x] **F2**: Penanganan autosave debounce flush pada perpindahan versi, pembuatan versi baru, duplikasi, reset, dan lifecycle reload/pagehide (`js/app.js`).
- [x] **F3**: Sanitasi mendalam seluruh item array dan field impor JSON valid sintaks agar tidak menyebabkan crash pada startup (`js/storage.js`, `js/app.js`).
- [x] **F4**: Sinkronisasi storage antar-tab untuk mencegah tab idle menimpa tab yang sedang mengedit (`js/app.js`).
- [x] **F5**: Penanganan reset formulir yang mengosongkan data versi aktif baik di draft maupun di koleksi multi-versi secara konsisten (`js/storage.js`, `js/app.js`).
- [x] **F6**: Fitur pencadangan lengkap seluruh versi CV (`exportFullBackupJSON`) dan pemulihannya (`restoreFullBackup`) dengan tombol dedicated di UI (`#btn-export-full-backup`).
- [x] **F7**: Penyelarasan dokumentasi batas privasi edge Cloudflare Web Analytics dan transparansi arsitektur lokal (`docs/VPS_DEPLOYMENT_PLAN.md`).
- [x] **F8**: Penerapan cache busting berbasis parameter versi `?v=0.2.0` pada seluruh asset publik dan konfigurasi no-cache ketat pada `index.html`.
- [x] **F9**: Penguncian CI/CD agar hanya commit SHA teruji yang dideploy, penambahan concurrency guard, pull_request verification, dan loop bounded health check (`.github/workflows/deploy.yml`).
- [x] **F10**: Pembuatan test suite regresi audit `tests/test_audit_fixes.py` yang memvalidasi penutupan seluruh temuan F1–F6 (100% lulus).

### Audit Review Hardening R1–R7 (10 Oktober 2026)
- [x] **R1 (P1)**: Kontrak field sanitizer diselaraskan 100% dengan model CV kanonik (`institution`, `title`, `tech`, `year`, `credentialUrl`, `isCurrent`) tanpa mengubah nama properti, dan selector form `.edu-institution` didukung penuh.
- [x] **R2 (P1)**: Pengosongan `saveDebounceTimer = null` saat callback autosave selesai, memastikan tab idle tidak lagi dianggap memiliki edit tertunda dan menerima sinkronisasi antar-tab tanpa menimpa perubahan.
- [x] **R3 (P1)**: Penanganan kegagalan `flushAutoSave()` secara ketat; aksi pindah versi, buat versi, duplikasi, reset, hapus, dan muat sampel dibatalkan jika flush atau penulisan penyimpanan gagal.
- [x] **R4 (P1)**: Pemulihan cadangan (`restoreFullBackup`) mengimplementasikan rollback multi-key atomik (`VERSIONS_KEY`, `ACTIVE_VERSION_KEY`, `STORAGE_KEY`) dengan blok terisolasi saat penulisan draf gagal, menjamin koleksi sehat tidak rusak.
- [x] **R5 (P1)**: Penolakan ketat skema versi masa depan (`schemaVersion > 2` atau tipe tidak dikenal) serta validasi record CV sebelum penulisan apa pun dilakukan.
- [x] **R6 (P1)**: Penerapan cache-busting `?v=0.2.0` secara konsisten pada seluruh graf ketergantungan modul ES internal (`app.js`, `storage.js`, `data.js`, `ats-checker.js`, `i18n.js`, dan katalog locale).
- [x] **R7 (P2)**: Integrasi state in-memory editor (`cvState`) ke dalam `exportFullBackupJSON()`, menjamin cadangan darurat tetap mencakup edit terkini meskipun diekspor di tengah jendela debounce.
- [x] **CI/CD Hardening**: Penghentian alur workflow dengan `exit 1` dan pencatatan log container jika healthcheck timeout dalam 30 detik, serta penambahan curl smoke test endpoint publik HTTPS.

### Audit Review Putaran Kedua Hardening S1–S4 (10 Oktober 2026)
- [x] **S1 (P1)**: Pelacakan status dirty independen (`isStateDirty`) yang tidak hilang saat autosave/flush gagal, memastikan retry perpindahan versi setelah storage pulih tetap mengeksekusi flush dan menyimpan perubahan ke versi aktif tanpa kehilangan edit.
- [x] **S2 (P1)**: Pelacakan granular seluruh field dirty lokal (`dirtyFields = new Set()`), mencegah sinkronisasi parsial antar-tab menimpa input yang sedang diedit pengguna dalam jendela debounce (misal pengisian multi-field profil).
- [x] **S3 (P1)**: Pengikatan handler dinamis (`getItem()`) pada kartu berulang (Pengalaman, Pendidikan, Proyek, Sertifikasi, Organisasi) serta re-rendering form terkait saat partial sync, menjamin interaksi pengguna selalu menulis ke model data aktif.
- [x] **S4 (P1)**: Validasi struktur dan tipe data record CV secara mendalam (`validateCVStructure()`), menolak berkas cadangan dengan tipe field rusak (misal `profile: 42`) sebelum mutasi penyimpanan dilakukan.

### Audit Review Putaran Ketiga Hardening T1–T3 (10 Oktober 2026)
- [x] **T1 (P1)**: Pengikatan state editor dan penulisan storage ke ID versi aktif secara eksplisit (`currentVersionId`), penyertaan `versionId` pada payload draft `STORAGE_KEY`, penguncian penulisan draft hanya pada versi aktif, penolakan merge lintas-versi, dan pembersihan pending edits seketika ke `VERSIONS_KEY` saat tab remote berganti versi.
- [x] **T2 (P2)**: Perluasan cakupan sinkronisasi parsial non-konflik antar-tab ke seluruh field persisten (`documentLanguage`, `careerTrack`, `jobDescriptionText`, `sectionOrder`, `hiddenSections`, `settings`) dengan pelacakan dirty yang konsisten (`dirtyFields`).
- [x] **T3 (P1)**: Penanganan kegagalan penyimpanan pada alur impor satu CV; mempertahankan status dirty (`isStateDirty = true`), menampilkan status error dan tombol cadangan darurat (bukan toast sukses), serta menjamin integritas data impor tersimpan saat reload setelah storage pulih.

### Audit Review Putaran Keempat Hardening U1 (10 Oktober 2026)
- [x] **U1 (P1)**: Pengikatan identitas versi editor (`currentVersionId`) secara konsisten pada ekspor cadangan lengkap (`exportFullBackupJSON`), aksi reset formulir (`resetActiveCVVersion`), pill label versi (`#active-version-label`), dan daftar modal pengelola versi. Mencegah penimpaan data versi lain saat dua tab membuka versi berbeda dan mempertahankan data Candidate A & B secara terisolasi.

### Audit Review Putaran Kelima Hardening V1 (10 Oktober 2026)
- [x] **V1 (P1)**: Penanganan versi yang dihapus dari tab lain; `syncActiveVersionData` dan `saveCVToStorage` memvalidasi keberadaan target ID dan mengembalikan false jika record tidak ada (mencegah klaim simpan palsu dan mempertahankan dirty state), UI menampilkan status error dan tombol cadangan darurat (`#btn-backup-on-error`), pill label UI menampilkan status konflik (`Versi Terhapus (Konflik)`), dan ekspor backup darurat (`exportFullBackupJSON`) menyimpan edit orphan sebagai record terpisah tanpa menimpa `versions[0]` (Candidate A tetap utuh).

### Audit Review Putaran Keenam Hardening W1 (10 Oktober 2026)
- [x] **W1 (P1)**: Sinkronisasi data versi nonaktif antar-tab melalui listener `VERSIONS_KEY` di `js/app.js`. Ketika tab remote mengedit versi yang sedang dibuka tab lokal (namun versi tersebut sedang bukan versi aktif global di `ACTIVE_VERSION_KEY`), listener `VERSIONS_KEY` mengekstrak data versi yang cocok (`currentVersionId`) dan menerapkannya via `applyIncomingVersionData` (sinkronisasi penuh jika idle, penggabungan field non-konflik jika dirty). Dilengkapi pelacakan timestamp ISO (`lastAppliedDataTimestamp`) untuk mencegah event usang atau duplikasi menimpa edit lokal terbaru, dan reset timestamp saat pergantian konteks/versi. Menjamin edit independen di tab berbeda pada versi yang sama tidak saling menimpa.

### Audit Review Putaran Ketujuh Hardening X1 (10 Oktober 2026)
- [x] **X1 (P1)**: Sinkronisasi pemulihan cadangan lengkap lama lintas-tab (`restoreFullBackup`) di `js/storage.js` dan `js/app.js`. Seluruh record versi yang dipulihkan kini distempel dengan timestamp saat pemulihan berlangsung (`updatedAt: restoreTimestamp`), sementara metadata riwayat tetap dipelihara di `historicalUpdatedAt`. Timestamp penyimpanan lokal pada `saveCVToStorage`, `resetActiveCVVersion`, dan `restoreFullBackup` diselaraskan secara deterministik via `getLastSavedTimestamp()`. Menjamin tab lain yang membuka versi nonaktif menerima dan memproses data hasil pemulihan cadangan lama tanpa terblokir oleh filter dedup timestamp historis, serta mempertahankan integritas edit berikutnya.

### Audit Review Putaran Kedelapan Hardening Y1 (10 Oktober 2026)
- [x] **Y1 (P1)**: Sinkronisasi kompensasi rollback lintas-tab pada kegagalan pemulihan cadangan lengkap (`restoreFullBackup`) dan operasi multi-key lainnya di `js/storage.js`. Ketika penulisan draft (`STORAGE_KEY`) gagal dan memicu `rollback()`, snapshot `VERSIONS_KEY` dan `STORAGE_KEY` yang dikembalikan ke penyimpanan lokal distempel dengan timestamp rollback strictly monotonic (`rollbackIso = Math.max(Date.now(), attemptMs + 1)`). Hal ini memastikan tab remote yang telah menerima event restore sementara tidak mengabaikan event rollback (`rollbackTimestamp > attemptTimestamp`), sehingga tab remote membatalkan data restore sementara, kembali ke state snapshot yang benar, dan tidak menimpa data yang dibatalkan pada siklus autosave berikutnya.

### Audit Review Putaran Kesembilan Hardening Z1 (11 Oktober 2026)
- [x] **Z1 (P1)**: Pembangkit revisi strictly monotonic menyeluruh (`getNextMonotonicIso`) pada seluruh operasi LocalStorage dan rollback bertingkat (nested rollback) di `js/storage.js`. Mengatasi tabrakan revisi ketika beberapa penulisan dan kompensasi terjadi dalam satu tick milidetik (same-tick clock). Generator memperhitungkan `Date.now()`, revisi in-memory tertinggi yang sudah diterbitkan (`highestPublishedMs`), revisi storage aktual di `VERSIONS_KEY` dan `STORAGE_KEY` (`getHighestStorageMs()`), serta revisi induk/referensi. Menjamin kompensasi luar (`restoreFullBackup` rollback) memiliki revisi strictly greater daripada kompensasi dalam (`saveCVToStorage` rollback), sehingga tab remote tidak menolak koreksi snapshot sebagai event duplikat dan integritas data lokal maupun remote 100% terjaga.

Rujukan implementasi: [BILINGUAL_SUPPORT_PROPOSAL.md](BILINGUAL_SUPPORT_PROPOSAL.md), [AUDIT_IMPLEMENTATION_V0.2.md](AUDIT_IMPLEMENTATION_V0.2.md), & [REVIEW_AG_2026-10-10.md](REVIEW_AG_2026-10-10.md).
