# Rencana Deployment VPS — ATS CV Builder

## Status

Status QA: **GO untuk production statis** berdasarkan [re-verifikasi 23 September 2026](QA_REVERIFICATION_2026-09-23.md).

Dokumen ini sudah diselaraskan dengan prosedur VPS yang tersimpan pada canonical Second Brain, bukan memakai pola VPS generik.

## Sumber prosedur yang diperiksa

- `D:\Apps\Obsidian\SecondBrain\03 Resources\VPS Infrastructure\4. New Project Deployment Blueprint.md`
- `D:\Apps\Obsidian\SecondBrain\03 Resources\VPS Infrastructure\3. Operations Runbook & Troubleshooting.md`
- `D:\Apps\Obsidian\SecondBrain\03 Resources\VPS Infrastructure\2. Architecture & Network Flow.md`
- `D:\Apps\Obsidian\SecondBrain\03 Resources\VPS Infrastructure\1. Overview & System Specs.md`
- `D:\Apps\Obsidian\SecondBrain\02 Antigravity Core\Solution Library.md`
- `D:\Antigravity\9router\directives\vps-deployment.md`

Nilai credential, private key, token, password, dan IP tidak disalin ke dokumen proyek. Gunakan SSH alias, GitHub Secrets, dan helper lokal yang sudah tersedia.

## Keputusan arsitektur

CV Builder mengikuti standar infrastruktur yang sudah berjalan:

```text
Git push ke main
      │
      ▼
GitHub Actions: test + SSH deploy
      │
      ▼
vps-main:/opt/projects/cv-builder
      │
      ▼
Container static web cv-builder:8080
      │
      ▼ external Docker network: proxy-network
Caddy container:443 + tls internal
      │
      ▼
Cloudflare Proxied DNS + SSL Full
      │
      ▼
https://cv.digitalneeds.my.id
```

Rekomendasi subdomain: `cv.digitalneeds.my.id`. Ganti hanya bila pengguna memilih nama lain sebelum konfigurasi DNS/Caddy dibuat.

### Alasan memakai container

- Konsisten dengan seluruh aplikasi pada VPS yang sama.
- Port aplikasi tidak dibuka ke host atau internet.
- Caddy dapat menemukan aplikasi melalui `proxy-network`.
- Deployment dan rollback memakai pola GitHub Actions yang sudah familier.
- Static server dapat dijalankan sebagai non-root dengan filesystem read-only.

### Hal yang tidak diperlukan

- Tidak ada database, Redis, worker, cron, atau volume data aplikasi.
- Tidak ada `.env` production selama tidak ada secret baru.
- Tidak perlu mendaftarkan dump database ke backup GFS.
- `server.py` tidak digunakan di production.
- Data CV pengguna tidak pernah disimpan di VPS; localStorage tetap berada di browser.

## File deployment yang perlu dibuat Antigravity

```text
CV Builder/
├── Dockerfile
├── docker-compose.vps.yml
├── deploy/
│   └── default.conf
└── .github/
    └── workflows/
        └── deploy.yml
```

Gunakan nama file tersebut agar konsisten dengan proyek VPS lain.

## Container static web

### Dockerfile yang direkomendasikan

Gunakan image multi-architecture non-root yang mendukung ARM64:

```dockerfile
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY deploy/default.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

EXPOSE 8080
```

Artefak production menggunakan allowlist. Jangan menyalin `.agents/`, `docs/`, `tests/`, `AGENTS.md`, `requirements-dev.txt`, `server.py`, screenshot QA, atau file JSON pengguna ke image.

### Konfigurasi static server internal

`deploy/default.conf`:

```nginx
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location = /index.html {
        try_files $uri =404;
        add_header Cache-Control "no-cache" always;
    }

    location / {
        try_files $uri $uri/ =404;
        add_header Cache-Control "public, max-age=300, must-revalidate" always;
    }

    location ~ /\. {
        deny all;
    }
}
```

