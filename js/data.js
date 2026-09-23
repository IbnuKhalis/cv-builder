/**
 * Data model, state awal, dan data contoh fiktif (Bahasa Indonesia & English) untuk ATS CV Builder.
 */

// Model data default ketika CV masih kosong
export const defaultEmptyCV = {
  documentLanguage: "id", // "id" | "en"
  careerTrack: "experienced", // "experienced" | "freshgrad"
  profile: {
    fullName: "",
    jobTitle: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    portfolio: ""
  },
  summary: "",
  sectionOrder: ["summary", "experience", "education", "skills", "projects", "certifications", "organizations"],
  hiddenSections: [],
  experience: [],
  education: [],
  skills: {
    technical: "",
    tools: "",
    soft: "",
    languages: ""
  },
  projects: [],
  certifications: [],
  organizations: [],
  jobDescriptionText: "",
  settings: {
    fontFamily: "Calibri, Arial, sans-serif",
    fontSize: "10.5pt",
    lineHeight: "1.45",
    paperMargin: "compact"
  }
};

// Data Contoh 1 (ID): Profesional Berpengalaman (Software Engineer) - Fiktif
export const sampleDataExperienced = {
  documentLanguage: "id",
  careerTrack: "experienced",
  profile: {
    fullName: "Budi Pratama, S.Kom.",
    jobTitle: "Senior Software Engineer",
    email: "budi.pratama.work@email.com",
    phone: "+62 812-3456-7890",
    location: "Jakarta Selatan, DKI Jakarta",
    linkedin: "linkedin.com/in/budi-pratama-fiktif",
    portfolio: "github.com/budipratama"
  },
  summary: "Software Engineer berpengalaman lebih dari 5 tahun dalam merancang dan mengembangkan arsitektur microservices berskala tinggi menggunakan Node.js, Go, dan PostgreSQL. Berpengalaman memimpin tim kecil pengembang, mengoptimasi query database untuk memangkas latensi hingga 40%, serta mengimplementasikan pipeline CI/CD otomatis di lingkungan cloud. Terbiasa bekerja dengan metodologi Agile/Scrum dalam lingkungan startup bertumbuh cepat.",
  sectionOrder: ["summary", "experience", "education", "skills", "projects", "certifications", "organizations"],
  hiddenSections: [],
  experience: [
    {
      id: "exp-1",
      role: "Senior Software Engineer",
      company: "PT Solusi Digital Nusantara",
      location: "Jakarta Selatan, Indonesia",
      startDate: "Jan 2022",
      endDate: "Sekarang",
      isCurrent: true,
      description: "• Memimpin refaktorisasi sistem pembayaran inti dari monolitik ke microservices, meningkatkan keandalan transaksi sebesar 99.98%.\n• Mengoptimasi indeks dan query PostgreSQL pada tabel transaksi bertrafik 2 juta query/hari, memangkas latensi p95 API dari 450ms menjadi 120ms.\n• Mengembangkan pipeline CI/CD menggunakan GitHub Actions dan Docker, mempersingkat siklus rilis fitur dari 3 hari menjadi 4 jam.\n• Membimbing 4 junior software engineer melalui sesi weekly pair-programming dan review arsitektur kode secara terstruktur."
    },
    {
      id: "exp-2",
      role: "Backend Engineer",
      company: "PT Aplikasi Niaga Indonesia",
      location: "Bandung, Jawa Barat",
      startDate: "Agu 2019",
      endDate: "Des 2021",
      isCurrent: false,
      description: "• Merancang dan mengimplementasikan 15+ RESTful API endpoints untuk modul inventaris dan pengiriman barang e-commerce.\n• Mengintegrasikan Redis caching untuk katalog produk bertrafik tinggi, mengurangi beban server backend hingga 35% selama festival belanja bulanan.\n• Mengurangi rasio bug pada tahap production sebesar 30% dengan menerapkan automated unit testing (coverage > 80%) menggunakan Jest."
    }
  ],
  education: [
    {
      id: "edu-1",
      degree: "Sarjana Komputer (S.Kom.)",
      field: "Teknik Informatika",
      institution: "Institut Teknologi Bandung",
      location: "Bandung, Jawa Barat",
      startDate: "2015",
      endDate: "2019",
      gpa: "3.78 / 4.00",
      description: "• Lulusan Cum Laude. Fokus tugas akhir: Optimasi Pendistribusian Beban Komputasi Terdistribusi.\n• Asisten Dosen Laboratorium Algoritma dan Struktur Data (2018–2019)."
    }
  ],
  skills: {
    technical: "Go (Golang), Node.js, TypeScript, PostgreSQL, Redis, RESTful API, Microservices Architecture, Docker, Kubernetes, CI/CD",
    tools: "Git, GitHub Actions, AWS (EC2, S3), Datadog, Postman, Linux",
    soft: "Kepemimpinan Teknis, Pemecahan Masalah Kompleks, Komunikasi Tim Lintas Fungsi, Metodologi Agile / Scrum",
    languages: "Bahasa Indonesia (Penutur Asli), Bahasa Inggris (Profesional Kerja / C1)"
  },
  projects: [
    {
      id: "proj-1",
      title: "Distributed Task Queue Library",
      role: "Pencipta & Kontributor Utama",
      tech: "Go, Redis",
      link: "github.com/budipratama/goflow-task",
      description: "• Mengembangkan library open-source antrean tugas terdistribusi ringan dengan penanganan retry eksponensial otomatis.\n• Diunduh lebih dari 5.000 kali oleh komunitas pengembang dengan 300+ GitHub stars."
    }
  ],
  certifications: [
    {
      id: "cert-1",
      name: "AWS Certified Solutions Architect – Associate",
      issuer: "Amazon Web Services (AWS)",
      year: "2023",
      credentialUrl: "aws.amazon.com/verification/ABC-12345"
    }
  ],
  organizations: [],
  jobDescriptionText: "",
  settings: {
    fontFamily: "Calibri, Arial, sans-serif",
    fontSize: "10.5pt",
    lineHeight: "1.45",
    paperMargin: "compact"
  }
};

