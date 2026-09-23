# Proposal Improvement ATS CV Builder Indonesia

Tanggal evaluasi: 22 September 2026  
Status: Proposal saja - belum ada perubahan produk

## 1. Ringkasan evaluasi

Aplikasi sudah memiliki fondasi MVP yang baik: editor dan live preview, format PDF berbasis teks, dukungan fresh graduate, contoh data, autosave lokal, backup JSON, salin teks polos, serta tampilan desktop dan mobile. Pengujian sebelumnya juga membuktikan alur utama berjalan dan PDF dapat diekstrak oleh parser teks.

Hambatan terbesarnya sekarang bukan kurangnya jumlah fitur, melainkan panjang dan kepadatan proses. Pengguna harus memahami banyak bagian sekaligus, menavigasi formulir yang panjang, dan menafsirkan sendiri arti skor kelengkapan. Ekspor PDF masih bergantung pada dialog cetak browser, sementara kualitas paginasi untuk entri sangat panjang perlu disempurnakan.

Proposal ini memprioritaskan tiga hasil:

1. Pengguna baru dapat menyelesaikan CV pertama tanpa merasa kewalahan.
2. Saran kualitas CV menjadi spesifik dan bisa langsung ditindaklanjuti.
3. Hasil PDF lebih konsisten dan pengguna yakin file siap dikirim.

## 2. Prioritas 0 - stabilisasi sebelum menambah fitur

### 2.1 Satukan logika pemulihan draft

Gunakan satu sumber kebenaran untuk memutuskan apakah draft tersedia. Modul `storage.js` sudah memiliki pemeriksaan seluruh field dan fungsi penggabungan dengan default, tetapi inisialisasi `app.js` masih memakai pemeriksaan field tersendiri. Integrasikan fungsi tersebut dan tambahkan status penyimpanan yang membedakan `Menyimpan`, `Tersimpan`, dan `Gagal menyimpan`.

**Mengapa perlu:** kehilangan draft, bahkan pada satu field saja, langsung merusak kepercayaan. Pengguna CV sering mengisi bertahap dan dapat berhenti setelah mengisi target posisi atau kontak.

**Kriteria berhasil:** setiap field tunggal bertahan setelah refresh; format draft lama tetap terbaca; data rusak tidak membuat aplikasi gagal; kegagalan localStorage terlihat oleh pengguna.

### 2.2 Perbaiki paginasi entri panjang

Izinkan isi pengalaman yang sangat panjang mengalir ke halaman berikutnya. Pertahankan heading bagian dan header jabatan bersama minimal satu atau dua poin pertama, tetapi jangan memaksa seluruh pengalaman tetap dalam satu halaman.

**Mengapa perlu:** aturan `break-inside: avoid` pada entri besar dapat memindahkan seluruh blok ke halaman berikutnya dan meninggalkan ruang kosong besar. Hasilnya terlihat belum selesai meski tidak ada teks yang terpotong.

**Kriteria berhasil:** CV pendek tetap rapi; entri panjang memanfaatkan ruang halaman; tidak ada heading yatim, clipping, duplikasi, atau halaman kosong.

### 2.3 Tambahkan tes perilaku sebagai gerbang regresi

Pertahankan tes browser untuk draft parsial, tambah/hapus/urut entri, backup JSON, mobile overflow, dan ekstraksi teks PDF. Tes berbasis pencarian pola kode hanya digunakan sebagai pemeriksaan struktur tambahan.

**Mengapa perlu:** masalah yang pernah ditemukan lolos dari pemeriksaan statis. Produk ini sangat bergantung pada interaksi browser dan CSS print.

## 3. Prioritas 1 - UX inti

### 3.1 Ubah formulir panjang menjadi alur bertahap

Susun editor menjadi lima langkah: Profil, Pengalaman, Pendidikan, Keahlian, dan Finalisasi. Tampilkan satu langkah aktif dengan navigasi `Sebelumnya` dan `Lanjut`, tetapi sediakan daftar langkah agar pengguna bisa melompat. Bagian opsional ditempatkan di bawah pilihan `Tambahkan bagian lain`.

**Mengapa perlu:** saat ini semua bagian tampil sekaligus. Ini meningkatkan beban kognitif dan membuat halaman terasa berat, terutama bagi fresh graduate yang tidak membutuhkan semua bagian.