Jangan memakai SPA fallback ke `index.html` untuk semua URL karena aplikasi tidak memiliki client-side router. URL asset atau file yang tidak ada harus menghasilkan `404`.

## Docker Compose VPS

`docker-compose.vps.yml`:

```yaml
services:
  cv-builder:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: cv-builder
    restart: unless-stopped
    read_only: true
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    tmpfs:
      - /tmp:size=16m,mode=1777
      - /var/cache/nginx:size=16m,mode=0755
      - /var/run:size=4m,mode=0755
    expose:
      - "8080"
    networks:
      - proxy-network
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "20m"
        max-file: "3"

networks:
  proxy-network:
    external: true
```

Tidak boleh menambahkan `ports:`. Aplikasi hanya boleh diakses oleh Caddy melalui `proxy-network`.

Sebelum finalisasi, jalankan healthcheck terhadap image aktual. Jika image tidak menyediakan `wget`, gunakan healthcheck bawaan image atau binary yang memang tersedia; jangan menginstal tool besar hanya untuk healthcheck.

## Caddy dan Cloudflare

Tambahkan blok berikut ke `/opt/infrastructure/reverse-proxy/Caddyfile`:

```caddyfile
cv.digitalneeds.my.id {
    tls internal
    reverse_proxy cv-builder:8080
    encode gzip zstd

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
        Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests"
    }
}
```

Invariannya:

- DNS subdomain memakai Cloudflare Proxied/Orange Cloud melalui wildcard yang sudah tersedia.
- Cloudflare SSL/TLS tetap pada mode **Full** sesuai arsitektur saat ini.
- `tls internal` wajib dipertahankan untuk origin Caddy agar tidak memicu error 525.
- Jangan memakai Certbot atau meminta Caddy menerbitkan sertifikat publik langsung untuk subdomain proxied ini.
- Reload tanpa downtime:

  ```bash
  docker exec caddy-proxy caddy reload --config /etc/caddy/Caddyfile
  ```

Uji CSP pada deployment pertama. Jika ada pelanggaran, perbaiki sumber asset atau directive paling sempit; jangan menonaktifkan seluruh CSP.

## Git dan repository

Standar infrastruktur menetapkan Git sebagai single source of truth. Pastikan proyek sudah memiliki repository dan branch default yang disepakati sebelum setup CI/CD.

- Jangan mengedit kode aplikasi langsung di VPS.
- Perubahan masuk melalui commit lokal dan push ke branch `main`.
- Direktori VPS disinkronkan menggunakan `git fetch` dan `git reset --hard origin/main`.
- Secret SSH hanya berada di GitHub Actions Secrets atau konfigurasi lokal yang aman.
- Gunakan helper lokal yang sudah ada untuk memasang empat VPS secrets ke repository, tanpa menyalin nilainya ke file proyek.

## GitHub Actions

Workflow terdiri dari dua job: `test` lalu `deploy`. Deployment hanya berjalan jika test lulus.

### Job test

1. Checkout repository.
2. Setup Python versi yang didukung.
3. Instal `requirements-dev.txt`.
4. Instal browser Playwright Chromium beserta dependency OS runner.
5. Jalankan:

   ```bash
   python tests/verify.py
   python tests/test_fixes.py
   ```

6. Upload screenshot/PDF test hanya ketika gagal atau dengan retensi pendek; jangan memasukkan data CV nyata.

### Job deploy

Gunakan pola yang sudah dipakai proyek VPS lain:

```bash
set -e

if [ ! -d "/opt/projects/cv-builder/.git" ]; then
  sudo mkdir -p /opt/projects/cv-builder
  sudo chown -R ubuntu:ubuntu /opt/projects/cv-builder
  git clone <PRIVATE_REPOSITORY_URL> /opt/projects/cv-builder
fi

cd /opt/projects/cv-builder
git fetch origin main
git reset --hard origin/main

docker compose -f docker-compose.vps.yml build --pull
docker compose -f docker-compose.vps.yml up -d --remove-orphans
docker compose -f docker-compose.vps.yml ps

docker exec caddy-proxy caddy reload --config /etc/caddy/Caddyfile
```

