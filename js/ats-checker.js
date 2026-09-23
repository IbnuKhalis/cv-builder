/**
 * Modul Evaluasi Kesiapan CV, Validasi Inline, Pencocok Kata Kunci Lowongan (Bilingual ID/EN),
 * dan Pemeriksaan Pra-Ekspor PDF.
 * Catatan Etis: Modul ini mengevaluasi kelengkapan data & keterbacaan teknis secara jujur,
 * tanpa memberikan klaim skor persentase kelulusan seleksi kerja.
 */

import { t, getInterfaceLanguage, getDocumentCopy, normalizeLanguage } from "./i18n.js";

/**
 * Validasi format email standar.
 */
export function isValidEmail(email) {
  if (!email || !email.trim()) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Validasi nomor telepon Indonesia / Internasional (+62 / 08xx / min 9 digit).
 */
export function isValidPhone(phone) {
  if (!phone || !phone.trim()) return false;
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^(\+?\d{9,15})$/.test(cleaned);
}

/**
 * Validasi URL opsional (LinkedIn, GitHub, Portofolio).
 */
export function isValidUrl(url) {
  if (!url || !url.trim()) return true; // Opsional
  const trimmed = url.trim();
  const re = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
  return re.test(trimmed);
}

/**
 * Ekstrak tahun 4 digit dari string periode (misal "Agu 2021" -> 2021).
 */
export function extractYear(periodStr) {
  if (!periodStr || typeof periodStr !== "string") return null;
  const m = periodStr.match(/\b(19\d{2}|20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Validasi rentang periode mulai & selesai.
 */
export function validateYearRange(startDate, endDate, isCurrent = false) {
  if (isCurrent) return { valid: true, message: "" };
  const startY = extractYear(startDate);
  const endY = extractYear(endDate);
  if (startY !== null && endY !== null && endY < startY) {
    return {
      valid: false,
      message: t("validation.yearRangeInvalid", { start: startY, end: endY })
    };
  }
  return { valid: true, message: "" };
}

/**
 * Menghasilkan nama file PDF netral bahasa sesuai spesifikasi:
 * <nama>-<target-posisi>-cv.pdf (dibersihkan dari karakter ilegal).
 */
export function buildPdfFileName(cvData) {
  const p = (cvData && cvData.profile) || {};
  const slugify = (str) =>
    String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

  const nameSlug = slugify(p.fullName) || "candidate";
  const roleSlug = slugify(p.jobTitle);
  const base = roleSlug ? `${nameSlug}-${roleSlug}-cv` : `${nameSlug}-cv`;
  return `${base}.pdf`;
}

// Kata fungsi umum untuk deteksi heuristik bahasa isi
const ID_FUNCTION_WORDS = new Set([
  "yang", "dan", "dengan", "untuk", "dalam", "pada", "dari", "sebagai", "melalui",
  "terhadap", "oleh", "serta", "telah", "dapat", "selama", "antara", "secara"
]);

const EN_FUNCTION_WORDS = new Set([
  "the", "and", "with", "for", "from", "through", "across", "within", "between",
  "including", "during", "using", "into", "while", "under", "over", "their"
]);

/**
 * Deteksi heuristik apakah teks isi tampak ditulis dalam bahasa yang berbeda dari documentLanguage.
 */
export function detectContentLanguageMismatch(textCorpus, documentLanguage) {
  const docLang = normalizeLanguage(documentLanguage);
  const words = String(textCorpus || "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(w => w.length >= 2);

  if (words.length < 15) {
    return { hasMismatch: false, detectedLang: docLang };
  }

  let idHits = 0;
  let enHits = 0;
  for (const w of words) {
    if (ID_FUNCTION_WORDS.has(w)) idHits += 1;
    if (EN_FUNCTION_WORDS.has(w)) enHits += 1;
  }

  if (docLang === "en" && idHits >= 4 && idHits > enHits * 2) {
    return { hasMismatch: true, detectedLang: "id" };
  }
  if (docLang === "id" && enHits >= 4 && enHits > idHits * 2) {
    return { hasMismatch: true, detectedLang: "en" };
  }

  return { hasMismatch: false, detectedLang: docLang };
}

/**
 * Menganalisis kesiapan CV dalam 2 pilar terpisah:
 * 1. Kelengkapan Data (Data Completeness)
 * 2. Kualitas Isi (Content Quality)
 * Pesan memakai bahasa UI (interfaceLanguage); aturan linguistik & contoh memakai bahasa CV (documentLanguage).
 * @param {Object} cvData 
 */
export function analyzeCVCompleteness(cvData) {
  const uiLang = getInterfaceLanguage();
  const docLang = normalizeLanguage(cvData && cvData.documentLanguage);
  const docCopy = getDocumentCopy(docLang);
  const isFreshGrad = cvData && cvData.careerTrack === "freshgrad";
  const checks = [];

  // =========================================================================
  // PILAR 1: KELENGKAPAN DATA (Data Completeness)
  // =========================================================================
  let dataPoints = 0; // Dari total 60 poin data

  const p = (cvData && cvData.profile) || {};
  const hasName = Boolean(p.fullName && p.fullName.trim().length >= 2);
  const hasTitle = Boolean(p.jobTitle && p.jobTitle.trim().length >= 2);
  const hasValidEmail = isValidEmail(p.email);
  const hasValidPhone = isValidPhone(p.phone);
  const hasLocation = Boolean(p.location && p.location.trim().length >= 2);
  const hasValidLinkedin = isValidUrl(p.linkedin);
  const hasValidPortfolio = isValidUrl(p.portfolio);

  if (hasName) dataPoints += 5;
  if (hasTitle) dataPoints += 5;
  if (hasValidEmail) dataPoints += 5;
  if (hasValidPhone) dataPoints += 5;
  if (hasLocation) dataPoints += 5;

  const missingContact = [];
  if (!hasName) missingContact.push(t("fields.fullName"));
  if (!hasTitle) missingContact.push(t("fields.jobTitle"));
  if (!hasValidEmail) missingContact.push(t("fields.email"));
  if (!hasValidPhone) missingContact.push(t("fields.phone"));
  if (!hasLocation) missingContact.push(t("fields.location"));

  checks.push({
    id: "contact_data",
    pillar: "data",
    category: t("checks.contactCategory"),
    passed: missingContact.length === 0,
    message: missingContact.length === 0
      ? t("checks.contactComplete")
      : `${t("checks.contactMissingPrefix")} ${missingContact.join(", ")}.`,
    reason: t("checks.contactReason"),
    example: t("checks.contactExample", {}, docLang),
    targetStep: 1,
    targetSelector: !hasName ? "#prof-name" : (!hasTitle ? "#prof-title" : (!hasValidEmail ? "#prof-email" : (!hasValidPhone ? "#prof-phone" : "#prof-location")))
  });

  if (!hasValidLinkedin || !hasValidPortfolio) {
    checks.push({
      id: "contact_url_format",
      pillar: "data",
      category: t("checks.urlCategory"),
      passed: false,
      message: t("checks.urlInvalidMsg"),
      reason: t("checks.urlReason"),
      example: t("checks.urlExample", {}, docLang),
      targetStep: 1,
      targetSelector: !hasValidLinkedin ? "#prof-linkedin" : "#prof-portfolio"
    });
  }

  // Pendidikan
  const educations = Array.isArray(cvData && cvData.education) ? cvData.education : [];
  const validEdu = educations.filter(e => e && (e.degree && e.degree.trim()) && (e.institution && e.institution.trim()));
  const eduPassed = validEdu.length > 0;
  if (eduPassed) {
    dataPoints += 15;
  } else if (educations.length > 0) {
    dataPoints += 7;
  }

  checks.push({
    id: "education_data",
    pillar: "data",
    category: t("checks.eduCategory"),
    passed: eduPassed,
    message: eduPassed
      ? t("checks.eduComplete")
      : (educations.length > 0 ? t("checks.eduPartial") : t("checks.eduEmpty")),
    reason: t("checks.eduReason"),
    example: t("checks.eduExample", {}, docLang),
    targetStep: 3,
    targetSelector: educations.length > 0 ? ".edu-inst" : "#btn-add-education"
  });

  // Pengalaman Kerja / Magang / Organisasi / Proyek
  const experiences = Array.isArray(cvData && cvData.experience) ? cvData.experience : [];
  const validExp = experiences.filter(e => e && (e.role && e.role.trim()) && (e.company && e.company.trim()) && (e.description && e.description.trim()));
  const projects = Array.isArray(cvData && cvData.projects) ? cvData.projects : [];
  const validProjects = projects.filter(pr => pr && (pr.title && pr.title.trim()) && (pr.description && pr.description.trim()));
  const orgs = Array.isArray(cvData && cvData.organizations) ? cvData.organizations : [];
  const validOrgs = orgs.filter(o => o && (o.name && o.name.trim()) && (o.role && o.role.trim()));

  if (isFreshGrad) {
    const hasFreshActivity = validExp.length > 0 || validProjects.length > 0 || validOrgs.length > 0;
    if (hasFreshActivity) dataPoints += 15;
    checks.push({
      id: "experience_data",
      pillar: "data",
      category: t("checks.expTrackFreshCategory"),
      passed: hasFreshActivity,
      message: hasFreshActivity ? t("checks.expTrackFreshPass") : t("checks.expTrackFreshFail"),
      reason: t("checks.expTrackFreshReason"),
      example: t("checks.expTrackFreshExample", {}, docLang),
      targetStep: 2,
      targetSelector: "#btn-add-experience"
    });
  } else {
    const expPassed = validExp.length > 0;
    if (expPassed) {
      dataPoints += 15;
    } else if (experiences.length > 0) {
      dataPoints += 7;
    }
    checks.push({
      id: "experience_data",
      pillar: "data",
      category: t("checks.expTrackProCategory"),
      passed: expPassed,
      message: expPassed
        ? t("checks.expTrackProPass")
        : (experiences.length > 0 ? t("checks.expTrackProPartial") : t("checks.expTrackProEmpty")),
      reason: t("checks.expTrackProReason"),
      example: t("checks.expTrackProExample", {}, docLang),
      targetStep: 2,
      targetSelector: experiences.length > 0 ? ".exp-role" : "#btn-add-experience"
    });
  }

  // Cek validitas rentang tahun pada pengalaman & pendidikan
  let invalidPeriodItem = null;
  for (const exp of experiences) {
    const vr = validateYearRange(exp.startDate, exp.endDate, exp.isCurrent);
    if (!vr.valid) {
      invalidPeriodItem = { message: vr.message, step: 2, selector: ".exp-end" };
      break;
    }
  }
  if (!invalidPeriodItem) {
    for (const edu of educations) {
      const vr = validateYearRange(edu.startDate, edu.endDate, false);
      if (!vr.valid) {
        invalidPeriodItem = { message: vr.message, step: 3, selector: ".edu-end" };
        break;
      }
    }
  }
  if (invalidPeriodItem) {
    checks.push({
      id: "period_range_check",
      pillar: "data",
      category: t("checks.periodCategory"),
      passed: false,
      message: invalidPeriodItem.message,
      reason: t("checks.periodInvalidReason"),
      example: t("checks.periodInvalidExample", {}, docLang),
      targetStep: invalidPeriodItem.step,
      targetSelector: invalidPeriodItem.selector
    });
  }

  // Keahlian (Skills)
  const skills = (cvData && cvData.skills) || {};
  const hasTechSkills = Boolean(skills.technical && skills.technical.trim().length > 3);
  const hasToolsSkills = Boolean(skills.tools && skills.tools.trim().length > 3);
  const skillsPassed = hasTechSkills && hasToolsSkills;
  if (hasTechSkills) dataPoints += 3;
  if (hasToolsSkills) dataPoints += 2;

  checks.push({
    id: "skills_data",
    pillar: "data",
    category: t("checks.skillsCategory"),
    passed: skillsPassed,
    message: skillsPassed ? t("checks.skillsPass") : t("checks.skillsFail"),
    reason: t("checks.skillsReason"),
    example: docCopy.placeholders ? docCopy.placeholders.skillsTech : "",
    targetStep: 4,
    targetSelector: !hasTechSkills ? "#skills-technical" : "#skills-tools"
  });

  // =========================================================================
  // PILAR 2: KUALITAS ISI (Content Quality) — Mengikuti Bahasa Dokumen (docLang)
  // =========================================================================
  let qualityPoints = 0; // Dari total 40 poin kualitas

  const summary = ((cvData && cvData.summary) || "").trim();
  const summaryWordCount = summary ? summary.split(/\s+/).filter(Boolean).length : 0;
  let summaryQualityPassed = false;
  let summaryMsg = "";

  if (summaryWordCount >= 25 && summaryWordCount <= 110) {
    qualityPoints += 15;
    summaryQualityPassed = true;
    summaryMsg = t("checks.summaryGood", { words: summaryWordCount });
  } else if (summaryWordCount > 0 && summaryWordCount < 25) {
    qualityPoints += 7;
    summaryMsg = t("checks.summaryShort", { words: summaryWordCount });
  } else if (summaryWordCount > 110) {
    qualityPoints += 10;
    summaryMsg = t("checks.summaryLong", { words: summaryWordCount });
  } else {
    summaryMsg = t("checks.summaryEmpty");
  }

  checks.push({
    id: "summary_quality",
    pillar: "quality",
    category: t("checks.summaryCategory"),
    passed: summaryQualityPassed,
    message: summaryMsg,
    reason: t("checks.summaryReason"),
    example: docCopy.placeholders ? docCopy.placeholders.summary : "",
    targetStep: 1,
    targetSelector: "#summary-textarea"
  });

  // Kualitas Deskripsi Pencapaian (Action Verbs & Metrics sesuai bahasa dokumen)
  const allDescriptions = [
    ...experiences.map(e => e.description || ""),
    ...projects.map(pr => pr.description || ""),
    ...orgs.map(o => o.description || "")
  ].join(" ");

  const hasMetrics =
    /\b\d+([.,]\d+)?%|\b(Rp|IDR|USD|\$)\s?[\d.,]+|\b\d+\+?\s?(pengguna|klien|proyek|tim|staf|peserta|jam|hari|bulan|endpoint|transaksi|laporan|produk|artikel|kampanye|responden|users|clients|projects|engineers|developers|members|attendees|participants|hours|days|months|endpoints|transactions|records|queries|stars|downloads|events)/i.test(allDescriptions) ||
    /\b\d+(\.\d+)?%/.test(allDescriptions);

  const activeVerbsList = Array.isArray(docCopy.actionVerbs) ? docCopy.actionVerbs : [];
  let hasActionVerbs = false;
  for (const verb of activeVerbsList) {
    if (new RegExp(`\\b${verb}\\b`, "i").test(allDescriptions)) {
      hasActionVerbs = true;
      break;
    }
  }

  if (hasActionVerbs) qualityPoints += 12;
  if (hasMetrics) qualityPoints += 13;

  const impactQualityPassed = hasActionVerbs && hasMetrics;
  const sampleVerbs = activeVerbsList.slice(0, 4).join(", ");
  checks.push({
    id: "impact_quality",
    pillar: "quality",
    category: t("checks.impactCategory"),
    passed: impactQualityPassed,
    message: impactQualityPassed
      ? t("checks.impactPass")
      : (!hasActionVerbs
        ? `${t("checks.impactNeedVerbs")} (${sampleVerbs}).`
        : t("checks.impactNeedMetrics")),
    reason: t("checks.impactReason"),
    example: (docCopy.bulletExamples && docCopy.bulletExamples[isFreshGrad ? "freshgrad" : "experienced"] && docCopy.bulletExamples[isFreshGrad ? "freshgrad" : "experienced"][0]) || "",
    targetStep: 2,
    targetSelector: ".exp-desc"
  });

  // Deteksi konsistensi bahasa isi dengan documentLanguage (Non-blocking)
  const fullTextCorpus = `${summary} ${allDescriptions}`;
  const langCheck = detectContentLanguageMismatch(fullTextCorpus, docLang);
  if (langCheck.hasMismatch) {
    checks.push({
      id: "lang_consistency",
      pillar: "quality",
      category: t("checks.langConsistencyCategory"),
      passed: false,
      message: t("checks.langConsistencyWarn"),
      reason: t("checks.langConsistencyReason"),
      example: "",
      targetStep: 5,
      targetSelector: "#select-document-language"
    });
  }

  const dataPercent = Math.min(100, Math.round((dataPoints / 60) * 100));
  const qualityPercent = Math.min(100, Math.round((qualityPoints / 40) * 100));
  const totalPoints = Math.min(100, Math.round(dataPoints + qualityPoints));

  let overallStatusLabel = t("readiness.statusNeedsCompletion");
  if (dataPercent >= 90 && qualityPercent >= 85) {
    overallStatusLabel = t("readiness.statusReadyToReview");
  } else if (dataPercent >= 80 && qualityPercent < 85) {
    overallStatusLabel = t("readiness.statusNeedsStrengthening");
  } else if (dataPercent >= 65) {
    overallStatusLabel = t("readiness.statusBasicDone");
  }

  return {
    completenessPercentage: totalPoints,
    overallStatusLabel,
    documentLanguage: docLang,
    interfaceLanguage: uiLang,
    languageMismatch: langCheck.hasMismatch,
    dataCompleteness: {
      score: dataPoints,
      maxScore: 60,
      percentage: dataPercent
    },
    contentQuality: {
      score: qualityPoints,
      maxScore: 40,
      percentage: qualityPercent
    },
    checks,
    hasMetrics,
    hasActionVerbs
  };
}

// ============================================================================
// SPRINT 4 & 7: Analisis Lokal Deskripsi Pekerjaan Per Bahasa (ID vs EN)
// ============================================================================

const STOPWORDS_ID = new Set([
  "dan", "atau", "yang", "di", "ke", "dari", "untuk", "pada", "dengan", "dalam", "ini", "itu",
  "adalah", "sebagai", "oleh", "akan", "dapat", "bisa", "memiliki", "minimal", "maksimal", "tahun",
  "pengalaman", "kerja", "bekerja", "mampu", "baik", "secara", "tim", "individu", "perusahaan",
  "kami", "anda", "kandidat", "pelamar", "posisi", "lowongan", "utama", "tugas", "tanggung", "jawab",
  "kualifikasi", "persyaratan", "pendidikan", "lulusan", "jurusan", "terkait", "lainnya", "serta",
  "setara", "menguasai", "memahami", "terbiasa", "menggunakan", "membuat", "melakukan", "dicari",
  "dibutuhkan", "pria", "wanita", "usia", "bersedia", "penempatan", "area", "kota", "sekitarnya"
]);

const STOPWORDS_EN = new Set([
  "the", "and", "or", "in", "on", "at", "to", "for", "of", "with", "by", "from", "as", "is", "are",
  "be", "will", "can", "able", "work", "working", "experience", "years", "year", "team", "strong",
  "good", "skills", "skill", "knowledge", "understanding", "degree", "bachelor", "ability", "using",
  "such", "other", "have", "has", "must", "preferred", "plus", "role", "job", "company", "business",
  "looking", "seeking", "candidate", "candidates", "responsibilities", "requirements", "qualifications",
  "including", "across", "within", "through", "our", "you", "your", "we", "their", "this", "that",
  "familiar", "proficient", "proven", "track", "record", "environment", "fast", "paced"
]);

/**
 * Menganalisis kecocokan kata kunci antara Deskripsi Lowongan dengan isi CV secara lokal.
 * Memilih stopword dan normalisasi token berdasarkan bahasa dokumen CV (documentLanguage).
 * @param {Object} cvData 
 * @param {string} jdText 
 */
export function analyzeJobDescriptionMatch(cvData, jdText) {
  const docLang = normalizeLanguage(cvData && cvData.documentLanguage);
  const rawJD = String(jdText || "").trim();
  if (!rawJD || rawJD.length < 15) {
    return {
      hasInput: false,
      analysisLanguage: docLang,
      matchedKeywords: [],
      missingKeywords: [],
      suggestions: []
    };
  }

  const p = (cvData && cvData.profile) || {};
  const s = (cvData && cvData.skills) || {};
  const cvCorpus = [
    p.jobTitle || "",
    (cvData && cvData.summary) || "",
    s.technical || "",
    s.tools || "",
    s.soft || "",
    s.languages || "",
    ...((cvData && cvData.experience) || []).map(e => `${e.role || ""} ${e.company || ""} ${e.description || ""}`),
    ...((cvData && cvData.education) || []).map(e => `${e.degree || ""} ${e.field || ""} ${e.institution || ""} ${e.description || ""}`),
    ...((cvData && cvData.projects) || []).map(pr => `${pr.title || ""} ${pr.role || ""} ${pr.tech || ""} ${pr.description || ""}`),
    ...((cvData && cvData.certifications) || []).map(c => `${c.name || ""} ${c.issuer || ""}`),
    ...((cvData && cvData.organizations) || []).map(o => `${o.name || ""} ${o.role || ""} ${o.description || ""}`)
  ].join(" ").toLowerCase();

  // Pilih stopword berdasarkan bahasa dokumen (dan tetap cegah kata fungsi dasar bahasa lain mendominasi)
  const activeStopwords = docLang === "en" ? STOPWORDS_EN : STOPWORDS_ID;
  const secondaryStopwords = docLang === "en" ? STOPWORDS_ID : STOPWORDS_EN;

  // Pertahankan istilah teknis pendek seperti Go, C#, R, UI, UX, AI, QA, BI, CI/CD, SQL, AWS
  const ALLOWED_SHORT_TECH = new Set(["go", "c#", "c++", "js", "ts", "ui", "ux", "ai", "ml", "qa", "bi", "ci/cd"]);

  const cleanedTokens = rawJD
    .replace(/[•*—–()[\]{}"'“”‘’\\|;:!?]/g, " ")
    .split(/[\s,]+/)
    .map(token => token.trim().replace(/^[.-]+|[.-]+$/g, ""))
    .filter(token => {
      const low = token.toLowerCase();
      return token.length >= 3 || ALLOWED_SHORT_TECH.has(low);
    });

  const freqMap = new Map();
  for (const token of cleanedTokens) {
    const lower = token.toLowerCase();
    if (activeStopwords.has(lower) || secondaryStopwords.has(lower)) continue;
    if (/^\d+$/.test(lower)) continue;
    const display = /[A-Z]{2,}|\.|#|\+/.test(token) ? token : lower;
    const prev = freqMap.get(lower) || { display, count: 0 };
    prev.count += 1;
    freqMap.set(lower, prev);
  }

  const sortedKeywords = Array.from(freqMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20);

  const matchedKeywords = [];
  const missingKeywords = [];

  for (const [lowerKey, info] of sortedKeywords) {
    const escaped = lowerKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
    if (regex.test(cvCorpus)) {
      matchedKeywords.push(info.display);
    } else {
      missingKeywords.push(info.display);
    }
  }

  return {
    hasInput: true,
    analysisLanguage: docLang,
    matchedKeywords,
    missingKeywords,
    suggestions: []
  };
}

// ============================================================================
// SPRINT 3 & 6: Pemeriksaan Pra-Ekspor PDF (Bilingual)
// ============================================================================

export function runPreExportDiagnostics(cvData, estimatedPages = 1) {
  const p = (cvData && cvData.profile) || {};
  const docLang = normalizeLanguage(cvData && cvData.documentLanguage);
  const fileName = buildPdfFileName(cvData);

  const issues = [];
  const hiddenOrEmpty = [];

  if (!p.fullName || !p.fullName.trim()) {
    issues.push({
      severity: "high",
      label: t("validation.nameRequired"),
      step: 1,
      selector: "#prof-name"
    });
  }
  if (!isValidEmail(p.email)) {
    issues.push({
      severity: "high",
      label: p.email ? t("validation.emailInvalid") : t("validation.emailRequired"),
      step: 1,
      selector: "#prof-email"
    });
  }
  if (!isValidPhone(p.phone)) {
    issues.push({
      severity: "medium",
      label: p.phone ? t("validation.phoneInvalid") : t("validation.phoneRequired"),
      step: 1,
      selector: "#prof-phone"
    });
  }
  if (!isValidUrl(p.linkedin)) {
    issues.push({
      severity: "low",
      label: t("validation.urlInvalid"),
      step: 1,
      selector: "#prof-linkedin"
    });
  }
  if (!isValidUrl(p.portfolio)) {
    issues.push({
      severity: "low",
      label: t("validation.urlInvalid"),
      step: 1,
      selector: "#prof-portfolio"
    });
  }

  // Cek konsistensi bahasa isi dengan bahasa dokumen
  const allText = [
    (cvData && cvData.summary) || "",
    ...((cvData && cvData.experience) || []).map(e => e.description || "")
  ].join(" ");
  if (detectContentLanguageMismatch(allText, docLang).hasMismatch) {
    issues.push({
      severity: "info",
      label: t("checks.langConsistencyWarn"),
      step: 5,
      selector: "#select-document-language"
    });
  }

  const hiddenSet = new Set((cvData && cvData.hiddenSections) || []);
  const sectionNames = t("settings.sectionNames") || {};
  const sectionCheckMap = [
    { key: "summary", name: sectionNames.summary || "Summary", has: Boolean(cvData && cvData.summary && cvData.summary.trim()) },
    { key: "experience", name: sectionNames.experience || "Experience", has: Array.isArray(cvData && cvData.experience) && cvData.experience.some(e => e.role || e.company || e.description) },
    { key: "education", name: sectionNames.education || "Education", has: Array.isArray(cvData && cvData.education) && cvData.education.some(e => e.institution || e.degree) },
    { key: "skills", name: sectionNames.skills || "Skills", has: Boolean(cvData && cvData.skills && (cvData.skills.technical || cvData.skills.tools || cvData.skills.soft || cvData.skills.languages)) },
    { key: "projects", name: sectionNames.projects || "Projects", has: Array.isArray(cvData && cvData.projects) && cvData.projects.some(pr => pr.title || pr.description) },
    { key: "certifications", name: sectionNames.certifications || "Certifications", has: Array.isArray(cvData && cvData.certifications) && cvData.certifications.some(c => c.name) },
    { key: "organizations", name: sectionNames.organizations || "Organizations", has: Array.isArray(cvData && cvData.organizations) && cvData.organizations.some(o => o.name) }
  ];

  for (const sec of sectionCheckMap) {
    if (hiddenSet.has(sec.key) || !sec.has) {
      hiddenOrEmpty.push(sec.name);
    }
  }

  return {
    fileName,
    estimatedPages,
    issues,
    hiddenOrEmpty,
    isClean: issues.filter(i => i.severity === "high").length === 0
  };
}