// Data Contoh 2 (ID): Fresh Graduate (Lulusan Baru S1 Manajemen / Bisnis) - Fiktif
export const sampleDataFreshGrad = {
  documentLanguage: "id",
  careerTrack: "freshgrad",
  profile: {
    fullName: "Anisa Rahmawati, S.E.",
    jobTitle: "Fresh Graduate Manajemen Bisnis & Pemasaran Digital",
    email: "anisa.rahmawati.business@email.com",
    phone: "+62 821-9876-5432",
    location: "Sleman, D.I. Yogyakarta",
    linkedin: "linkedin.com/in/anisa-rahmawati-fiktif",
    portfolio: "behance.net/anisabizport"
  },
  summary: "Lulusan baru Sarjana Ekonomi dari Universitas Gadjah Mada dengan predikat Pujian (IPK 3.82). Memiliki pengalaman magang purnawaktu selama 6 bulan di bidang pemasaran digital dan riset pasar, terampil mengolah data kampanye menggunakan Google Analytics dan Meta Ads Manager. Aktif memimpin divisi publikasi organisasi mahasiswa tingkat universitas dan berhasil mengelola event bertaraf nasional dengan 1.200+ peserta. Siap berkontribusi secara proaktif dalam peran Business Development, Management Trainee, atau Digital Marketing.",
  sectionOrder: ["summary", "education", "experience", "organizations", "skills", "projects", "certifications"],
  hiddenSections: [],
  education: [
    {
      id: "edu-1",
      degree: "Sarjana Ekonomi (S.E.)",
      field: "Manajemen Bisnis",
      institution: "Universitas Gadjah Mada",
      location: "Yogyakarta, D.I. Yogyakarta",
      startDate: "2020",
      endDate: "2024",
      gpa: "3.82 / 4.00 (Cum Laude)",
      description: "• Skripsi: Analisis Efektivitas Strategi Konten Omnichannel terhadap Konversi E-Commerce F&B Lokal.\n• Penerima Beasiswa Prestasi Akademik Unggulan selama 4 semester berturut-turut."
    }
  ],
  experience: [
    {
      id: "exp-1",
      role: "Digital Marketing & Growth Intern",
      company: "PT Kreatif Inovasi Bangsa",
      location: "Yogyakarta, Indonesia",
      startDate: "Feb 2024",
      endDate: "Jul 2024",
      isCurrent: false,
      description: "• Mengelola dan memproduksi 40+ materi kampanye pemasaran di Instagram dan TikTok, mendongkrak organic engagement rate sebesar 45% dalam 3 bulan.\n• Menganalisis metrik performa funnel iklan Meta Ads, menghasilkan optimasi Cost per Lead (CPL) turun 22% dibandingkan kuartal sebelumnya.\n• Menyusun laporan analitik mingguan dan rekomendasi penargetan audiens yang dipresentasikan langsung kepada Marketing Lead."
    }
  ],
  organizations: [
    {
      id: "org-1",
      name: "BEM Fakultas Ekonomika dan Bisnis UGM",
      role: "Kepala Departemen Hubungan Eksternal",
      period: "2022 - 2023",
      description: "• Memimpin tim beranggotakan 12 staf dalam menjalin kemitraan strategis dengan 15 perusahaan swasta dan BUMN untuk program pelatihan karir.\n• Menghimpun dana sponsorship sebesar Rp 65.000.000 untuk konferensi tahunan mahasiswa nasional."
    }
  ],
  skills: {
    technical: "Digital Marketing, Social Media Analytics, Meta Ads Manager, Google Analytics 4, SEO On-Page, Excel & Google Sheets (Pivot, VLOOKUP, XLOOKUP)",
    tools: "Canva, Notion, Trello, Google Workspace, Mailchimp",
    soft: "Negosiasi & Komunikasi Persuasif, Manajemen Waktu, Kepemimpinan Organisasi, Berpikir Analitis",
    languages: "Bahasa Indonesia (Penutur Asli), Bahasa Inggris (Skor TOEFL ITP: 600 / Setara C1)"
  },
  projects: [
    {
      id: "proj-1",
      title: "Riset Strategi Go-To-Market Brand UMKM Kopi Lokal",
      role: "Ketua Tim Proyek Riset Capstone",
      tech: "Qualitative Survey, Market Sizing, SWOT Analysis",
      link: "",
      description: "• Melakukan survei preferensi konsumen terhadap 350 responden di wilayah D.I. Yogyakarta untuk mengidentifikasi segmen pasar baru.\n• Menghasilkan usulan repositioning brand yang diadopsi mitra UMKM, menghasilkan kenaikan repeat order 18% dalam periode uji coba 2 bulan."
    }
  ],
  certifications: [
    {
      id: "cert-1",
      name: "Google Digital Garage: Fundamentals of Digital Marketing",
      issuer: "Google",
      year: "2023",
      credentialUrl: "skillshop.credential.net/demo-id-889"
    }
  ],
  jobDescriptionText: "",
  settings: {
    fontFamily: "Calibri, Arial, sans-serif",
    fontSize: "10.5pt",
    lineHeight: "1.45",
    paperMargin: "compact"
  }
};

