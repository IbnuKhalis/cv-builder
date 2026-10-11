# Audit kesiapan V0.2 — Job Tracker

Tanggal pemeriksaan: **9 Oktober 2026, sekitar 22:05–22:16 WIB**. Baseline kode: `e2e5f647cade4b91abcf0067adf193c72ab378ea`.

## Keputusan

**Siap untuk memulai desain dan pengembangan V0.2; belum siap merilis job tracker dengan penyimpanan yang sekarang.** Aplikasi live tersedia, alur CV utama berjalan, dan suite yang ada lulus. Pengujian tambahan menemukan celah integritas data yang harus menjadi prioritas sebelum menambahkan catatan lamaran, riwayat status, dan jadwal tindak lanjut.

Audit ini tidak mengimplementasikan job tracker atau memperbaiki kode aplikasi. Pemeriksaan VPS hanya membaca status dan menjalankan validasi; tidak melakukan deployment, restart, perubahan Caddy, atau perubahan data server. Smoke test browser memakai context terisolasi dan data fiktif. Perubahan repository hanya laporan ini dan tautan dari README.

## Versi yang benar-benar live

| Pemeriksaan | Hasil |
| --- | --- |
| Endpoint | `https://cv.digitalneeds.my.id` — HTTPS terverifikasi oleh klien, HTTP 200 |
| Branch lokal, GitHub `main`, dan checkout VPS | SHA yang sama: `e2e5f647cade4b91abcf0067adf193c72ab378ea` |
| Working tree awal lokal dan VPS | Bersih |
| Deployment terakhir yang tercatat di Actions | [Run 37338808795](https://github.com/IbnuKhalis/cv-builder/actions/runs/37338808795), test dan deploy sukses; deploy selesai **5 Oktober 2026, 23:12:05 WIB** |
| Identitas release | Tidak ditemukan Git tag atau versi produk semantik; live diidentifikasi dengan commit. `version: 2` / `schemaVersion: 2` di storage adalah versi format data, bukan release produk V0.2 |
| Container | `cv-builder`, running dan healthy; failing streak 0, tidak OOM, restart count 0 saat audit |
| Mulai berjalan terakhir | **6 Oktober 2026, 20:29:08 WIB**; ini waktu mulai container, bukan bukti deployment kode baru |
| Static server | Nginx `1.27.5`, user `101`, filesystem read-only, `cap_drop: ALL`, `no-new-privileges` |
| Jaringan | `proxy-network`; tanpa host port mapping; HTTP internal berhasil |
| Proxy | Blok Caddy memakai `tls internal`; validasi konfigurasi berhasil |
| Identitas isi container | SHA-256 seluruh 10 file HTML/CSS/JS sama dengan checkout VPS |
| Identitas asset publik | Seluruh 9 file CSS/JS sama dengan blob Git; HTML publik berbeda dan memuat script Cloudflare Insights yang tidak terdapat pada HTML sumber |

Respons publik `/docs/`, `/tests/`, `/AGENTS.md`, dan route tidak dikenal adalah **404**. `/.git/config` dan `/.env` menghasilkan **403**. Header HSTS, `nosniff`, `DENY`, Referrer-Policy, Permissions-Policy, dan CSP aktif.

Snapshot resource: disk root sekitar **25 GB tersedia dari 45 GB**, RAM available sekitar **9,6 GB dari 11,9 GB**, penggunaan memori container sekitar **6 MiB**. Tidak terlihat hambatan resource untuk melanjutkan aplikasi statis. Snapshot ini bukan benchmark kapasitas backend/database.

## Bukti verifikasi

Dependency tes dipasang dalam `.venv` terisolasi sesuai `requirements-dev.txt`: Python 3.11.9 dan Playwright 1.58.0. Browser: Chromium 145 dari Playwright. Environment Python global tidak diubah.

| Pemeriksaan yang dijalankan | Hasil |
| --- | --- |
| `python tests/verify.py` | Seluruh pemeriksaan lulus, exit code 0 |
| `python tests/test_fixes.py` | 12 kelompok tes lulus, exit code 0; tidak ada runtime page error |
| PDF suite existing | Kasus ringkas 1 halaman; 75 bullet menghasilkan 3 halaman dan 75/75 bullet terdeteksi; 130 bullet menghasilkan 7 halaman dan 130/130 bullet terdeteksi |
| Bilingual | Parity 373 key; matriks bahasa UI/CV dan locale dokumen per versi lulus dalam suite existing |
| Browser live | Autosave setelah debounce dan reload, pergantian bahasa UI/CV, duplikasi versi, JSON export/import round-trip, dan clipboard lulus |
| Layout live | Overflow horizontal 0 px pada 1366 × 900 dan 390 × 844; screenshot desktop/mobile diperiksa |
| Probe integritas data tambahan | Enam skenario memperlihatkan masalah yang dijelaskan pada F1–F5 |
| Network live | Script dari `static.cloudflareinsights.com` dimuat dengan HTTP 200; CSP mengizinkan script dan koneksi analytics |

Nama test existing “2-Page PDF” tidak berarti jumlah halaman persis dua: assertion menerima dua halaman atau lebih. Hasil audit mencatat jumlah aktual. Suite tersebut tidak otomatis membuktikan semua halaman bebas clipping atau semua PDF English benar; klaim visual menyeluruh pada laporan lama tidak dianggap pengujian ulang pada tanggal ini.

Bukti lokal sementara, seluruhnya diabaikan Git:

- `test-results/audit_repro_2026-10-09.py`: probe yang menggunakan server tes existing, browser terisolasi, dan request publik read-only.
- `test-results/audit-evidence-2026-10-09.json`: hasil perbandingan asset, reproduksi masalah, dan smoke test live.
- `test-results/audit-live-desktop.png` dan `test-results/audit-live-mobile.png`: screenshot dengan data fiktif.

## Temuan prioritas

P1 berarti risiko kehilangan data atau aplikasi tidak dapat dipakai pada kondisi tertentu. P2 berarti perbaikan keandalan, privasi, atau proses rilis yang perlu ditutup sebelum peluncuran V0.2. Temuan tidak berarti semua pengguna sedang mengalami masalah.

### F1 — P1: kegagalan simpan koleksi versi dilaporkan berhasil

Lokasi: `js/storage.js:26` dan `js/storage.js:299`; status UI di `js/app.js:2172`.

`saveCVToStorage()` menulis draft utama lalu memanggil `syncActiveVersionData()`. Fungsi sinkronisasi menangkap error dan mengabaikannya, sehingga fungsi utama tetap mengembalikan sukses.

Reproduksi: simulasi `QuotaExceededError` hanya untuk key koleksi versi. Hasilnya `saved: true`, `status: "ok"`, draft berisi `Audit Changed`, tetapi koleksi versi masih `Audit Original`. Setelah membuka kembali versi tersebut, isi lama dapat menggantikan edit yang dilaporkan tersimpan. Ini relevan ketika satu draft masih muat tetapi koleksi seluruh CV sudah melewati kuota.

Perbaikan yang diperlukan: tentukan satu sumber data utama; propagasikan kegagalan setiap operasi persisten; jangan menampilkan berhasil bila koleksi belum tersimpan. Operasi beberapa record harus memiliki strategi transaksi atau pemulihan yang jelas.

### F2 — P1: edit terakhir hilang saat berpindah versi atau reload cepat

Lokasi: `js/app.js:2124`, `js/app.js:2172`, dan handler create/duplicate di `js/app.js:2436`.

Autosave menunggu 350 ms dan memakai `cvState` saat callback dijalankan. Perpindahan versi mengganti state tanpa terlebih dahulu menyimpan edit versi sebelumnya. Tidak ditemukan handler `pagehide`, `visibilitychange`, atau mekanisme flush saat keluar.

Reproduksi: ketik `Audit Unsaved B` lalu buka versi A sebelum debounce berjalan. Setelah menunggu, versi B tetap kosong. Pada probe lain, input `Audit Rapid Reload` diikuti reload cepat; field kembali kosong.

Perbaikan yang diperlukan: flush perubahan sebelum switch/create/delete/reset yang mengganti state; ikat pending save pada ID versi dan snapshot yang benar; tangani lifecycle halaman serta kegagalan flush. Uji perilaku ini secara eksplisit.

### F3 — P1: impor JSON valid secara sintaks dapat merusak startup

Lokasi: `js/storage.js:225`, `js/storage.js:468`, dan `js/app.js:405`.

Validasi impor hanya memeriksa bentuk object secara umum. Normalisasi mempertahankan elemen array tanpa pemeriksaan setiap field/record. Handler impor menyimpan state sebelum membuktikan state dapat dirender.

Reproduksi melalui input file aplikasi: impor `{"profile":{"fullName":"Audit Malformed Import"},"experience":[null]}`. Payload tersimpan; reload memunculkan `Cannot read properties of null (reading 'startDate')` dan inisialisasi tidak selesai. Ini bukan JSON dengan sintaks rusak; skema datanya yang tidak valid.

Perbaikan yang diperlukan: validasi dan normalisasi mendalam sebelum mutasi state/storage; dukung migrasi versi yang eksplisit; tolak versi masa depan yang tidak dikenal; pertahankan data terakhir yang sehat dan jalur pemulihan saat startup.

### F4 — P1: dua tab dapat saling menimpa perubahan

Lokasi: state global `js/app.js:57` dan penulisan payload penuh pada `js/storage.js:26`.

Tidak ditemukan sinkronisasi event `storage`, revisi record, atau deteksi konflik. Setiap tab memegang salinan state lengkap dan menulis keseluruhannya.

Reproduksi: dua tab membuka CV yang sama. Tab A menyimpan email `audit@example.invalid`. Tab B yang masih memakai state lama mengubah target posisi dan menyimpan; email di storage kembali kosong.

Perbaikan yang diperlukan: deteksi revisi terbaru sebelum save; sinkronkan tab atau tampilkan konflik yang dapat dipulihkan. Untuk tracker, jangan biarkan edit status pada satu tab menimpa seluruh koleksi aplikasi pada tab lain.

### F5 — P2: reset mengosongkan form tetapi meninggalkan data versi aktif

Lokasi: `js/app.js:2413`, `js/storage.js:283`, dan pesan reset `js/locales/id.js:322` / `js/locales/en.js:322`.

UI menyatakan data pada versi aktif akan dikosongkan. Implementasi hanya menghapus key draft utama, sementara isi versi aktif tetap tersimpan di koleksi.

Reproduksi: reset versi B. Form kosong dan draft utama `null`, tetapi koleksi masih memuat `Audit Reset Victim B`; isi tersebut tetap tersedia ketika versi dibuka kembali. Ini membuat arti tindakan reset tidak konsisten dengan hasil persisten.

Perbaikan yang diperlukan: reset record aktif secara konsisten sambil mempertahankan versi lain; pending autosave juga harus ditangani. Pada tracker, pisahkan reset CV dari penghapusan lamaran dan jangan membuat tindakan CV menghapus data tracker.

### F6 — P2: backup belum mencakup seluruh data pengguna

Lokasi: `js/storage.js:449` dan pemanggilan ekspor `js/app.js:389`.

Ekspor JSON hanya mengambil CV aktif. Koleksi versi, ID/nama versi, preferensi, dan relasi belum memiliki backup menyeluruh. Ini batasan fitur yang dapat dibuktikan dari kode dan bentuk JSON hasil live, bukan kegagalan round-trip CV aktif.

Perbaikan yang diperlukan sebelum tracker dirilis: backup bertipe dan berversi yang mencakup seluruh CV, lamaran, serta relasinya; validasi restore sebelum overwrite. Tetap sediakan ekspor satu CV untuk kompatibilitas alur lama.

### F7 — P2: konfigurasi privasi live berbeda dari dokumentasi

Lokasi: CSP blok CV Builder pada Caddy live dibandingkan `docs/VPS_DEPLOYMENT_PLAN.md` dan aturan privasi README.

Dokumen deployment menggunakan `connect-src 'none'` dan menyatakan tidak ada analytics/telemetry. CSP live mengizinkan `https://static.cloudflareinsights.com` untuk script serta `https://cloudflareinsights.com` untuk koneksi. Browser benar-benar memuat script Insights dengan HTTP 200; script ini tidak ada pada source HTML.

Audit ini tidak membuktikan data CV dikirim ke Cloudflare. Request POST analytics atau payload telemetry tidak teramati pada jendela pengamatan. Yang terkonfirmasi adalah pemuatan script pihak ketiga dan perbedaan kebijakan live terhadap dokumentasi.

Tindak lanjut: selaraskan konfigurasi edge/proxy dengan keputusan privasi produk dan otorisasi yang pernah diberikan. Jangan memperluas pengumpulan data pada V0.2 secara implisit. Tidak ada konfigurasi produksi yang diubah oleh audit.

### F8 — P2: cache asset publik berpotensi mencampur release

Lokasi: `deploy/default.conf:14`, `index.html:10`, dan `index.html:663`.

Source Nginx menetapkan cache asset 300 detik, tetapi header publik seluruh CSS/JS adalah `max-age=14400` (**4 jam**). Nama URL asset tetap sama antar-release dan HTML memakai `no-cache`.

Dampak potensial: HTML baru dapat bertemu JavaScript/CSS lama yang masih fresh di browser. Dengan ES module tanpa versi pada import, modul antar-release juga dapat tercampur. Ini risiko dari konfigurasi; skenario upgrade ke release baru belum dilakukan dan tidak diklaim telah gagal.

Tindak lanjut: gunakan URL asset yang berubah setiap release, atau kebijakan revalidasi konsisten untuk HTML dan seluruh dependency modul. Verifikasi aturan cache efektif di Cloudflare dan uji upgrade dari tab/browser yang sudah memakai release lama sebelum perubahan skema.

### F9 — P2: CI/CD belum menjamin commit teruji adalah commit yang dideploy

Lokasi: `.github/workflows/deploy.yml:3` dan `.github/workflows/deploy.yml:58`.

Pipeline memiliki test sebelum deploy, tetapi job deploy mengambil `origin/main` terbaru, bukan SHA checkout yang baru diuji. Jika `main` berubah saat run berlangsung, job bisa membangun commit berbeda. Tidak ada `concurrency` untuk menserialkan deployment. Test juga hanya dipicu push `main`/manual, belum pada pull request.

Ini temuan review kode; audit tidak memicu deployment concurrent. Run terakhir yang diperiksa berhasil dan SHA live saat ini sesuai.

Tindak lanjut: deploy SHA run yang telah diuji, serialkan deployment, jalankan verification pada PR tanpa deployment, tunggu status health secara bounded, dan tambahkan verifikasi endpoint publik setelah deploy. Hindari menjadikan perubahan produksi sebagai bagian dari audit ini.

### F10 — P2: dokumentasi dan tes belum cukup untuk klaim kesiapan V0.2

`docs/ARCHITECTURE.md` masih menyebut bilingual dan multi-version sebagai hal yang akan ditambahkan. PRD masih mempunyai keputusan terbuka yang sebagian sudah dijawab implementasi. Bukti deployment pada dokumentasi masih berfokus pada September, sedangkan run terbaru terjadi Oktober. Tidak ada model data, acceptance criteria, atau roadmap job tracker yang disepakati.

Suite existing lulus, tetapi belum memiliki assertion untuk F1–F5, backup seluruh koleksi, migrasi tracker, atau upgrade lintas-release. `tests/verify.py` banyak memeriksa pola teks; keberadaannya tidak menggantikan tes perilaku untuk integritas data. Klaim “seluruh target sprint selesai” tidak berarti tidak ada defect di luar cakupan tes.

Tindak lanjut: perbarui dokumen berdasarkan hasil audit, tambahkan tes regresi untuk masalah yang diperbaiki, dan catat identitas release produk terpisah dari versi skema storage. Pertahankan hasil audit historis sebagai bukti baseline.

## Fondasi yang dapat digunakan ulang

- Vanilla HTML/CSS/ES modules masih memadai untuk tracker lokal. Audit tidak menemukan alasan untuk langsung mengganti stack atau menambahkan backend.
- Modul CV, PDF/print, dua bahasa, validasi kontak, JD matcher, serta multi-versi dapat menjadi bagian produk job tracker.
- Deployment statis, container non-root, proxy internal, dan isolasi file sudah tersedia.
- Pisahkan logika tracker dari `js/app.js` yang sekarang sekitar **2.645 baris**. Tambahkan batas modul sesuai kebutuhan; hindari menempel seluruh fitur baru ke controller CV atau melakukan refactor besar sekaligus.

## Persiapan V0.2 yang direkomendasikan

Bagian ini merupakan rekomendasi audit, belum keputusan PRD atau otorisasi implementasi.

1. **Tutup risiko integritas data lebih dahulu.** Prioritaskan F1–F4; lanjutkan reset dan backup (F5–F6). Tambahkan tes yang memperlihatkan reproduksi kini berhasil dipulihkan, bukan hanya memperluas pemeriksaan statis.
2. **Tetapkan lingkup tracker.** Asumsi awal yang sesuai README: data tetap lokal, input lamaran manual, tanpa akun, sinkronisasi cloud, upload CV, atau pengiriman lamaran otomatis. Jika target mencakup banyak perangkat atau kolaborasi, perlakukan itu sebagai keputusan arsitektur tersendiri.
3. **Pisahkan domain lamaran dari dokumen CV.** Lamaran memerlukan ID stabil, perusahaan, posisi, tautan/source lowongan, tanggal, status, catatan, dan relasi ke CV. Tentukan kebutuhan riwayat status dan tindak lanjut dalam PRD. Jangan memakai ID versi CV sebagai ID lamaran.
4. **Tentukan kontrak CV yang dipakai melamar.** Referensi ke CV yang dapat diedit tidak cukup untuk membuktikan dokumen yang pernah dikirim; pertimbangkan snapshot ketika lamaran dicatat sebagai terkirim. Penghapusan versi CV tidak boleh diam-diam merusak catatan lamaran.
5. **Tetapkan penyimpanan dan migrasi.** Pilihan localStorage versus IndexedDB harus didasarkan pada transaksi, volume, dan kebutuhan relasi. IndexedDB layak dievaluasi karena tersedia native dan mendukung transaksi; penggunaan backend tidak diperlukan oleh tracker lokal. Membaca legacy harus tidak destruktif, idempotent, dan dapat dipulihkan jika migrasi gagal.
6. **Pertahankan origin agar data lama tetap dapat diakses.** Memindahkan produk ke domain/subdomain baru tidak otomatis membawa localStorage. Jika rebranding memerlukan origin baru, sediakan jalur ekspor/impor dan komunikasikan perpindahan data.
7. **Tutup kebutuhan rilis.** Selaraskan privasi (F7), cache (F8), deployment SHA/PR verification (F9), dan dokumen/tes (F10) sebelum meluncurkan skema baru.

## Gerbang rilis V0.2

- [ ] F1–F4 ditutup dengan tes perilaku yang membuktikan data tidak hilang.
- [ ] Reset CV, delete versi, delete lamaran, dan restore backup memiliki batas tindakan yang jelas.
- [ ] Backup seluruh data dan restore berversi berjalan; file invalid/versi tidak dikenal tidak menimpa data sehat.
- [ ] Draft/CV legacy dimigrasikan tanpa kehilangan isi, bahasa, ID, maupun metadata yang dibutuhkan.
- [ ] Relasi lamaran ke CV tetap valid setelah edit, duplikasi, penghapusan, dan restore.
- [ ] Alur inti tracker diuji pada desktop/mobile, keyboard, dan kedua bahasa yang dipertahankan.
- [ ] Cetak/PDF CV tetap lulus regresi dan tidak memuat UI tracker.
- [ ] Upgrade dengan cache/browser lama dan rollback kode dengan data skema baru memiliki perilaku aman yang teruji.
- [ ] Commit deployment sama dengan commit yang lulus test; smoke test publik dan healthcheck tercatat.
- [ ] Kebijakan privasi yang tertulis cocok dengan request/configuration live.

## Batas pemeriksaan

Audit meliputi source, dokumen relevan, suite existing, probe integritas data, metadata Actions, SSH read-only, HTTP publik, dan smoke test Chromium. Audit ini bukan penetration test, dependency/CVE audit menyeluruh, load test, atau usability study. Firefox/Safari dan seluruh PDF bilingual tidak diverifikasi visual ulang. Monitoring Uptime Kuma saat ini, pengaturan SSL Full di dashboard Cloudflare, konfigurasi backup infrastruktur, serta kontrol branch protection GitHub tidak diperiksa langsung; klaim lama mengenai area tersebut tidak dianggap bukti kondisi terbaru.
