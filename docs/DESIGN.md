# Desain: ATS CV Builder Indonesia

## Tujuan pengalaman

Pengguna harus selalu memahami tiga hal: posisi mereka dalam proses, apa yang perlu diisi berikutnya, dan apakah CV sudah aman diekspor. Antarmuka menggunakan Bahasa Indonesia yang langsung, tidak mengklaim skor ATS, dan tidak memperlihatkan semua kompleksitas sekaligus.

## Struktur dan interaksi

### Onboarding

Tampilkan tiga pilihan: Fresh Graduate, Profesional Berpengalaman, dan Mulai Kosong. Pilihan profil mengubah urutan langkah dan contoh, tetapi tidak mengunci pengguna.

### Wizard editor

1. **Profil** - identitas, target posisi, kontak, dan ringkasan.
2. **Pengalaman** - kerja/magang; untuk fresh graduate tampilkan proyek/organisasi lebih dahulu bila belum ada pengalaman.
3. **Pendidikan** - pendidikan formal dan prestasi relevan.
4. **Keahlian** - hard skills, tools, soft skills, dan bahasa.
5. **Finalisasi** - checklist, urutan bagian, pratinjau, dan ekspor.

Setiap langkah memiliki judul, penjelasan singkat, progres, `Sebelumnya`, dan `Lanjut`. Daftar langkah tetap dapat dipakai untuk melompat. Bagian tambahan berada di `Tambahkan bagian lain`.

### Validasi dan bantuan

- Pesan error berada tepat di bawah field dan menjelaskan cara memperbaiki.
- Error muncul setelah field disentuh atau saat pengguna menekan `Lanjut`.
- Checklist final memiliki tombol `Perbaiki sekarang` yang memindahkan fokus ke field terkait.
- Builder bullet menggunakan tiga input: tindakan, cara/metode, serta hasil/dampak; hasil akhirnya tetap dapat diedit bebas.

### Header

- Judul dokumen dan status autosave berada di kiri.
- `Unduh PDF` menjadi tombol utama.
- Data contoh, Impor, Ekspor JSON, Tipografi, dan Kosongkan berada di menu `Lainnya`.

### Pratinjau

- Desktop: split view dengan `Fit`, `100%`, jumlah halaman, dan toggle editor/pratinjau bila ruang sempit.
- Mobile: tab pratinjau layar penuh dengan tombol tetap `Kembali mengedit` dan `Unduh PDF`.
- Pra-ekspor menampilkan nama file, jumlah halaman, masalah kontak/URL, dan peringatan panjang.

### Keadaan antarmuka

- **Kosong:** onboarding dan satu CTA yang jelas.
- **Menyimpan:** teks status nonblocking.
- **Tersimpan:** waktu simpan terakhir.
- **Gagal:** pesan persisten dengan tindakan ekspor backup.
- **Data rusak:** pulihkan form default, jelaskan masalah, dan jangan menimpa payload rusak sebelum pengguna mengetik.
- **PDF terlalu panjang:** tampilkan saran ringkas, tetapi pengguna tetap boleh mengekspor.

## Pedoman tampilan

- Pertahankan warna, tipografi, kartu, dan gaya bersih yang ada.
- Gunakan satu warna primer untuk aksi utama dan warna netral untuk aksi sekunder.
- Jangan gunakan emoji sebagai satu-satunya pembeda fungsi.
- Kurangi kepadatan visual dengan progressive disclosure dan jarak konsisten.
- Dokumen CV tetap monokrom, satu kolom, dan tidak mengikuti dekorasi antarmuka aplikasi.

## Responsivitas dan aksesibilitas

- Target minimum 390 x 844 untuk mobile dan 1366 x 900 untuk desktop.
- Tidak ada horizontal overflow pada viewport aplikasi.
- Semua input dinamis memiliki `id`, `label for`, dan pesan melalui `aria-describedby`.
- Modal menggunakan `role="dialog"`, `aria-modal="true"`, focus trap, Escape, dan mengembalikan fokus ke pemicu.
- Status autosave dan toast memakai live region yang sesuai.
- Semua alur dapat diselesaikan dengan keyboard dan fokus terlihat jelas.
- Hormati `prefers-reduced-motion`.

## Verifikasi

- Fresh visit, draft parsial, draft lengkap, format lama, dan localStorage rusak.
- Fresh graduate tanpa pengalaman kerja dan profesional dengan beberapa pengalaman.
- Tambah, hapus, dan urutkan semua jenis entri.
- Mobile editor dan preview pada 390 px; desktop split view pada 1366 px.
- PDF 1 halaman, 2 halaman, serta stress case lebih dari 3 halaman.
- Navigasi keyboard, modal, focus return, label screen reader, dan live status.

## Pengalaman bilingual

### Kontrol bahasa

- `Bahasa aplikasi / App language` berada di menu `Lainnya / More` dan mengubah seluruh teks sistem tanpa reload.
- `Bahasa CV / CV language` berada di langkah `Finalisasi / Finalize`, dekat preview dan ekspor.
- Tambahkan helper text bahwa bahasa CV mengubah heading dan panduan, tetapi tidak menerjemahkan isi pengguna.
- Bahasa CV disimpan per versi; bahasa aplikasi menjadi preferensi global.

### Umpan balik saat berganti bahasa

- Perubahan bahasa aplikasi mempertahankan langkah aktif, fokus, posisi scroll, dan isi form.
- Perubahan bahasa CV memperbarui preview langsung dan diumumkan melalui live region.
- Bila isi tampak memakai bahasa lain, tampilkan peringatan nonblocking tanpa mencegah ekspor.
- Empty state, contoh bullet, dan builder pencapaian mengikuti bahasa CV agar pengguna tidak mencampur bahasa tanpa sadar.

### Aturan copy dan layout

- Gunakan terminologi kanonis dari proposal bilingual dan jangan mencampur `resume` dengan `CV` dalam satu locale.
- Sediakan ruang untuk label English yang lebih panjang; tombol utama tidak boleh terpotong pada lebar 390 px.
- Nama produk dan istilah teknis seperti ATS, PDF, LinkedIn, serta nama tools boleh tetap sama.
- `html[lang]` mengikuti bahasa aplikasi dan container preview memakai `lang` dari bahasa CV.

Detail interaksi, istilah, dan acceptance criteria tersedia di [BILINGUAL_SUPPORT_PROPOSAL.md](BILINGUAL_SUPPORT_PROPOSAL.md).