// Data Contoh 3 (EN): Experienced Professional (Senior Software Engineer) - Fictitious
export const sampleDataExperiencedEn = {
  documentLanguage: "en",
  careerTrack: "experienced",
  profile: {
    fullName: "Budi Pratama, B.Sc.",
    jobTitle: "Senior Software Engineer",
    email: "budi.pratama.work@email.com",
    phone: "+62 812-3456-7890",
    location: "South Jakarta, Indonesia",
    linkedin: "linkedin.com/in/budi-pratama-fiktif",
    portfolio: "github.com/budipratama"
  },
  summary: "Senior Software Engineer with 5+ years of experience designing and scaling high-throughput microservices architectures using Node.js, Go, and PostgreSQL. Proven track record of leading engineering squads, optimizing database queries to cut API latency by 40%, and automating cloud CI/CD pipelines. Adept at collaborating in fast-paced Agile/Scrum product environments.",
  sectionOrder: ["summary", "experience", "education", "skills", "projects", "certifications", "organizations"],
  hiddenSections: [],
  experience: [
    {
      id: "exp-1",
      role: "Senior Software Engineer",
      company: "PT Solusi Digital Nusantara",
      location: "South Jakarta, Indonesia",
      startDate: "Jan 2022",
      endDate: "Present",
      isCurrent: true,
      description: "• Spearheaded core payment system migration from monolith to Go microservices, improving transaction reliability to 99.98%.\n• Optimized PostgreSQL composite indexes across 2M+ daily transactions, reducing p95 API latency from 450ms to 120ms.\n• Engineered automated CI/CD pipelines using GitHub Actions and Docker, cutting production deployment lead time from 3 days to 4 hours.\n• Mentored 4 junior engineers through structured code reviews and weekly architecture design sessions."
    },
    {
      id: "exp-2",
      role: "Backend Engineer",
      company: "PT Aplikasi Niaga Indonesia",
      location: "Bandung, Indonesia",
      startDate: "Aug 2019",
      endDate: "Dec 2021",
      isCurrent: false,
      description: "• Designed and delivered 15+ RESTful API endpoints supporting e-commerce inventory and logistics fulfillment.\n• Implemented Redis caching layer for high-traffic product catalogs, reducing database CPU load by 35% during peak sales events.\n• Decreased production defect rate by 30% by establishing automated Jest unit and integration test suites (>80% coverage)."
    }
  ],
  education: [
    {
      id: "edu-1",
      degree: "Bachelor of Science in Computer Science (B.Sc.)",
      field: "Informatics Engineering",
      institution: "Bandung Institute of Technology (ITB)",
      location: "Bandung, Indonesia",
      startDate: "2015",
      endDate: "2019",
      gpa: "3.78 / 4.00",
      description: "• Graduated Cum Laude. Undergraduate Thesis: Load Balancing Optimization in Distributed Computing Clusters.\n• Teaching Assistant for Data Structures and Algorithms Laboratory (2018–2019)."
    }
  ],
  skills: {
    technical: "Go (Golang), Node.js, TypeScript, PostgreSQL, Redis, RESTful APIs, Microservices Architecture, Docker, Kubernetes, CI/CD",
    tools: "Git, GitHub Actions, AWS (EC2, S3, RDS), Datadog, Postman, Linux",
    soft: "Technical Leadership, System Design, Cross-Functional Collaboration, Agile / Scrum Methodologies",
    languages: "Indonesian (Native), English (Full Professional Working Proficiency - C1)"
  },
  projects: [
    {
      id: "proj-1",
      title: "Distributed Task Queue Library",
      role: "Creator & Lead Maintainer",
      tech: "Go, Redis",
      link: "github.com/budipratama/goflow-task",
      description: "• Built a lightweight open-source distributed task queue in Go featuring automated exponential backoff retries.\n• Adopted by 5,000+ developers with 300+ GitHub stars."
    }
  ],
  certifications: [
    {
      id: "cert-1",
      name: "AWS Certified Solutions Architect – Associate",
      issuer: "Amazon Web Services (AWS)",
      year: "2023",
      credentialUrl: "aws.amazon.com/verification/ABC-12345"
    }
  ],
  organizations: [],
  jobDescriptionText: "",
  settings: {
    fontFamily: "Calibri, Arial, sans-serif",
    fontSize: "10.5pt",
    lineHeight: "1.45",
    paperMargin: "compact"
  }
};