**Kriteria berhasil:** pengguna selalu mengetahui posisi dan langkah berikutnya; bagian opsional tidak mendominasi; data yang sudah diisi tidak hilang saat berpindah langkah.

### 3.2 Buat dua jalur onboarding yang benar-benar berbeda

Pada awal penggunaan, tanyakan profil pengguna: `Fresh Graduate` atau `Berpengalaman`. Gunakan jawaban untuk menentukan urutan langkah, contoh teks, bagian yang direkomendasikan, dan checklist. Pengguna tetap dapat mengganti jalur kapan saja.

**Mengapa perlu:** tombol pengurutan saat ini membantu output, tetapi pengalaman mengisi masih sama. Fresh graduate membutuhkan arahan ke proyek, organisasi, magang, dan prestasi; profesional membutuhkan fokus pada dampak dan metrik pengalaman kerja.

### 3.3 Validasi inline yang dekat dengan field

Tampilkan pesan tepat di bawah input untuk email, nomor telepon, URL, rentang tahun, dan field wajib pada entri yang sudah dibuat. Validasi berjalan setelah field disentuh atau saat pengguna lanjut, bukan memunculkan semua error sejak awal. Sediakan tautan dari checklist ke field bermasalah.

**Mengapa perlu:** skor kelengkapan global tidak menunjukkan lokasi dan cara memperbaiki kesalahan. Pengguna harus mencari sendiri field yang menyebabkan masalah.

### 3.4 Jadikan status kualitas sebagai checklist tindakan

Pisahkan `Kelengkapan data` dari `Kualitas isi`. Ganti kesan skor absolut dengan label seperti `Dasar selesai`, `Perlu diperkuat`, dan `Siap ditinjau`. Setiap rekomendasi harus menyebut bagian, alasan, contoh perbaikan, dan tombol `Perbaiki sekarang`.

**Mengapa perlu:** persentase saat ini menggabungkan kehadiran data dengan kualitas tulisan dan berpotensi terlihat seperti skor ATS. Checklist tindakan lebih jujur dan berguna.

### 3.5 Sederhanakan header dan hierarki aksi

Pertahankan satu aksi utama `Unduh PDF`. Pindahkan Impor, Ekspor JSON, Kosongkan, pilihan contoh, dan tipografi ke menu `Lainnya` atau panel Pengaturan. Tampilkan indikator autosave di dekat judul dokumen.

**Mengapa perlu:** terlalu banyak tombol dengan bobot visual serupa membuat pengguna sulit menentukan aksi utama, khususnya pada layar kecil.

### 3.6 Tambahkan mode pratinjau yang fokus

Pada mobile, jadikan pratinjau layar penuh dengan tombol tetap `Kembali mengedit` dan `Unduh PDF`. Pada desktop, pertahankan split view tetapi tambahkan kontrol zoom `Fit`, `100%`, dan indikator jumlah halaman.

**Mengapa perlu:** pratinjau A4 pada layar kecil sulit dibaca. Pengguna perlu mengecek isi akhir tanpa toolbar dan editor mengambil ruang.

## 4. Prioritas 2 - fitur bernilai tinggi

### 4.1 Penyesuaian terhadap deskripsi pekerjaan

Tambahkan panel opsional tempat pengguna menempel deskripsi pekerjaan. Analisis dilakukan lokal untuk menampilkan kata kunci yang ada, belum muncul, atau tidak relevan. Jangan menulis ulang pengalaman secara otomatis dan jangan memberi klaim peluang lolos.

**Mengapa perlu:** ATS-friendly secara format belum menjamin CV relevan terhadap lowongan. Nilai terbesar setelah format aman adalah membantu pengguna menyesuaikan bahasa CV dengan posisi yang dituju.

### 4.2 Beberapa versi CV

Izinkan pengguna membuat, menggandakan, mengganti nama, dan menghapus beberapa versi lokal, misalnya `Data Analyst - Fintech` dan `Business Intelligence - Retail`. Gunakan daftar dokumen dengan tanggal terakhir diperbarui.

**Mengapa perlu:** pencari kerja jarang memakai satu CV identik untuk semua lowongan. Saat ini satu draft localStorage mudah tertimpa saat menyesuaikan isi.

