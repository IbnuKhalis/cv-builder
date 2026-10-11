# Laporan Implementasi Temuan Audit Codex V0.2

Tanggal implementasi: **9 Oktober 2026**.
Baseline audit: [`docs/AUDIT_READINESS_V0.2_2026-10-09.md`](file:///d:/Antigravity/CV%20Builder/docs/AUDIT_READINESS_V0.2_2026-10-09.md).

---

## Ringkasan Eksekutif

Seluruh 10 temuan audit dari Codex (F1–F10) telah dianalisis, diimplementasikan, dan diverifikasi dengan suite pengujian regresi otomatis. Aplikasi kini memiliki jaminan integritas data yang tangguh: kegagalan penyimpanan dilaporkan secara konsisten dengan snapshot rollback best-effort, jeda debounce diflush secara andal sebelum peralihan versi dan lifecycle reload, payload impor disanitasi mendalam tanpa risiko crash saat startup, tab multi-jendela disinkronkan tanpa saling menimpa data, reset versi membersihkan koleksi secara konsisten, backup mencakup seluruh versi CV, dan pipeline CI/CD mengunci deployment commit SHA yang telah teruji.

---

## Matriks Status Temuan Audit

| Temuan | Tingkat | Status | Lokasi Perubahan | Bukti Verifikasi |
|---|---|---|---|---|
| **F1 — Kegagalan simpan koleksi versi dilaporkan berhasil** | P1 | **Selesai** | `js/storage.js:26-50, 320-335` | `tests/test_audit_fixes.py` (Test F1 PASS) |
| **F2 — Edit terakhir hilang saat ganti versi / reload cepat** | P1 | **Selesai** | `js/app.js` (`flushAutoSave`, lifecycle `pagehide`/`beforeunload`) | `tests/test_audit_fixes.py` (Test F2 PASS) |
| **F3 — Impor JSON valid sintaks merusak startup** | P1 | **Selesai** | `js/storage.js` (`mergeWithDefaults`, sanitasi array), `js/app.js` | `tests/test_audit_fixes.py` (Test F3 PASS) |
| **F4 — Dua tab dapat saling menimpa perubahan** | P1 | **Selesai** | `js/app.js` (`setupCrossTabSync`, `syncNonConflictingFields`) | `tests/test_audit_fixes.py` (Test F4 PASS) |
| **F5 — Reset meninggalkan data versi aktif di koleksi** | P2 | **Selesai** | `js/storage.js` (`resetActiveCVVersion`), `js/app.js` | `tests/test_audit_fixes.py` (Test F5 PASS) |
| **F6 — Backup belum mencakup seluruh data pengguna** | P2 | **Selesai** | `js/storage.js`, `index.html`, `js/locales/id.js`, `js/locales/en.js` | `tests/test_audit_fixes.py` (Test F6 PASS) |
| **F7 — Penyelarasan privasi live & edge Cloudflare** | P2 | **Selesai** | `docs/VPS_DEPLOYMENT_PLAN.md`, `README.md` | Dokumentasi terselaraskan; zero CV telemetry terkonfirmasi |
| **F8 — Cache asset publik mencampur release** | P2 | **Selesai** | `index.html` (`?v=0.2.0`), `deploy/default.conf` | `tests/verify.py` PASS, HTML `no-store, no-cache` |
| **F9 — CI/CD menjamin commit teruji dideploy** | P2 | **Selesai** | `.github/workflows/deploy.yml` | `concurrency`, `git checkout ${{ github.sha }}`, healthcheck loop |
| **F10 — Cakupan dokumentasi dan tes kesiapan V0.2** | P2 | **Selesai** | `tests/test_audit_fixes.py`, `tests/verify.py`, `docs/*` | 6 test audit PASS, 12 test existing PASS, verify PASS |

---

## Rincian Perbaikan Teknis

### 1. F1: Propagasi Error & Rollback Storage Best-Effort (`js/storage.js`)
- **Masalah**: `syncActiveVersionData` sebelumnya menelan error (swallow exception), sehingga ketika kuota penyimpanan koleksi versi habis, `saveCVToStorage` tetap mengembalikan `true` dan UI melaporkan tersimpan.
- **Solusi**:
  - `syncActiveVersionData` tidak lagi menelan error.
  - `saveCVToStorage` menangkap kegagalan sinkronisasi versi, melakukan rollback nilai draft sebelumnya di `STORAGE_KEY`, mencatat `lastStorageStatus = "save_error"`, dan mengembalikan `false`.
  - UI secara otomatis menampilkan indikator peringatan penyimpanan dan tombol cadangan darurat (`#btn-backup-on-error`).

### 2. F2: Flush Autosave & Lifecycle Halaman (`js/app.js`)
- **Masalah**: Debounce 350ms menyebabkan edit pengguna hilang jika pengguna langsung mengklik beralih versi, membuat versi baru, atau mereload halaman sebelum 350ms berakhir.
- **Solusi**:
  - Implementasi fungsi `flushAutoSave()` yang mengecek apakah ada `saveDebounceTimer` aktif; jika ada, debounce segera dibatalkan dan data disimpan secara sinkron ke penyimpanan lokal.
  - `flushAutoSave()` dipanggil sebelum beralih versi (`.btn-switch-version`), membuat versi baru, menduplikasi versi, menghapus versi, mereset CV, atau memuat dataset contoh.
  - Penambahan event listener lifecycle `pagehide`, `visibilitychange` (state hidden), dan `beforeunload` untuk memastikan reload cepat atau penutupan tab mengeksekusi flush draft ke browser storage.

### 3. F3: Sanitasi Mendalam Payload Impor & Ketahanan Startup (`js/storage.js`, `js/app.js`)
- **Masalah**: Impor dengan item array bernilai `null` (seperti `experience: [null]`) lolos validasi awal dan merusak rendering dengan error `Cannot read properties of null (reading 'startDate')`.
- **Solusi**:
  - Penambahan fungsi sanitasi item untuk seluruh bagian berulang: `sanitizeExperienceItem`, `sanitizeEducationItem`, `sanitizeProjectItem`, `sanitizeCertificationItem`, dan `sanitizeOrganizationItem`.
  - `mergeWithDefaults` memfilter elemen `null`/tidak valid dan menjamin setiap objek memiliki semua field bertipe string/array/boolean yang diharapkan.
  - Inisialisasi awal aplikasi (`initApp`) dibungkus dalam blok `try...catch` aman; jika terjadi kesalahan render data tersimpan, aplikasi secara otomatis pulih ke formulir bersih, memunculkan banner peringatan, dan tidak membiarkan layar menjadi blank.

### 4. F4: Sinkronisasi Storage Antar-Tab (`js/app.js`)
- **Masalah**: Dua tab yang membuka draft secara bersamaan dapat saling menimpa isian satu sama lain karena masing-masing menyimpan snapshot memori lengkap tanpa revisi.
- **Solusi**:
  - Penambahan listener event `storage` global (`setupCrossTabSync`).
  - Jika tab berada dalam kondisi idle (tidak ada input lokal tertunda), state diperbarui dan antarmuka disinkronkan secara mulus.
  - Jika pengguna sedang aktif mengetik di satu field (misalnya target posisi), fungsi `syncNonConflictingFields` menyelaraskan perubahan field lain dari tab luar (misalnya email) ke dalam memori tanpa menimpa field yang sedang difokuskan pengguna.

### 5. F5: Konsistensi Reset Versi Aktif (`js/storage.js`, `js/app.js`)
- **Masalah**: Tombol konfirmasi reset mengosongkan draft utama namun membiarkan data versi aktif di `VERSIONS_KEY` tetap tersimpan.
- **Solusi**:
  - Penambahan fungsi `resetActiveCVVersion(emptyData)` di `js/storage.js` yang secara konsisten mengosongkan data versi aktif baik di draft utama maupun di daftar koleksi multi-versi dengan snapshot rollback, sembari menjaga versi CV lainnya tetap utuh.

### 6. F6: Pencadangan Lengkap Seluruh Versi CV (`js/storage.js`, `index.html`, `js/locales/*`)
- **Masalah**: Ekspor JSON lama hanya mengambil satu draft aktif tanpa menyertakan metadata dan versi lainnya.
- **Solusi**:
  - Implementasi fungsi `exportFullBackupJSON()` yang menghasilkan payload terstruktur dengan tipe `indonesian_ats_cv_builder_full_backup`, `schemaVersion: 2`, `activeVersionId`, dan seluruh array versi.
  - Penambahan fungsi `restoreFullBackup()` yang memvalidasi dan menormalisasi seluruh versi sebelum menyimpannya ke penyimpanan browser.
  - Peningkatan `importCVFromJSON` agar mendeteksi otomatis apakah berkas adalah CV tunggal atau cadangan lengkap.
  - Penambahan tombol UI `Cadangkan Semua Versi (JSON)` (`#btn-export-full-backup`) pada menu dropdown header dengan dukungan bilingual lengkap (ID & EN).

### 7. F7: Penyelarasan Kebijakan Privasi Edge & Dokumentasi
- **Masalah**: Perbedaan konfigurasi live CSP akibat injeksi beacon script otomatis oleh Cloudflare Web Analytics di level domain `digitalneeds.my.id`.
- **Tindak Lanjut**:
  - Didokumentasikan secara transparan pada `docs/VPS_DEPLOYMENT_PLAN.md` dan `README.md` bahwa script `static.cloudflareinsights.com` berasal dari dashboard Cloudflare Edge untuk metrik performa web anonim.
  - Ditegaskan bahwa zero personal CV data dikirim ke pihak ketiga; seluruh pemrosesan dan penyimpanan CV tetap 100% lokal di browser pengguna.

### 8. F8: Cache Busting Asset Publik (`index.html`, `deploy/default.conf`)
- **Masalah**: Header cache asset CSS/JS dari proxy berpotensi mencapai 4 jam sementara URL tidak memiliki penanda versi, berisiko mencampur rilis kode baru dengan modul lama.
- **Solusi**:
  - Menambahkan query parameter rilis `?v=0.2.0` pada tautan CSS (`style.css?v=0.2.0`, `cv-ats.css?v=0.2.0`) dan script modul (`js/app.js?v=0.2.0`) pada `index.html`.
  - Mengonfigurasi `location = /index.html` pada Nginx (`deploy/default.conf`) dengan header ketat `Cache-Control: "no-cache, no-store, must-revalidate" always`.

### 9. F9: Jaminan Deployment Commit Teruji di CI/CD (`.github/workflows/deploy.yml`)
- **Masalah**: Job deployment sebelumnya menjalankan `git pull origin main`, yang berisiko men-deploy commit berbeda jika ada commit baru yang masuk saat testing berjalan, serta belum memiliki concurrency guard.
- **Solusi**:
  - Menambahkan grup `concurrency: { group: 'production-deploy', cancel-in-progress: false }` untuk menserialkan deployment secara aman.
  - Menambahkan trigger `pull_request: branches: [ main ]` agar pengujian berjalan di setiap PR.
  - Mengunci proses checkout di VPS menggunakan commit SHA yang persis sama dengan yang diuji: `git fetch origin ${{ github.sha }} && git reset --hard ${{ github.sha }}`.
  - Menambahkan bounded wait loop untuk healthcheck container (maksimal 30 detik) sebelum verifikasi HTTP 200 dan reload Caddy.

### 10. F10: Pengujian & Kesiapan Gerbang Rilis V0.2
- **Solusi**:
  - Pembuatan suite pengujian regresi audit khusus: `tests/test_audit_fixes.py` yang mereproduksi dan memvalidasi penutupan temuan F1 sampai F6.
  - Pembaruan `tests/verify.py` untuk menguji integritas seluruh file dan pola regex asset versioning.
  - Pengujian awal menghasilkan kelulusan seluruh kelompok uji pada commit baseline.

---

## Babak Review Independen & Hardening Lanjutan (R1–R7, 10 Oktober 2026)

Berdasarkan review audit independen pada [`docs/REVIEW_AG_2026-10-10.md`](file:///d:/Antigravity/CV%20Builder/docs/REVIEW_AG_2026-10-10.md), ditemukan 7 temuan lanjutan (R1–R7) terkait kontrak field sanitizer, status idle tab autosave, penanganan kegagalan flush, rollback restore, validasi skema, dan cache ketergantungan modul. Seluruh temuan tersebut kini telah diatasi secara komprehensif:

| Temuan Review | Tingkat | Status | Lokasi Perubahan | Bukti Verifikasi |
|---|---|---|---|---|
| **R1 — Sanitizer menghapus field model CV valid** | P1 | **Selesai** | `js/storage.js:232-304`, `js/app.js:1122` | Probe 1 & 2 PASS (`review_ag_2026-10-10.py`), Test R1 PASS |
| **R2 — Tab autosave tetap dianggap pending edit** | P1 | **Selesai** | `js/app.js:2262, 2300-2350` | Probe 7 PASS (`review_ag_2026-10-10.py`), Test R2 PASS |
| **R3 — Pindah/aksi versi tetap berjalan saat flush gagal** | P1 | **Selesai** | `js/app.js:2172-2210, 2560-2675` | Probe 3 PASS (`review_ag_2026-10-10.py`), Test R3 PASS |
| **R4 — Restore mengganti koleksi sebelum penulisan selesai** | P1 | **Selesai** | `js/storage.js:730-845` | Probe 4 PASS (`review_ag_2026-10-10.py`), Test R4 PASS |
| **R5 — Skema masa depan merusak koleksi sehat** | P1 | **Selesai** | `js/storage.js:710-740` | Probe 5 PASS (`review_ag_2026-10-10.py`), Test R5 PASS |
| **R6 — Dependency graph ES module tidak berversi** | P1 | **Selesai** | `js/app.js`, `storage.js`, `i18n.js`, `ats-checker.js` | Probe 8 PASS (`review_ag_2026-10-10.py`), Test R6 PASS |
| **R7 — Full backup mengabaikan edit pending debounce** | P2 | **Selesai** | `js/storage.js:670-705`, `js/app.js:415` | Probe 6 PASS (`review_ag_2026-10-10.py`), Test R7 PASS |

### Rincian Perbaikan Teknis R1–R7:
1. **R1**: Kontrak field diselaraskan dengan skema aplikasi (`isCurrent`, `institution`, `title`, `tech`, `year`, `credentialUrl`) dengan fallback backward-compatibility. Input institusi pada form mendukung selector `.edu-institution` dan `.edu-inst`.
2. **R2**: `saveDebounceTimer = null;` diatur tepat saat callback autosave dieksekusi. Tab yang sudah idle otomatis melakukan sinkronisasi penuh saat event `storage` diterima tanpa menimpa perubahan eksternal.
3. **R3**: Seluruh pemanggil `flushAutoSave()` (ganti versi, buat versi baru, duplikasi, reset, hapus versi, muat sampel) memeriksa nilai return boolean. Jika flush atau penulisan penyimpanan gagal, tindakan dibatalkan dan form mempertahankan edit pengguna di memori.
4. **R4**: Fungsi `restoreFullBackup()` mengambil snapshot lengkap (`VERSIONS_KEY`, `ACTIVE_VERSION_KEY`, `STORAGE_KEY`) sebelum memodifikasi LocalStorage. Jika penulisan draf aktif gagal, seluruh kunci dipulihkan secara best-effort snapshot rollback dan error dilempar kembali (re-thrown).
5. **R5**: Skema cadangan diverifikasi secara ketat (`schemaVersion <= 2`, tipe yang dikenali, dan properti CV yang valid). Skema masa depan (misal `schemaVersion: 999`) ditolak seketika sebelum mutasi storage apa pun terjadi.
6. **R6**: Seluruh import internal antar modul ES (`data.js`, `storage.js`, `ats-checker.js`, `i18n.js`, serta file locale `id.js` & `en.js`) kini menyertakan query string `?v=0.2.0`, mencegah browser menyajikan modul usang dari cache publik.
7. **R7**: `exportFullBackupJSON()` menerima fallback state in-memory `cvState` dari editor. Jika backup diunduh sebelum timer debounce selesai atau ketika autosave terhambat, payload cadangan darurat tetap memuat perubahan terbaru pengguna.
8. **CI/CD Bounded Healthcheck & Smoke Test**: Loop healthcheck container pada `.github/workflows/deploy.yml` menggagalkan job secara eksplisit dengan `exit 1` dan mencetak log container jika tidak sehat dalam 30 detik, serta melakukan verifikasi smoke test publik via HTTPS.

---

## Resolusi Review Putaran Kedua Codex (Temuan S1–S4)

Pada review lanjutan (10 Oktober 2026), Codex mengidentifikasi empat skenario edge-case lanjutan (S1–S4). Seluruhnya telah diperbaiki dan diverifikasi:

| Temuan Review R2 | Tingkat | Status | Komponen Terkait | Bukti Verifikasi |
| --- | --- | --- | --- | --- |
| **S1 — Retry switch setelah kegagalan flush kehilangan edit** | P1 | **Selesai** | `js/app.js:64, 2284-2347, 2230-2275` | Probe S1 PASS (`review_ag_round2_2026-10-10.py`), Test S1 PASS |
| **S2 — Partial sync menimpa field dirty yang tidak berfokus** | P1 | **Selesai** | `js/app.js:65, 853-865, 2355-2420` | Probe S2 PASS (`review_ag_round2_2026-10-10.py`), Test S2 PASS |
| **S3 — Penggantian array saat sync memutus referensi handler** | P1 | **Selesai** | `js/app.js:1005-1525, 2385-2415` | Probe S3 PASS (`review_ag_round2_2026-10-10.py`), Test S3 PASS |
| **S4 — Validasi backup menerima record dengan tipe field rusak** | P1 | **Selesai** | `js/storage.js:789-875, 880-915` | Probe S4 PASS (`review_ag_round2_2026-10-10.py`), Test S4 PASS |

### Rincian Perbaikan Teknis S1–S4:
1. **S1 (Persistent Dirty State Guard)**: Variabel `isStateDirty` diperkenalkan terpisah dari `saveDebounceTimer`. Status dirty hanya dibersihkan saat penulisan penyimpanan benar-benar berhasil (`savedOk === true`). Jika percobaan flush pertama gagal karena kuota atau galat IO, status dirty tetap dipertahankan. Saat pengguna mencoba switch kembali setelah storage pulih, `flushAutoSave()` secara otomatis mengeksekusi flush dan menyimpan perubahan ke versi aktif sebelum berpindah.
2. **S2 (Granular Dirty Fields Set)**: State melacak kumpulan field yang dimodifikasi secara lokal (`dirtyFields = new Set()`). Logika `syncNonConflictingFields()` melindungi seluruh field yang sedang dirty atau aktif, sehingga pengisian multi-field dalam jendela debounce (misal email lalu target posisi) tidak ditimpa oleh event storage dari tab lain.
3. **S3 (Dynamic Item Lookup & Handler Re-binding)**: Seluruh event handler pada bagian berulang (Pengalaman, Pendidikan, Proyek, Sertifikasi, Organisasi) menggunakan helper dinamis `getItem()` yang mencocokkan record berdasarkan ID stabil atau indeks dari `cvState` terkini. Selain itu, saat partial sync menerima array baru yang tidak berkonflik, fungsi render terkait dipanggil ulang untuk memperbarui pengikatan DOM ke model data aktif.
4. **S4 (Deep Data Structure & Type Validation)**: Fungsi `validateCVStructure()` diperkenalkan untuk memeriksa tipe data setiap bagian record CV sebelum mutasi penyimpanan (`profile`, `skills`, dan `settings` harus berupa object; section berulang harus berupa array; field teks harus berupa string). Berkas backup atau impor dengan tipe data rusak (seperti `{profile: 42}`) ditolak seketika tanpa mengubah koleksi LocalStorage yang sudah ada.
5. **Klarifikasi Batasan Arsitektur Rollback**: Rollback multi-kunci pada LocalStorage (`VERSIONS_KEY`, `ACTIVE_VERSION_KEY`, `STORAGE_KEY`) beroperasi secara *best-effort synchronous snapshot rollback* pada runtime JavaScript browser. Aplikasi tidak mengklaim transaksi terdistribusi ACID lintas tab atau thread terisolasi.

---

## Resolusi Review Putaran Ketiga Codex (Temuan T1–T3, 10 Oktober 2026)

Pada review putaran ketiga (10 Oktober 2026, 09:49–09:53 WIB), Codex menemukan tiga skenario edge-case lanjutan (T1–T3):

| Temuan Review R3 | Tingkat | Status | Komponen Terkait | Bukti Verifikasi |
| --- | --- | --- | --- | --- |
| **T1 — Pergantian versi tab lain membuat edit tersimpan ke CV salah** | P1 | **Selesai** | `js/app.js`, `js/storage.js` (`saveCVToStorage`, `currentVersionId`) | Probe T1 PASS (`review_ag_round3_2026-10-10.py`), Test T1 PASS |
| **T2 — Partial sync mengabaikan bahasa dokumen dan menimpanya** | P2 | **Selesai** | `js/app.js` (`syncNonConflictingFields`, dirty tracking) | Probe T2 PASS (`review_ag_round3_2026-10-10.py`), Test T2 PASS |
| **T3 — Impor single CV dianggap berhasil saat save gagal** | P1 | **Selesai** | `js/app.js` (import file handler, dirty persistence) | Probe T3 PASS (`review_ag_round3_2026-10-10.py`), Test T3 PASS |

### Rincian Perbaikan Teknis T1–T3:
1. **T1 (Eksplisit Versi Asal & Isolasi Multi-Tab)**:
   - State editor diikat ke ID versi aktif secara eksplisit via `currentVersionId` pada `js/app.js`.
   - `saveCVToStorage(data, targetVersionId)` menerima parameter `targetVersionId` eksplisit, menjamin pembaruan data selalu menyasar record versi yang tepat di `VERSIONS_KEY`.
   - Payload draft utama (`STORAGE_KEY`) kini memuat `versionId: verIdToSave`.
   - Penyimpanan ke `STORAGE_KEY` hanya dilakukan jika `verIdToSave === getActiveVersionId()`. Jika tab remote telah beralih ke versi lain, tab lokal menyimpan pending edit versinya langsung ke `VERSIONS_KEY` tanpa menimpa draft aktif versi lain.
   - Pada event `storage` untuk `STORAGE_KEY`, tab memeriksa kecocokan `incomingVersionId` dengan `currentVersionId` lokal. Jika berbeda, data tidak dimerge antar-versi.
   - Pada event `storage` untuk `ACTIVE_VERSION_KEY`, jika tab lokal memiliki pending edits, `flushAutoSave()` seketika menyimpan perubahan ke versinya sendiri di `VERSIONS_KEY` sebelum UI beralih.
2. **T2 (Sinkronisasi Seluruh Field Persisten Non-Konflik)**:
   - `syncNonConflictingFields` diperluas mencakup seluruh field persisten: `documentLanguage`, `careerTrack`, `jobDescriptionText`, `sectionOrder`, `hiddenSections`, dan `settings`.
   - Pelacakan dirty dilakukan secara konsisten melalui `dirtyFields.add(...)` pada setiap mutasi kontrol UI terkait.
   - Pengubahan bahasa dokumen di Tab A kini disinkronkan dan dipertahankan saat Tab B melakukan autosave field profil lokalnya.
3. **T3 (Integritas Penyimpanan Impor Single CV & Retensi Dirty State)**:
   - Handler impor single CV kini memeriksa nilai return boolean dari `saveCVToStorage()`.
   - Jika penulisan draft/storage gagal (misal kuota penuh), aplikasi mempertahankan `isStateDirty = true`, menambahkan `dirtyFields.add("import")`, menampilkan tombol cadangan darurat (`#btn-backup-on-error`), dan memunculkan toast error (bukan toast sukses).
   - `flushAutoSave()` mengembalikan `false` selama storage gagal, sehingga tidak ada klaim sukses palsu.
   - Begitu storage dipulihkan dan halaman direload, lifecycle flush mengeksekusi penyimpanan data impor ke storage tanpa kehilangan data pengguna.

---

## Resolusi Review Putaran Keempat Codex (Temuan U1, 10 Oktober 2026)

Pada review putaran keempat (10 Oktober 2026, 10:56–10:59 WIB), Codex menemukan satu temuan P1 tersisa terkait konsistensi identitas versi editor:

| Temuan Review R4 | Tingkat | Status | Komponen Terkait | Bukti Verifikasi |
| --- | --- | --- | --- | --- |
| **U1 — Backup dan reset menggunakan versi global, padahal editor tetap membuka versi lokal** | P1 | **Selesai** | `js/app.js`, `js/storage.js` (`exportFullBackupJSON`, `resetActiveCVVersion`, `updateActiveVersionPill`, `renderVersionsModalList`) | Probe U1 PASS (`review_ag_round4_2026-10-10.py`), Test U1 PASS |

### Rincian Perbaikan Teknis U1:
1. **Ekspor Cadangan Lengkap Terisolasi (`exportFullBackupJSON`)**:
   - `exportFullBackupJSON(fileNameOrState, fallbackState, sourceVersionId)` kini menerima parameter eksplisit `sourceVersionId` (diisi dari `currentVersionId` lokal editor).
   - Penggabungan in-memory pending edits (`currentState`) hanya menyasar record versi sumber (`effectiveSourceId = targetVersionId || activeVersionId`) dalam daftar `versions`. Record versi lain (termasuk Candidate A) dipertahankan utuh dan tidak ditimpa oleh `cvState` dari tab yang sedang mengedit Version B.
   - Payload draft (`STORAGE_KEY`) dalam berkas backup hanya disinkronkan ke `currentState` jika versi sumber sama dengan versi aktif global di penyimpanan lokal (`effectiveSourceId === activeVersionId`), sehingga draft versi aktif tetap mencerminkan data pemilik aslinya.
2. **Aksi Reset Formulir Terisolasi (`resetActiveCVVersion`)**:
   - `resetActiveCVVersion(emptyData, targetVersionId)` kini menerima parameter `targetVersionId` eksplisit (diisi `currentVersionId || getActiveVersionId()`).
   - Hanya record yang cocok dengan `verIdToReset` dalam `VERSIONS_KEY` yang dikosongkan.
   - Draft utama `STORAGE_KEY` hanya dikosongkan jika `verIdToReset === activeId`. Jika Tab B mereset formulir Version B saat Tab A sedang mengaktifkan Version A, data Version A dan draftnya tidak disentuh sedikit pun.
   - Pada handler `#btn-confirm-reset-action` di `js/app.js`, `currentVersionId` tetap dipertahankan pada `targetVerId` (tidak dialihkan kembali ke global `getActiveVersionId()`).
3. **Penyelarasan Label dan Modal Pengelola Versi**:
   - `updateActiveVersionPill()` dan `renderVersionsModalList()` kini menggunakan `const activeId = currentVersionId || getActiveVersionId();`.
   - Pill `#active-version-label` di Tab B secara konsisten menampilkan nama dan bahasa versi yang sedang aktif di tab tersebut (misal `Version B (ID)`), bukan versi global dari Tab A.
   - Modal daftar versi secara akurat menandai versi yang sedang dibuka tab tersebut sebagai aktif, dan tombol "Buka Versi" tersedia untuk versi lainnya.

---

## Resolusi Review Putaran Kelima Codex (Temuan V1, 10 Oktober 2026)

Pada review putaran kelima (10 Oktober 2026, mulai 11:40 WIB), Codex menemukan satu temuan P1 lanjutan terkait penghapusan versi dari tab lain:

| Temuan Review R5 | Tingkat | Status | Komponen Terkait | Bukti Verifikasi |
| --- | --- | --- | --- | --- |
| **V1 — Versi yang dihapus dari tab lain tetap diklaim tersimpan dan mencemari backup** | P1 | **Selesai** | `js/storage.js` (`syncActiveVersionData`, `saveCVToStorage`, `resetActiveCVVersion`, `exportFullBackupJSON`), `js/app.js` (`updateActiveVersionPill`, `VERSIONS_KEY` listener) | Probe V1 PASS (`review_ag_round5_2026-10-10.py`), Test V1 PASS |

### Rincian Perbaikan Teknis V1:
1. **Validasi Eksistensi Target Version pada Operasi Penyimpanan & Reset**:
   - `syncActiveVersionData()` kini memverifikasi keberadaan `activeId` di dalam koleksi `items`. Jika target versi tidak ditemukan (misal telah dihapus oleh tab lain), fungsi mengembalikan `false`.
   - `saveCVToStorage()` memeriksa nilai return tersebut. Jika sinkronisasi gagal karena record target tidak ada, penyimpanan membatalkan operasi, mencatat status `save_error`, dan mengembalikan `false`.
   - Hal ini mencegah klaim sukses palsu pada autosave; status dirty (`isStateDirty`) tetap dipertahankan, UI menampilkan status error dan tombol cadangan darurat (`#btn-backup-on-error`), dan `flushAutoSave()` mengembalikan `false`.
   - `resetActiveCVVersion()` juga menolak eksekusi dan mengembalikan `false` jika ID target tidak ditemukan di dalam koleksi.
2. **Preservasi Edit Orphan & Proteksi Rekord Sehat pada Cadangan Lengkap (`exportFullBackupJSON`)**:
   - Ketika `effectiveSourceId` tidak ditemukan dalam koleksi `versions` (versi lokal dihapus dari tab lain), fungsi **TIDAK lagi menimpa `versions[0]`** (Draft Utama / Candidate A).
   - Sebaliknya, in-memory state pengguna disematkan sebagai record baru ber-ID unik (`name: 'CV Terpulihkan (Sesi Terpisah)'`), sehingga perubahan pengguna tetap dapat dipulihkan melalui backup tanpa merusak integritas data versi lain.
   - Draft aktif global (`STORAGE_KEY`) dalam cadangan tetap mempertahankan data Candidate A.
3. **Deteksi Versi Terhapus & Label UI Konflik Terbuka**:
   - Event listener `storage` pada kunci `VERSIONS_KEY` memeriksa apakah `currentVersionId` masih ada di dalam `loadCVVersions()`. Jika tidak ditemukan, UI segera menampilkan status galat simpan dan memunculkan tombol cadangan darurat.
   - `updateActiveVersionPill()` tidak lagi jatuh kembali ke `versions[0]` jika versi aktif lokal tidak ditemukan; pill secara jujur menampilkan `Versi Terhapus (Konflik)` (atau `Deleted Version (Conflict)`).

---

## Resolusi Review Putaran Keenam Codex (Temuan W1, 10 Oktober 2026)

Pada review putaran keenam (10 Oktober 2026, mulai 18:36 WIB), Codex menemukan satu temuan P1 lanjutan terkait sinkronisasi editor ketika membuka versi nonaktif yang diedit di tab lain:

| Temuan Review R6 | Tingkat | Status | Komponen Terkait | Bukti Verifikasi |
| --- | --- | --- | --- | --- |
| **W1 — Editor tidak menerima perubahan data dari VERSIONS_KEY ketika draft global milik versi lain** | P1 | **Selesai** | `js/app.js` (`setupCrossTabSync`, `applyIncomingVersionData`, `flushAutoSave`, `triggerAutoSave`) | Probe W1 PASS (`review_ag_round6_2026-10-10.py`), Test W1 PASS (`tests/test_audit_fixes.py`) |

### Rincian Perbaikan Teknis W1:
1. **Sinkronisasi Data Rekord Versi dari Listener `VERSIONS_KEY`**:
   - Sebelumnya, penyimpanan versi nonaktif hanya menulis ke `VERSIONS_KEY` (agar tidak menimpa draft global milik versi aktif di `STORAGE_KEY`). Namun listener `VERSIONS_KEY` di tab lain hanya memperbarui pill metadata dan daftar modal tanpa menerapkan data rekord ke `cvState`. Akibatnya, editor tab lain mempertahankan snapshot lama dan dapat menimpa field yang diedit tab pertama saat tab kedua melakukan autosave.
   - Pada perbaikan ini, listener `VERSIONS_KEY` mengekstrak rekord versi yang cocok dengan `currentVersionId` lokal. Jika ditemukan dan memuat `matchingVer.data`, dipanggil fungsi `applyIncomingVersionData(matchingVer.data, matchingVer.updatedAt)`.
   - Menggunakan jalur sinkronisasi yang sama dengan `STORAGE_KEY`: tab idle menerima pembaruan penuh, sementara tab dirty mempertahankan field lokal yang sedang diedit dan menggabungkan field non-konflik lainnya (`syncNonConflictingFields`).
2. **Dedup & Pencegahan Event Usang via Timestamp ISO (`lastAppliedDataTimestamp`)**:
   - `applyIncomingVersionData()` memeriksa `timestamp` kiriman event terhadap `lastAppliedDataTimestamp`. Jika `timestamp <= lastAppliedDataTimestamp`, event usang atau duplikasi diabaikan.
   - Saat tab lokal berhasil menyimpan (`flushAutoSave` atau `triggerAutoSave`), `lastAppliedDataTimestamp` diperbarui ke `new Date().toISOString()`.
   - Saat pengguna berpindah versi, membuat/menduplikasi versi, mereset formulir, atau mengimpor data, `lastAppliedDataTimestamp` direset ke `null` sehingga timeline versi baru bersih dari timestamp sesi sebelumnya.

---

## Resolusi Review Putaran Ketujuh Codex (Temuan X1, 10 Oktober 2026)

Pada review putaran ketujuh (10 Oktober 2026, mulai 19:27 WIB), Codex menemukan satu temuan P1 lanjutan terkait pemulihan cadangan lengkap lama:

| Temuan Review R7 | Tingkat | Status | Komponen Terkait | Bukti Verifikasi |
| --- | --- | --- | --- | --- |
| **X1 — Timestamp historis backup membuat tab lain menolak hasil restore** | P1 | **Selesai** | `js/storage.js` (`restoreFullBackup`, `getLastSavedTimestamp`), `js/app.js` (`applySampleByTrack`, `flushAutoSave`, `triggerAutoSave`) | Probe X1 PASS (`review_ag_round7_2026-10-10.py`), Test X1 PASS (`tests/test_audit_fixes.py`) |

### Rincian Perbaikan Teknis X1:
1. **Penetapan Revisi/Timestamp Sinkronisasi Terkini pada Seluruh Record Terpulihkan (`restoreFullBackup`)**:
   - Sebelumnya, `restoreFullBackup` mempertahankan `v.updatedAt` langsung dari berkas cadangan JSON. Ketika berkas cadangan yang dipulihkan adalah berkas lama (dibuat sebelum tab lain melakukan autosave lokal), timestamp historis tersebut lebih lama daripada `lastAppliedDataTimestamp` di tab lain. Akibatnya, tab lain menolak event `VERSIONS_KEY` karena menganggapnya event usang/duplikat, dan form editor tab lain tetap menampilkan data sebelum restore yang kemudian menimpa hasil restore saat autosave berikutnya.
   - Pada perbaikan ini, `restoreFullBackup` menstempel seluruh record versi yang dipulihkan dengan timestamp pemulihan saat itu (`updatedAt: restoreTimestamp`), sementara tanggal historis cadangan tetap dipelihara di field `historicalUpdatedAt`.
2. **Sinkronisasi Deterministik Timestamp Simpan Lokal via `getLastSavedTimestamp()`**:
   - `js/storage.js` kini mengekspor `getLastSavedTimestamp()`, mencatat persis ISO string yang ditulis ke LocalStorage saat operasi `saveCVToStorage`, `resetActiveCVVersion`, dan `restoreFullBackup`.
   - `js/app.js` menggunakan nilai tersebut pada `lastAppliedDataTimestamp = getLastSavedTimestamp() || new Date().toISOString()`, menjamin token dedup lokal 100% selaras dengan payload storage.

---

## Resolusi Review Putaran Kedelapan Codex (Temuan Y1, 10 Oktober 2026)

Pada review putaran kedelapan (10 Oktober 2026, mulai 22:50 WIB), Codex menemukan satu temuan P1 lanjutan terkait atomisitas rollback lintas-tab ketika pemulihan cadangan lengkap gagal di tengah transaksi:

| Temuan Review R8 | Tingkat | Status | Komponen Terkait | Bukti Verifikasi |
| --- | --- | --- | --- | --- |
| **Y1 — Rollback restore cadangan gagal memakai timestamp lama sehingga tab lain terjebak pada data restore** | P1 | **Selesai** | `js/storage.js` (`getRollbackIso`, `stampRollbackVersions`, `stampRollbackDraft`, `restoreFullBackup`, dan operasi multi-key) | Probe Y1 PASS (`review_ag_round7_2026-10-10.py --fail-restore`), Test Y1 PASS (`tests/test_audit_fixes.py`) |

### Rincian Perbaikan Teknis Y1:
1. **Penyelarasan Monotonik Timestamp Rollback Kompensasi (`getRollbackIso`)**:
   - Ketika `restoreFullBackup` mengalami kegagalan pada tahap penulisan draf (`STORAGE_KEY`) (misalnya simulasi atau batas kuota LocalStorage), fungsi `rollback()` memulihkan snapshot `VERSIONS_KEY` dan `STORAGE_KEY` sebelum mutasi.
   - Sebelumnya, snapshot tersebut ditulis kembali menggunakan payload dan timestamp historis lamanya. Karena Tab B telah menerima event mutasi awal dengan timestamp `restoreTimestamp`, Tab B mengabaikan event rollback karena `rollbackTimestamp <= lastAppliedDataTimestamp`. Akibatnya Tab B tetap memegang data restore yang gagal, dan menimpa storage saat autosave berikutnya.
   - Pada perbaikan ini, ditambahkan helper `getRollbackIso(attemptIso)` yang menjamin `effectiveMs = Math.max(Date.now(), attemptMs + 1)`, menghasilkan timestamp rollback yang strictly monotonic lebih besar dari percobaan restore yang gagal.
2. **Stempel Ulang Record Snapshot Saat Rollback (`stampRollbackVersions` & `stampRollbackDraft`)**:
   - Helper `stampRollbackVersions(rawVersionsJson, rollbackIso)` dan `stampRollbackDraft(rawDraftJson, rollbackIso)` memastikan seluruh record versi di dalam snapshot JSON diperbarui `updatedAt`-nya ke `rollbackIso` saat dituliskan kembali oleh `rollback()`.
   - `lastSavedTimestamp` lokal juga diperbarui ke `rollbackIso`.
   - Pola stempel rollback ini diterapkan secara konsisten pada seluruh operasi multi-key atomik (`restoreFullBackup`, `saveCVToStorage`, `resetActiveCVVersion`, `createNewCVVersion`, `deleteCVVersion`).
   - Dengan perbaikan ini, Tab B mengenali event rollback sebagai kompensasi transaksi baru, membatalkan tampilan data restore sementara, dan kembali menampilkan serta menyimpan state yang benar.

---

## Resolusi Review Putaran Kesembilan Codex (Temuan Z1, 11 Oktober 2026)

Pada review putaran kesembilan (11 Oktober 2026, mulai 01:08 WIB), Codex menemukan satu temuan P1 lanjutan terkait rollback bertingkat (nested rollback) pada clock tetap (same-tick):

| Temuan Review R9 | Tingkat | Status | Komponen Terkait | Bukti Verifikasi |
| --- | --- | --- | --- | --- |
| **Z1 — Rollback bertingkat menerbitkan isi berbeda dengan revisi identik pada same-tick clock** | P1 | **Selesai** | `js/storage.js` (`getNextMonotonicIso`, `getHighestStorageMs`, `getRollbackIso`, seluruh operasi save/restore/reset/create/delete) | Probe Z1 PASS (`review_ag_round7_2026-10-10.py --fail-restore --same-tick`), Test Z1 PASS (`tests/test_audit_fixes.py`) |

### Rincian Perbaikan Teknis Z1:
1. **Pembangkit Revisi Monotonik Menyeluruh (`getNextMonotonicIso`)**:
   - Sebelumnya, `getRollbackIso(attemptIso)` hanya memastikan timestamp lebih besar dari satu `attemptIso` tertentu (`attemptMs + 1`). Ketika `restoreFullBackup` gagal saat penulisan draf di dalam `saveCVToStorage()`, terjadi dua rollback berurutan dalam rentang waktu yang sama:
     - Rollback dalam (`saveCVToStorage` catch) mengembalikan koleksi restore sementara (`sanitizedVersions`) dengan timestamp $T + 1$.
     - Rollback luar (`restoreFullBackup` catch) mengembalikan snapshot awal (`snapshot.versions`) dengan timestamp $T + 1$ yang sama karena clock sistem belum bergeser.
     - Akibatnya, Tab B menolak event rollback luar karena dianggap memiliki revisi identik/duplikat (`timestamp <= lastAppliedDataTimestamp`), sehingga Tab B tetap terjebak memegang data restore yang gagal.
   - Pada perbaikan ini, diimplementasikan `getNextMonotonicIso(referenceIso = null)` di [`js/storage.js`](file:///d:/Antigravity/CV%20Builder/js/storage.js):
     - Membaca `getHighestStorageMs()` (memindai seluruh `updatedAt` pada `VERSIONS_KEY` dan `savedAt` pada `STORAGE_KEY`).
     - Memperhitungkan `highestPublishedMs` (revisi in-memory tertinggi yang pernah diterbitkan oleh modul dalam sesi aktif).
     - Memperhitungkan `lastSavedTimestamp` dan `referenceIso`.
     - Menghitung `maxKnownMs = Math.max(highestPublishedMs, lastSavedMs, storageMs, refMs)`.
     - Menjamin `targetMs = nowMs > maxKnownMs ? nowMs : maxKnownMs + 1`.
2. **Jaminan Monotonicity Lintas Rollback Bertingkat**:
   - Seluruh mutasi LocalStorage (`saveCVToStorage`, `resetActiveCVVersion`, `createNewCVVersion`, `renameCVVersion`, `deleteCVVersion`, `restoreFullBackup`) dan seluruh blok kompensasi rollback kini menghasilkan revisi yang strictly monotonic.
   - Rollback luar kini secara deterministik memiliki revisi yang pasti lebih baru daripada rollback dalam ($T + 2 > T + 1 > T$), menjamin tab remote selalu menerima dan menerapkan koreksi snapshot yang benar tanpa terblokir dedup.

---

## Verifikasi Akhir & Hasil Pengujian

Seluruh rangkaian pengujian telah dijalankan dan diverifikasi 100% lulus:
1. **`test-results/review_ag_round7_2026-10-10.py --fail-restore --same-tick`**: Probe reproduksi Codex putaran kesembilan terverifikasi lulus (ketika restore di Tab A gagal di bawah frozen same-tick clock, Tab B menerima jejak event strictly monotonic: `...393Z` -> `...395Z` -> `...396Z`, editor Tab B memulihkan state lokal ke `'Changed After Backup B'`, dan autosave perubahan title `'Role After Same-Tick Restore Fail'` berhasil menyimpan kedua perubahan tanpa tertimpa data restore gagal).
2. **`test-results/review_ag_round7_2026-10-10.py --fail-restore`**: Probe reproduksi Codex putaran kedelapan (normal-clock restore failure) terverifikasi lulus 100%.
3. **`test-results/review_ag_round7_2026-10-10.py`**: Probe reproduksi Codex putaran ketujuh (normal restore path) terverifikasi lulus 100% (`Backed Up Candidate B` diterima Tab B dan title edit tersimpan).
4. **`test-results/review_ag_round6_2026-10-10.py`**: Probe reproduksi Codex putaran keenam terverifikasi lulus 100%.
5. **`test-results/review_ag_round5_2026-10-10.py`**: Probe reproduksi Codex putaran kelima terverifikasi lulus 100%.
6. **`test-results/review_ag_round4_2026-10-10.py`**: Probe reproduksi Codex putaran keempat terverifikasi lulus 100%.
7. **`test-results/review_ag_round3_2026-10-10.py`**: Seluruh 3 skenario Codex (T1–T3) terverifikasi lulus secara deterministik.
8. **`test-results/review_ag_round2_2026-10-10.py`**: Seluruh 4 probe Codex (S1–S4) lulus.
9. **`tests/test_audit_fixes.py`**: Seluruh 26 kelompok pengujian otomatis lulus (6 skenario audit F1–F6, 7 skenario review R1–R7, 4 skenario review putaran kedua S1–S4, 3 skenario review putaran ketiga T1–T3, 1 skenario review putaran keempat U1, 1 skenario review putaran kelima V1, 1 skenario review putaran keenam W1, 1 skenario review putaran ketujuh X1, 1 skenario review putaran kedelapan Y1, dan 1 skenario review putaran kesembilan Z1).
10. **`tests/test_fixes.py`**: 12 kelompok pengujian regresi fungsional, PDF multi-halaman, aksesibilitas modal, dan matriks bilingual 2x2 lulus.
11. **`tests/verify.py`**: 22 pemeriksaan integritas berkas, struktur HTML, aturan CSS print, dan respons server lokal lulus.
12. **`git diff --check`**: 0 trailing whitespace di seluruh repository.