// Data Contoh 4 (EN): Fresh Graduate (Business Management & Digital Marketing) - Fictitious
export const sampleDataFreshGradEn = {
  documentLanguage: "en",
  careerTrack: "freshgrad",
  profile: {
    fullName: "Anisa Rahmawati, B.A.",
    jobTitle: "Business Management & Digital Marketing Associate",
    email: "anisa.rahmawati.business@email.com",
    phone: "+62 821-9876-5432",
    location: "Yogyakarta, Indonesia",
    linkedin: "linkedin.com/in/anisa-rahmawati-fiktif",
    portfolio: "behance.net/anisabizport"
  },
  summary: "Cum Laude Business Management graduate from Universitas Gadjah Mada (GPA 3.82/4.00) with 6 months of full-time internship experience in digital marketing and market research. Skilled in analyzing campaign conversion funnels using Google Analytics 4 and Meta Ads Manager. Led a 12-member university external relations department and organized a national student conference with 1,200+ participants.",
  sectionOrder: ["summary", "education", "experience", "organizations", "skills", "projects", "certifications"],
  hiddenSections: [],
  education: [
    {
      id: "edu-1",
      degree: "Bachelor of Economics in Business Management (B.A.)",
      field: "Business Management",
      institution: "Universitas Gadjah Mada (UGM)",
      location: "Yogyakarta, Indonesia",
      startDate: "2020",
      endDate: "2024",
      gpa: "3.82 / 4.00 (Cum Laude)",
      description: "• Undergraduate Thesis: Omnichannel Content Strategy Impact on Local F&B E-Commerce Conversion Rates.\n• Academic Excellence Merit Scholarship Recipient for 4 consecutive semesters."
    }
  ],
  experience: [
    {
      id: "exp-1",
      role: "Digital Marketing & Growth Intern",
      company: "PT Kreatif Inovasi Bangsa",
      location: "Yogyakarta, Indonesia",
      startDate: "Feb 2024",
      endDate: "Jul 2024",
      isCurrent: false,
      description: "• Produced and scheduled 40+ multi-channel marketing assets across Instagram and TikTok, increasing organic engagement rate by 45% within 3 months.\n• Analyzed Meta Ads acquisition funnels and A/B tested ad creatives, reducing Cost per Lead (CPL) by 22% quarter-over-quarter.\n• Delivered weekly cohort performance dashboards and audience segmentation insights to the Marketing Lead."
    }
  ],
  organizations: [
    {
      id: "org-1",
      name: "Student Executive Board (BEM FEB UGM)",
      role: "Head of External Relations Department",
      period: "2022 - 2023",
      description: "• Led a 12-member team to establish strategic career training partnerships with 15 private and state-owned enterprises.\n• Secured IDR 65,000,000 in corporate sponsorships for the annual national student business summit."
    }
  ],
  skills: {
    technical: "Digital Marketing, Social Media Analytics, Meta Ads Manager, Google Analytics 4, On-Page SEO, Excel & Google Sheets (Pivot, VLOOKUP, XLOOKUP)",
    tools: "Canva, Notion, Trello, Google Workspace, Mailchimp",
    soft: "Partnership Negotiation, Project Coordination, Analytical Problem Solving, Public Speaking",
    languages: "Indonesian (Native), English (TOEFL ITP: 600 / C1 Equivalent)"
  },
  projects: [
    {
      id: "proj-1",
      title: "Go-To-Market Strategy for Local Specialty Coffee SME",
      role: "Team Lead — Capstone Consulting Project",
      tech: "Consumer Survey, Market Sizing, SWOT Analysis",
      link: "",
      description: "• Conducted consumer preference surveys across 350 respondents in Yogyakarta to identify underserved student and remote-worker segments.\n• Formulated a brand repositioning roadmap adopted by the SME partner, driving an 18% increase in repeat orders over a 2-month pilot."
    }
  ],
  certifications: [
    {
      id: "cert-1",
      name: "Google Digital Garage: Fundamentals of Digital Marketing",
      issuer: "Google",
      year: "2023",
      credentialUrl: "skillshop.credential.net/demo-id-889"
    }
  ],
  jobDescriptionText: "",
  settings: {
    fontFamily: "Calibri, Arial, sans-serif",
    fontSize: "10.5pt",
    lineHeight: "1.45",
    paperMargin: "compact"
  }
};