Setelah container healthy, verifikasi endpoint internal dari container yang memiliki tool HTTP. Jangan menganggap `docker compose ps` saja sebagai bukti aplikasi dapat dilayani.

## Urutan deployment pertama

### Fase 1 — Persiapan repository

1. Pastikan status QA tetap hijau.
2. Inisialisasi Git bila belum ada dan buat repository private.
3. Tambahkan workflow, Dockerfile, Compose, dan konfigurasi static server melalui Antigravity.
4. Jalankan build container lokal dan verifikasi image.
5. Commit baseline production dan push ke `main`.

### Fase 2 — Persiapan VPS

1. Jalankan `vps-health` dari terminal lokal.
2. SSH menggunakan alias yang sudah tersedia.
3. Pastikan `proxy-network` dan `caddy-proxy` aktif.
4. Tambahkan blok Caddy untuk subdomain CV Builder.
5. Validasi Caddyfile sebelum reload.
6. Jangan membuat `.env` kosong bila aplikasi tidak memerlukannya.

### Fase 3 — CI/CD dan deploy

1. Pasang GitHub Actions Secrets memakai helper lokal yang sudah ada.
2. Trigger workflow lewat push ke `main` atau `workflow_dispatch`.
3. Pantau job test; deployment tidak boleh berjalan bila test gagal.
4. Pantau SSH deploy, build image, healthcheck, dan reload Caddy.
5. Pastikan container ada di `proxy-network` dan tidak memiliki host port mapping.

### Fase 4 — Verifikasi publik

1. Buka `https://cv.digitalneeds.my.id` dari koneksi publik.
2. Verifikasi sertifikat Cloudflare edge dan tidak ada error 525/502.
3. Periksa response headers serta CSP.
4. Jalankan smoke test bilingual, mobile, autosave, multi-versi, JSON, dan PDF.
5. Daftarkan endpoint ke Uptime Kuma yang sudah ada.
6. Catat commit SHA, waktu deployment, hasil workflow, dan hasil smoke test.

## Smoke test production

### Infrastruktur

- Container `cv-builder` running dan healthy.
- Container bergabung ke `proxy-network`.
- Tidak ada `ports:` atau port host yang terbuka.
- Endpoint production menghasilkan `200`.
- Tidak ada 502, 525, mixed content, atau CSP error.
- `/docs/`, `/tests/`, `/AGENTS.md`, dan file internal lain menghasilkan `404`.

### Aplikasi

- Fresh visit memilih bahasa UI berdasarkan locale browser.
- Bahasa UI dan bahasa CV dapat berbeda.
- Draft bertahan setelah refresh pada origin production.
- Dua versi CV tidak saling bocor.
- JSON export/import dan Copy Text berfungsi.
- Modal mengembalikan fokus ke kontrol yang terlihat.
- Preview 390 × 844 tetap rapi dan bebas overflow.
- PDF Indonesia dan English berukuran A4 serta selectable.

Gunakan data contoh fiktif dan browser context bersih. Jangan memakai data CV nyata dalam CI, screenshot, log, atau monitoring.

## Monitoring

Tambahkan monitor HTTPS di Uptime Kuma existing:

- URL: endpoint production CV Builder.
- Expected status: `200`.
- Interval mengikuti standar monitor proyek lain.
- Keyword opsional: `ATS CV Builder`.
- Notifikasi mengikuti channel yang sudah terpasang.

Tidak perlu menambahkan analytics atau telemetry. Monitoring hanya memeriksa availability endpoint publik.

## Backup

CV Builder tidak memiliki data persisten di server:

- Source code dan riwayat commit di repository menjadi recovery source.
- Docker image dapat dibangun ulang dari commit.
- Tidak perlu backup database atau volume GFS.
- Caddyfile dan konfigurasi infrastruktur tetap mengikuti backup VPS existing.
- Data localStorage pengguna tidak dapat dan tidak boleh dicadangkan dari server.

