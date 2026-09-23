# Kebutuhan produk: ATS CV Builder Indonesia

## Tujuan dan pengguna

ATS CV Builder membantu pencari kerja Indonesia membuat CV satu kolom yang mudah dibaca rekruter dan parser ATS, lalu mengekspornya sebagai PDF berisi teks asli. Pengguna utama adalah fresh graduate dan profesional berpengalaman yang ingin membuat CV tanpa harus memahami detail teknis format ATS.

Hasil yang diharapkan:

- pengguna baru dapat menyelesaikan CV pertama tanpa merasa kewalahan;
- draft tidak hilang saat pengguna berhenti dan kembali;
- rekomendasi kualitas CV spesifik dan dapat langsung ditindaklanjuti;
- PDF konsisten, dapat diseleksi, berukuran A4, dan tidak terpotong;
- data tetap diproses di perangkat tanpa akun atau layanan eksternal.

## Ruang lingkup awal

### P0 - Keandalan

1. **Pemulihan draft parsial**
   - Semua field tunggal, termasuk target posisi, email, telepon, lokasi, dan URL, dipulihkan setelah refresh.
   - Draft format lama digabungkan dengan skema default secara aman.
   - Data localStorage rusak tidak membuat aplikasi gagal dimuat.
   - Status penyimpanan membedakan sedang menyimpan, berhasil, dan gagal.

2. **Paginasi PDF panjang**
   - Entri pengalaman yang melebihi satu halaman boleh mengalir ke halaman berikutnya.
   - Heading bagian dan header jabatan tetap bersama minimal satu atau dua baris awal.
   - Tidak ada clipping, duplikasi, heading yatim, halaman kosong, atau ruang kosong besar akibat seluruh entri dipindahkan.

3. **Tes regresi perilaku**
   - Browser test mencakup draft parsial, data rusak, format lama, tambah/hapus/urut entri, backup JSON, dan layout mobile.
   - PDF test memeriksa ukuran A4, ekstraksi teks, halaman kosong, batas halaman, dan kasus konten panjang.

### P1 - UX inti

1. Editor menjadi lima langkah: Profil, Pengalaman, Pendidikan, Keahlian, dan Finalisasi.
2. Onboarding meminta pilihan Fresh Graduate atau Profesional dan menyesuaikan urutan serta rekomendasi.
3. Validasi inline muncul setelah field disentuh atau pengguna melanjutkan langkah.
4. Kelengkapan data dipisahkan dari kualitas isi; rekomendasi memiliki tindakan `Perbaiki sekarang`.
5. Header memiliki satu aksi utama `Unduh PDF`; tindakan sekunder masuk menu `Lainnya`.
6. Mobile memiliki mode pratinjau fokus; desktop memiliki kontrol zoom dan jumlah halaman.
7. Modal, field dinamis, toast, dan navigasi dapat dipakai dengan keyboard dan screen reader.

### P2 - Kesiapan melamar

1. Pemeriksaan pra-ekspor menampilkan jumlah halaman, kontak yang hilang, URL invalid, dan peringatan panjang CV.
2. Builder bullet pencapaian membantu pengguna menyusun tindakan, metode, dan dampak.
3. Pengguna dapat membuat beberapa versi CV lokal dengan nama dan waktu perubahan.
4. Pengguna dapat menempel deskripsi pekerjaan untuk analisis kata kunci lokal tanpa klaim peluang lolos.
5. Panel `Atur bagian` mengelola urutan dan visibilitas bagian opsional.

### P3 - Dukungan bilingual Indonesia dan Inggris

1. Pengguna dapat memilih bahasa antarmuka dan bahasa dokumen CV secara terpisah.
2. Bahasa antarmuka mengatur menu, tombol, label, validasi, onboarding, bantuan, serta status aplikasi.
3. Bahasa dokumen disimpan per versi CV dan mengatur heading preview/PDF, contoh, action verbs, panduan penulisan, serta analisis deskripsi pekerjaan.
4. Mengganti salah satu bahasa tidak menerjemahkan, menghapus, atau menimpa isi yang ditulis pengguna.
5. Data contoh profesional dan fresh graduate tersedia dalam Bahasa Indonesia dan English.
6. Draft lama dimigrasikan ke dokumen Bahasa Indonesia tanpa kehilangan data.
7. PDF kedua bahasa tetap A4, selectable, mudah dipindai ATS, dan memiliki urutan ekstraksi teks yang benar.

Spesifikasi lengkap dan matriks pengujian tersedia di [BILINGUAL_SUPPORT_PROPOSAL.md](BILINGUAL_SUPPORT_PROPOSAL.md).

## Batasan dan hal di luar lingkup

- Tidak ada login, backend, sinkronisasi cloud, pengiriman lamaran, atau deployment dalam fase ini.
- Tidak ada jaminan skor atau kelulusan ATS.
- Tidak ada pengiriman data CV ke layanan pihak ketiga.
- Tidak ada penerjemahan otomatis atau layanan bahasa eksternal pada fase bilingual pertama.
- Tidak menambahkan dependency baru kecuali ada kebutuhan yang tidak dapat dipenuhi dengan stack saat ini dan disetujui pengguna.
- Pertahankan format CV satu kolom, teks selectable, tanpa foto, tabel layout, ikon dekoratif, atau grafik rating di dokumen PDF.

## Kriteria keberhasilan produk

- Setiap jenis field tunggal bertahan setelah refresh.
- Skenario PDF pendek, profesional, dan panjang lolos pemeriksaan visual dan ekstraksi teks.
- Tidak ada horizontal overflow pada lebar 390 px.
- Pengguna dapat menemukan dan menuju field bermasalah dalam satu tindakan.
- Minimal 80% peserta usability test dapat mengisi dan mengekspor CV tanpa bantuan.
- Waktu median menuju PDF pertama kurang dari 12 menit dengan contoh data atau 25 menit dengan data sendiri.
- Seluruh string sistem tersedia lengkap dalam `id` dan `en` tanpa campuran bahasa pada alur utama.
- Bahasa UI bertahan setelah refresh, sedangkan bahasa dokumen bertahan secara independen pada setiap versi CV.

## Keputusan yang masih terbuka

- Apakah wizard lima langkah menjadi satu-satunya mode atau pengguna dapat memilih tampilan semua bagian.
- Apakah beberapa versi CV disimpan hanya di localStorage atau memakai IndexedDB.
- Apakah analisis deskripsi pekerjaan hanya menghitung kata kunci atau juga menawarkan penyusunan ulang kalimat tanpa AI eksternal.
- Apakah deteksi ketidaksesuaian bahasa isi cukup memakai heuristik lokal atau ditunda sampai ada bukti kebutuhan pengguna.