/**
 * Mengambil dataset sampel sesuai jalur karir dan bahasa dokumen CV.
 */
export function getSampleDataset(careerTrack = "experienced", documentLanguage = "id") {
  const isEn = String(documentLanguage || "id").toLowerCase() === "en";
  if (careerTrack === "freshgrad") {
    return isEn ? sampleDataFreshGradEn : sampleDataFreshGrad;
  }
  return isEn ? sampleDataExperiencedEn : sampleDataExperienced;
}

// Panduan dan Tips ATS untuk pencari kerja
export const atsGuidelinesInfo = {
  ruleSummary: [
    "Satu Kolom Murni: Mesin ATS membaca teks dari kiri ke kanan. Hindari format dua kolom atau sidebar.",
    "Teks Asli & Terpilih: File PDF wajib berupa teks vektor murni, bukan hasil screenshot gambar atau scan.",
    "Bebas Elemen Grafis: Hindari foto profil, icon dekoratif, grafik rating bintang/persentase, dan tabel kompleks yang membuat sistem parsing eror.",
    "Judul Bagian Standar: Gunakan kata kunci baku seperti 'Pengalaman Kerja', 'Pendidikan', 'Keahlian' agar sistem otomatis mengenali kategori data.",
    "Pencapaian Terukur (Metrik): Jabarkan kontribusi dengan angka, persentase, atau waktu (Formula Tindakan + Metode + Dampak)."
  ],
  actionVerbsIndonesian: [
    "Meningkatkan", "Mengembangkan", "Mengoptimalkan", "Memimpin", "Merancang",
    "Mengkoordinasikan", "Mengimplementasikan", "Menganalisis", "Menghasilkan",
    "Memangkas", "Menegosiasikan", "Menyusun", "Mengelola", "Membangun", "Mengotomatiskan"
  ],
  actionVerbsEnglish: [
    "Developed", "Implemented", "Increased", "Optimized", "Led",
    "Managed", "Designed", "Built", "Reduced", "Automated",
    "Engineered", "Spearheaded", "Coordinated", "Analyzed", "Delivered",
    "Improved", "Streamlined", "Launched", "Architected", "Established", "Achieved"
  ],
  bulletExamples: {
    experienced: {
      action: "Mengoptimalkan proses rekonsiliasi laporan keuangan bulanan",
      method: "menggunakan otomatisasi query SQL dan template dashboard Power BI",
      impact: "memangkas waktu penutupan buku dari 5 hari kerja menjadi 1 hari kerja (efisiensi 80%)"
    },
    freshgrad: {
      action: "Mengkoordinasikan kampanye promosi acara seminar nasional kampus",
      method: "melalui strategi konten terjadwal di Instagram dan kolaborasi 10 media partner mahasiswa",
      impact: "menarik 850+ pendaftar dalam 2 minggu dan melampaui target peserta sebesar 35%"
    }
  }
};