Fitur ekspor JSON tetap menjadi mekanisme backup yang dikendalikan pengguna.

## Rollback

Jika deployment baru gagal:

```bash
cd /opt/projects/cv-builder
git log --oneline -n 5
git reset --hard <LAST_KNOWN_GOOD_COMMIT>
docker compose -f docker-compose.vps.yml build --pull
docker compose -f docker-compose.vps.yml up -d --remove-orphans
docker exec caddy-proxy caddy reload --config /etc/caddy/Caddyfile
```

Setelah rollback, ulangi healthcheck internal dan smoke test publik. Jangan memakai `HEAD~1` tanpa memastikan commit tujuan adalah release terakhir yang sehat.

Rollback file aplikasi tidak menghapus draft karena state berada di browser. Setiap perubahan skema localStorage tetap harus backward-compatible.

## Known failure modes

### Cloudflare 525

- Pastikan Cloudflare SSL berada pada mode Full.
- Pastikan blok Caddy memakai `tls internal`.
- Reload Caddy dan periksa log `caddy-proxy`.

### Caddy 502

- Pastikan container running dan healthy.
- Pastikan upstream `cv-builder:8080` benar.
- Pastikan container dan Caddy berada pada `proxy-network` yang sama.

### Deployment Git gagal

- Periksa GitHub Actions Secrets dan akses repository private.
- Gunakan `git fetch` lalu `git reset --hard origin/main`.
- Jangan memperbaiki dengan live-editing source di VPS.

### Image tidak berjalan pada ARM64

- Pastikan base image mempunyai manifest ARM64.
- Verifikasi image sebelum production atau gunakan build multi-platform eksplisit.

### CSP memblokir aplikasi

- Periksa browser console dan response header.
- Tambahkan sumber paling spesifik bila benar-benar diperlukan.
- Jangan memakai `script-src 'unsafe-inline'` karena aplikasi menggunakan ES modules eksternal.

## Definition of done

- [x] Repository (`IbnuKhalis/cv-builder`) dan CI/CD GitHub Actions aktif.
- [x] Kedua test suite (`tests/verify.py` & `tests/test_fixes.py`) lulus pada GitHub Actions runner bersih.
- [x] Container non-root (`cv-builder`) berstatus `healthy` pada `proxy-network` tanpa port publik.
- [x] Caddy `tls internal` dan Cloudflare Full menghasilkan HTTPS valid di `https://cv.digitalneeds.my.id`.
- [x] Security headers serta CSP aktif tanpa console error (`console_errors=0`).
- [x] Smoke test desktop, mobile, bilingual, persistence, dan PDF lulus (`GET /docs/`, `/tests/`, `/AGENTS.md` -> `404`).
- [x] Uptime Kuma memantau endpoint production (`ATS CV Builder`, Monitor ID `4`).
- [x] Commit SHA, workflow run, dan hasil smoke test dicatat pada dokumentasi proyek.

## Bukti Deployment Produksi (23 September 2026)

- **Endpoint Publik**: `https://cv.digitalneeds.my.id` (`HTTP 200 OK`, Cloudflare Edge + Caddy `tls internal`)
- **Repository GitHub**: `https://github.com/IbnuKhalis/cv-builder` (Branch `main`)
- **GitHub Actions Run ID**: `35815097763` (`Verify Static & Browser Suite` lulus 51s -> `Deploy to Production VPS (vps-main)` lulus 17s)
- **Container Produksi**: `cv-builder` (`nginxinc/nginx-unprivileged:1.27-alpine`, `read_only: true`, `cap_drop: ALL`, `8080/tcp` pada `proxy-network`, `healthy`)
- **Security Headers & CSP**: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, dan `Content-Security-Policy` terverifikasi aktif dengan `0` console error.
- **Isolasi Berkas Internal**: `GET /docs/` -> `404`, `GET /tests/` -> `404`, `GET /AGENTS.md` -> `404`.
- **Monitoring**: Terdaftar pada Uptime Kuma (`status.digitalneeds.my.id`, Monitor ID `4`).