### 4.3 Builder bullet pencapaian

Untuk setiap pengalaman, sediakan pola singkat: `Apa yang dilakukan`, `Bagaimana`, dan `Dampak/hasil`. Gabungkan jawaban menjadi satu bullet yang tetap dapat diedit. Berikan contoh sesuai jalur pengguna.

**Mengapa perlu:** pengguna biasanya kesulitan menulis dampak terukur, bukan kesulitan menambah field. Fitur ini memperbaiki substansi CV tanpa membutuhkan layanan eksternal.

### 4.4 Pemeriksaan pra-ekspor

Sebelum membuka dialog PDF, tampilkan ringkasan: nama file, jumlah halaman, field kontak yang hilang, URL tidak valid, bagian kosong, dan estimasi apakah CV terlalu panjang. Sediakan `Kembali memperbaiki` dan `Tetap ekspor`.

**Mengapa perlu:** saat ini panduan ekspor menjelaskan pengaturan browser, tetapi belum memberi keyakinan bahwa isi dokumen siap dikirim.

### 4.5 Pengelolaan bagian yang fleksibel

Sediakan panel `Atur bagian` untuk menampilkan/menyembunyikan dan mengurutkan bagian dengan tombol naik/turun yang mudah dipakai keyboard. Tambahkan bagian opsional `Penghargaan`, `Publikasi`, dan `Kegiatan Sukarela` hanya bila pengguna memilihnya.

**Mengapa perlu:** kebutuhan CV berbeda antarprofesi. Fleksibilitas ini berguna, tetapi sebaiknya hadir setelah alur inti disederhanakan agar tidak menambah kerumitan awal.

## 5. Aksesibilitas dan kepercayaan

Perbaikan berikut diterapkan bersama Prioritas 1:

- Modal memiliki `role="dialog"`, nama yang dapat dibaca screen reader, focus trap, tombol Escape, dan pengembalian fokus ke pemicu.
- Field dinamis memiliki pasangan label-input yang unik dan pesan error melalui `aria-describedby`.
- Toast dan status autosave memakai live region yang sesuai serta tidak menutupi field penting di mobile.
- Semua tombol ikon memiliki nama aksesibel tanpa bergantung pada emoji atau atribut `title`.
- Berikan pesan privasi singkat: data tetap di perangkat dan tidak dikirim ke server.

**Mengapa perlu:** aplikasi menangani data karier dan kontak. Pengguna perlu memahami di mana data disimpan, sementara pengguna keyboard dan screen reader harus dapat menyelesaikan alur yang sama.

## 6. Urutan implementasi yang disarankan

### Sprint 1 - Keandalan

Draft parsial, migrasi data lama, paginasi panjang, dan tes regresi browser/PDF.

### Sprint 2 - Penyederhanaan alur

Wizard lima langkah, onboarding berdasarkan profil, validasi inline, checklist tindakan, serta penyederhanaan header.

### Sprint 3 - Kesiapan melamar

Mode pratinjau fokus, pemeriksaan pra-ekspor, builder bullet pencapaian, dan beberapa versi CV.

### Sprint 4 - Relevansi lowongan

Analisis lokal deskripsi pekerjaan dan panel pengelolaan bagian lanjutan.

## 7. Ukuran keberhasilan

- Minimal 80% pengguna uji dapat membuat dan mengekspor CV tanpa bantuan.
- Waktu median dari form kosong ke PDF pertama kurang dari 12 menit dengan data contoh atau kurang dari 25 menit dengan data sendiri.
- Tidak ada kehilangan data pada tes refresh untuk setiap jenis field.
- Seluruh skenario PDF pendek dan panjang lolos pemeriksaan A4, teks selectable, tidak terpotong, dan tidak memiliki halaman kosong.
- Pengguna dapat menemukan error field dan menuju lokasi perbaikannya dalam satu aksi.
- Jumlah pengguna yang berhenti sebelum pratinjau pertama berkurang setelah wizard diterapkan.

## 8. Batasan proposal

Proposal tidak mencakup login, penyimpanan cloud, pengiriman lamaran, AI generatif, atau integrasi pihak ketiga. Fitur tersebut menambah risiko privasi dan kompleksitas operasional, sementara nilai utama masih bisa dicapai sepenuhnya secara lokal.
