/**
 * Manajemen Penyimpanan Lokal (LocalStorage), Multi-Versi CV, & Ekspor/Impor Draft JSON.
 */

import { defaultEmptyCV } from "./data.js?v=0.2.0";

export const STORAGE_KEY = "indonesian_ats_cv_builder_draft_v1";
export const VERSIONS_KEY = "indonesian_ats_cv_builder_versions_v1";
export const ACTIVE_VERSION_KEY = "indonesian_ats_cv_builder_active_version_v1";
export const FULL_BACKUP_TYPE = "indonesian_ats_cv_builder_full_backup";

let lastStorageStatus = "ok"; // "ok" | "empty" | "corrupt" | "save_error"
let lastStorageError = "";
let lastSavedTimestamp = null;

export function getStorageStatus() {
  return lastStorageStatus;
}

export function getLastStorageError() {
  return lastStorageError;
}

export function getLastSavedTimestamp() {
  return lastSavedTimestamp;
}

let highestPublishedMs = 0;

function getHighestStorageMs() {
  let maxMs = 0;
  try {
    const rawVersions = localStorage.getItem(VERSIONS_KEY);
    if (rawVersions) {
      const parsed = JSON.parse(rawVersions);
      if (parsed && Array.isArray(parsed.items)) {
        for (const item of parsed.items) {
          if (item && typeof item.updatedAt === "string") {
            const ms = Date.parse(item.updatedAt);
            if (!Number.isNaN(ms) && ms > maxMs) maxMs = ms;
          }
        }
      }
    }
  } catch (_) {}
  try {
    const rawDraft = localStorage.getItem(STORAGE_KEY);
    if (rawDraft) {
      const parsed = JSON.parse(rawDraft);
      if (parsed && typeof parsed.savedAt === "string") {
        const ms = Date.parse(parsed.savedAt);
        if (!Number.isNaN(ms) && ms > maxMs) maxMs = ms;
      }
    }
  } catch (_) {}
  return maxMs;
}

function getNextMonotonicIso(referenceIso = null) {
  const refMs = referenceIso ? (Date.parse(referenceIso) || 0) : 0;
  const storageMs = getHighestStorageMs();
  const lastSavedMs = lastSavedTimestamp ? (Date.parse(lastSavedTimestamp) || 0) : 0;
  const nowMs = Date.now();

  const maxKnownMs = Math.max(highestPublishedMs, lastSavedMs, storageMs, refMs);
  const targetMs = nowMs > maxKnownMs ? nowMs : maxKnownMs + 1;

  highestPublishedMs = targetMs;
  const iso = new Date(targetMs).toISOString();
  lastSavedTimestamp = iso;
  return iso;
}

function getRollbackIso(attemptIso = null) {
  return getNextMonotonicIso(attemptIso);
}

function stampRollbackVersions(rawVersionsJson, rollbackIso) {
  if (!rawVersionsJson) return rawVersionsJson;
  try {
    const parsed = JSON.parse(rawVersionsJson);
    if (parsed && Array.isArray(parsed.items)) {
      parsed.items.forEach(item => {
        item.updatedAt = rollbackIso;
      });
      return JSON.stringify(parsed);
    }
  } catch (_) {}
  return rawVersionsJson;
}

function stampRollbackDraft(rawDraftJson, rollbackIso) {
  if (!rawDraftJson) return rawDraftJson;
  try {
    const parsed = JSON.parse(rawDraftJson);
    if (parsed && typeof parsed === "object") {
      parsed.savedAt = rollbackIso;
      return JSON.stringify(parsed);
    }
  } catch (_) {}
  return rawDraftJson;
}

/**
 * Menyimpan data CV ke LocalStorage browser.
 * Juga menyinkronkan ke daftar versi CV jika versi aktif/target tersedia.
 * @param {Object} data 
 * @param {string|null} targetVersionId
 * @returns {boolean}
 */
export function saveCVToStorage(data, targetVersionId = null) {
  const previousDraftRaw = localStorage.getItem(STORAGE_KEY);
  const previousVersionsRaw = localStorage.getItem(VERSIONS_KEY);
  const nowIso = getNextMonotonicIso();
  try {
    const activeVerId = getActiveVersionId();
    const verIdToSave = targetVersionId || activeVerId;

    // Sinkronkan juga ke daftar multi-versi lokal untuk ID versi tersebut
    const synced = syncActiveVersionData(data, nowIso, verIdToSave);
    if (!synced) {
      lastStorageStatus = "save_error";
      lastStorageError = `Versi target dengan ID '${verIdToSave}' tidak ditemukan di penyimpanan.`;
      return false;
    }

    // Draft utama (STORAGE_KEY) hanya diperbarui jika versi yang disimpan adalah versi aktif di LocalStorage
    if (verIdToSave === activeVerId) {
      const payload = {
        version: 2,
        versionId: verIdToSave,
        savedAt: nowIso,
        data: data
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }

    lastStorageStatus = "ok";
    lastStorageError = "";
    lastSavedTimestamp = nowIso;
    return true;
  } catch (error) {
    const rollbackIso = getRollbackIso(nowIso);
    // Rollback draft dan versions jika penyimpanan gagal agar integritas data tetap konsisten
    try {
      if (previousDraftRaw !== null) {
        localStorage.setItem(STORAGE_KEY, stampRollbackDraft(previousDraftRaw, rollbackIso));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {
      // rollback best effort
    }
    try {
      if (previousVersionsRaw !== null) {
        localStorage.setItem(VERSIONS_KEY, stampRollbackVersions(previousVersionsRaw, rollbackIso));
      } else {
        localStorage.removeItem(VERSIONS_KEY);
      }
    } catch (_) {
      // rollback best effort
    }
    lastSavedTimestamp = rollbackIso;
    lastStorageStatus = "save_error";
    lastStorageError = error && error.message ? error.message : "Kuota penyimpanan penuh atau akses diblokir.";
    console.error("Gagal menyimpan draft ke LocalStorage:", error);
    return false;
  }
}

/**
 * Memuat draft CV dari LocalStorage jika tersedia.
 * Mengembalikan data draft yang tersimpan, atau null jika tidak ada draft atau data rusak.
 * Catatan penting: Tidak menimpa data rusak saat membaca agar pengguna mendapat peringatan.
 * @returns {Object|null}
 */
export function loadCVFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || typeof raw !== "string" || !raw.trim()) {
      lastStorageStatus = "empty";
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      lastStorageStatus = "corrupt";
      lastStorageError = "Struktur data di penyimpanan lokal tidak valid.";
      return null;
    }

    lastStorageStatus = "ok";
    lastStorageError = "";

    // Format wrapper versi 1/2: { version: 1, savedAt: "...", data: { ... } }
    if (parsed.data && typeof parsed.data === "object") {
      return parsed.data;
    }

    // Dukungan format legacy (draft disimpan langsung tanpa wrapper payload)
    if (
      parsed.profile ||
      parsed.summary !== undefined ||
      parsed.experience ||
      parsed.education ||
      parsed.skills ||
      parsed.projects ||
      parsed.certifications ||
      parsed.organizations ||
      parsed.settings
    ) {
      return parsed;
    }

    // Jika objek valid tapi tanpa data eksplisit (misal draft kosong {})
    return parsed;
  } catch (error) {
    lastStorageStatus = "corrupt";
    lastStorageError = error && error.message ? error.message : "Format JSON di LocalStorage rusak.";
    console.warn("Gagal membaca draft dari LocalStorage (data rusak atau tidak valid):", error);
    return null;
  }
}

/**
 * Memeriksa secara menyeluruh apakah suatu objek CV memiliki konten nyata yang diisi oleh pengguna.
 * Memeriksa seluruh field: profil, ringkasan, riwayat kerja, pendidikan, keahlian, proyek, sertifikasi, organisasi.
 * @param {Object} data 
 * @returns {boolean}
 */
export function hasAnyCVContent(data) {
  if (!data || typeof data !== "object") return false;

  // 1. Profil & Kontak
  const p = data.profile;
  if (p && typeof p === "object") {
    if (
      Boolean(p.fullName && p.fullName.trim()) ||
      Boolean(p.jobTitle && p.jobTitle.trim()) ||
      Boolean(p.email && p.email.trim()) ||
      Boolean(p.phone && p.phone.trim()) ||
      Boolean(p.location && p.location.trim()) ||
      Boolean(p.linkedin && p.linkedin.trim()) ||
      Boolean(p.portfolio && p.portfolio.trim())
    ) {
      return true;
    }
  }

  // 2. Ringkasan Profesional
  if (typeof data.summary === "string" && data.summary.trim().length > 0) {
    return true;
  }

  // 3. Pengalaman Kerja
  if (Array.isArray(data.experience) && data.experience.length > 0) {
    const hasExpContent = data.experience.some(exp =>
      Boolean(exp && (
        (exp.role && exp.role.trim()) ||
        (exp.company && exp.company.trim()) ||
        (exp.location && exp.location.trim()) ||
        (exp.description && exp.description.trim()) ||
        (exp.startDate && exp.startDate.trim()) ||
        (exp.endDate && exp.endDate.trim())
      ))
    );
    if (hasExpContent) return true;
  }

  // 4. Pendidikan
  if (Array.isArray(data.education) && data.education.length > 0) {
    const hasEduContent = data.education.some(edu =>
      Boolean(edu && (
        (edu.institution && edu.institution.trim()) ||
        (edu.degree && edu.degree.trim()) ||
        (edu.field && edu.field.trim()) ||
        (edu.description && edu.description.trim()) ||
        (edu.gpa && edu.gpa.trim())
      ))
    );
    if (hasEduContent) return true;
  }

  // 5. Keahlian
  const s = data.skills;
  if (s && typeof s === "object") {
    if (
      Boolean(s.technical && s.technical.trim()) ||
      Boolean(s.tools && s.tools.trim()) ||
      Boolean(s.soft && s.soft.trim()) ||
      Boolean(s.languages && s.languages.trim())
    ) {
      return true;
    }
  }

  // 6. Proyek Portofolio
  if (Array.isArray(data.projects) && data.projects.length > 0) {
    const hasProjContent = data.projects.some(proj =>
      Boolean(proj && (
        (proj.title && proj.title.trim()) ||
        (proj.role && proj.role.trim()) ||
        (proj.description && proj.description.trim()) ||
        (proj.link && proj.link.trim())
      ))
    );
    if (hasProjContent) return true;
  }

  // 7. Sertifikasi
  if (Array.isArray(data.certifications) && data.certifications.length > 0) {
    const hasCertContent = data.certifications.some(cert =>
      Boolean(cert && (
        (cert.name && cert.name.trim()) ||
        (cert.issuer && cert.issuer.trim()) ||
        (cert.year && cert.year.trim()) ||
        (cert.credentialUrl && cert.credentialUrl.trim())
      ))
    );
    if (hasCertContent) return true;
  }

  // 8. Organisasi / Kegiatan Sukarela
  if (Array.isArray(data.organizations) && data.organizations.length > 0) {
    const hasOrgContent = data.organizations.some(org =>
      Boolean(org && (
        (org.name && org.name.trim()) ||
        (org.role && org.role.trim()) ||
        (org.description && org.description.trim()) ||
        (org.period && org.period.trim())
      ))
    );
    if (hasOrgContent) return true;
  }

  return false;
}

function sanitizeExperienceItem(item, idx) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const isCurrent = item.isCurrent !== undefined ? Boolean(item.isCurrent) : Boolean(item.current);
  return {
    id: typeof item.id === "string" && item.id ? item.id : `exp-${Date.now()}-${idx}`,
    role: typeof item.role === "string" ? item.role : "",
    company: typeof item.company === "string" ? item.company : "",
    location: typeof item.location === "string" ? item.location : "",
    startDate: typeof item.startDate === "string" ? item.startDate : "",
    endDate: typeof item.endDate === "string" ? item.endDate : "",
    isCurrent: isCurrent,
    description: typeof item.description === "string" ? item.description : "",
    highlights: Array.isArray(item.highlights)
      ? item.highlights.filter(h => typeof h === "string")
      : (typeof item.highlights === "string" && item.highlights ? [item.highlights] : [])
  };
}

function sanitizeEducationItem(item, idx) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const institution = typeof item.institution === "string" ? item.institution : (typeof item.school === "string" ? item.school : "");
  return {
    id: typeof item.id === "string" && item.id ? item.id : `edu-${Date.now()}-${idx}`,
    degree: typeof item.degree === "string" ? item.degree : "",
    field: typeof item.field === "string" ? item.field : "",
    institution: institution,
    location: typeof item.location === "string" ? item.location : "",
    startDate: typeof item.startDate === "string" ? item.startDate : "",
    endDate: typeof item.endDate === "string" ? item.endDate : "",
    gpa: typeof item.gpa === "string" ? item.gpa : "",
    description: typeof item.description === "string" ? item.description : ""
  };
}

function sanitizeProjectItem(item, idx) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const title = typeof item.title === "string" ? item.title : (typeof item.name === "string" ? item.name : "");
  const tech = typeof item.tech === "string" ? item.tech : (typeof item.technologies === "string" ? item.technologies : "");
  return {
    id: typeof item.id === "string" && item.id ? item.id : `proj-${Date.now()}-${idx}`,
    title: title,
    role: typeof item.role === "string" ? item.role : "",
    tech: tech,
    link: typeof item.link === "string" ? item.link : "",
    startDate: typeof item.startDate === "string" ? item.startDate : "",
    endDate: typeof item.endDate === "string" ? item.endDate : "",
    description: typeof item.description === "string" ? item.description : ""
  };
}

function sanitizeCertificationItem(item, idx) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const year = typeof item.year === "string" ? item.year : (typeof item.issueDate === "string" ? item.issueDate : "");
  const credentialUrl = typeof item.credentialUrl === "string" ? item.credentialUrl : (typeof item.url === "string" ? item.url : "");
  return {
    id: typeof item.id === "string" && item.id ? item.id : `cert-${Date.now()}-${idx}`,
    name: typeof item.name === "string" ? item.name : "",
    issuer: typeof item.issuer === "string" ? item.issuer : "",
    year: year,
    credentialUrl: credentialUrl
  };
}

function sanitizeOrganizationItem(item, idx) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  return {
    id: typeof item.id === "string" && item.id ? item.id : `org-${Date.now()}-${idx}`,
    name: typeof item.name === "string" ? item.name : "",
    role: typeof item.role === "string" ? item.role : "",
    period: typeof item.period === "string" ? item.period : "",
    description: typeof item.description === "string" ? item.description : ""
  };
}

/**
 * Menggabungkan draft yang dimuat (bisa berupa draft parsial atau versi lama)
 * dengan skema default secara aman agar semua properti dan array selalu ada dan valid.
 * @param {Object} saved 
 * @param {Object} defaults 
 * @returns {Object}
 */
export function mergeWithDefaults(saved, defaults) {
  if (!saved || typeof saved !== "object") {
    return JSON.parse(JSON.stringify(defaults));
  }

  const pSaved = saved.profile || {};
  const pDef = defaults.profile || {};

  const sSaved = saved.skills || {};
  const sDef = defaults.skills || {};

  const setSaved = saved.settings || {};
  const setDef = defaults.settings || {};

  const rawDocLang = typeof saved.documentLanguage === "string" ? saved.documentLanguage.trim().toLowerCase() : "";
  const documentLanguage = (rawDocLang === "en" || rawDocLang.startsWith("en-")) ? "en" : "id";

  const ALLOWED_SECTIONS = ["summary", "experience", "education", "skills", "projects", "certifications", "organizations"];
  const rawSectionOrder = Array.isArray(saved.sectionOrder) && saved.sectionOrder.length > 0
    ? saved.sectionOrder
    : (defaults.sectionOrder || ALLOWED_SECTIONS);
  const sectionOrder = rawSectionOrder.filter(s => typeof s === "string" && ALLOWED_SECTIONS.includes(s));
  ALLOWED_SECTIONS.forEach(sec => {
    if (!sectionOrder.includes(sec)) sectionOrder.push(sec);
  });

  const hiddenSections = Array.isArray(saved.hiddenSections)
    ? saved.hiddenSections.filter(s => typeof s === "string" && ALLOWED_SECTIONS.includes(s))
    : [];

  const rawExp = Array.isArray(saved.experience) ? saved.experience : [];
  const experience = rawExp.map(sanitizeExperienceItem).filter(Boolean);

  const rawEdu = Array.isArray(saved.education) ? saved.education : [];
  const education = rawEdu.map(sanitizeEducationItem).filter(Boolean);

  const rawProj = Array.isArray(saved.projects) ? saved.projects : [];
  const projects = rawProj.map(sanitizeProjectItem).filter(Boolean);

  const rawCert = Array.isArray(saved.certifications) ? saved.certifications : [];
  const certifications = rawCert.map(sanitizeCertificationItem).filter(Boolean);

  const rawOrg = Array.isArray(saved.organizations) ? saved.organizations : [];
  const organizations = rawOrg.map(sanitizeOrganizationItem).filter(Boolean);

  return {
    documentLanguage,
    careerTrack: saved.careerTrack === "freshgrad" ? "freshgrad" : (saved.careerTrack || defaults.careerTrack || "experienced"),
    profile: {
      fullName: typeof pSaved.fullName === "string" ? pSaved.fullName : (pDef.fullName || ""),
      jobTitle: typeof pSaved.jobTitle === "string" ? pSaved.jobTitle : (pDef.jobTitle || ""),
      email: typeof pSaved.email === "string" ? pSaved.email : (pDef.email || ""),
      phone: typeof pSaved.phone === "string" ? pSaved.phone : (pDef.phone || ""),
      location: typeof pSaved.location === "string" ? pSaved.location : (pDef.location || ""),
      linkedin: typeof pSaved.linkedin === "string" ? pSaved.linkedin : (pDef.linkedin || ""),
      portfolio: typeof pSaved.portfolio === "string" ? pSaved.portfolio : (pDef.portfolio || "")
    },
    summary: typeof saved.summary === "string" ? saved.summary : (defaults.summary || ""),
    sectionOrder,
    hiddenSections,
    experience,
    education,
    skills: {
      technical: typeof sSaved.technical === "string" ? sSaved.technical : (sDef.technical || ""),
      tools: typeof sSaved.tools === "string" ? sSaved.tools : (sDef.tools || ""),
      soft: typeof sSaved.soft === "string" ? sSaved.soft : (sDef.soft || ""),
      languages: typeof sSaved.languages === "string" ? sSaved.languages : (sDef.languages || "")
    },
    projects,
    certifications,
    organizations,
    jobDescriptionText: typeof saved.jobDescriptionText === "string" ? saved.jobDescriptionText : "",
    settings: {
      fontFamily: setSaved.fontFamily || setDef.fontFamily || "Calibri, Arial, sans-serif",
      fontSize: setSaved.fontSize || setDef.fontSize || "10.5pt",
      lineHeight: setSaved.lineHeight || setDef.lineHeight || "1.45",
      paperMargin: setSaved.paperMargin || setDef.paperMargin || "compact"
    }
  };
}

/**
 * Menghapus draft dari LocalStorage.
 */
export function clearCVStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    lastStorageStatus = "empty";
    lastStorageError = "";
    return true;
  } catch (error) {
    console.error("Gagal menghapus draft:", error);
    return false;
  }
}

/**
 * Mereset data versi CV aktif dan draft utama secara konsisten,
 * tanpa menghapus versi-versi lain yang ada di koleksi.
 * @param {Object} emptyData
 * @param {string|null} [targetVersionId]
 * @returns {boolean}
 */
export function resetActiveCVVersion(emptyData, targetVersionId = null) {
  const targetData = emptyData || defaultEmptyCV;
  const nowIso = getNextMonotonicIso();
  const activeId = getActiveVersionId();
  const verIdToReset = targetVersionId || activeId;

  const prevVersions = localStorage.getItem(VERSIONS_KEY);
  const prevDraft = localStorage.getItem(STORAGE_KEY);

  const rollback = () => {
    const rollbackIso = getRollbackIso(nowIso);
    try {
      if (prevVersions !== null) localStorage.setItem(VERSIONS_KEY, stampRollbackVersions(prevVersions, rollbackIso));
      else localStorage.removeItem(VERSIONS_KEY);
    } catch (_) {}
    try {
      if (prevDraft !== null) localStorage.setItem(STORAGE_KEY, stampRollbackDraft(prevDraft, rollbackIso));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    lastSavedTimestamp = rollbackIso;
  };

  try {
    if (prevVersions) {
      const parsed = JSON.parse(prevVersions);
      if (parsed && Array.isArray(parsed.items)) {
        const idx = parsed.items.findIndex(v => v.id === verIdToReset);
        if (idx !== -1) {
          parsed.items[idx].data = targetData;
          parsed.items[idx].updatedAt = nowIso;
          localStorage.setItem(VERSIONS_KEY, JSON.stringify(parsed));
        } else {
          lastStorageStatus = "save_error";
          lastStorageError = `Versi target dengan ID '${verIdToReset}' tidak ditemukan di penyimpanan.`;
          return false;
        }
      }
    }

    if (verIdToReset === activeId) {
      const payload = {
        version: 2,
        versionId: verIdToReset,
        savedAt: nowIso,
        data: targetData
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
    lastStorageStatus = "ok";
    lastStorageError = "";
    lastSavedTimestamp = nowIso;
    return true;
  } catch (error) {
    console.error("Gagal mereset versi di penyimpanan:", error);
    rollback();
    lastStorageStatus = "save_error";
    lastStorageError = error && error.message ? error.message : "Gagal mengosongkan versi aktif.";
    return false;
  }
}

// ==========================================================================
// Pengelolaan Multi-Versi CV Lokal (Dengan Migrasi Skema)
// ==========================================================================

function syncActiveVersionData(data, nowIso, targetVersionId = null) {
  let rawVersions = localStorage.getItem(VERSIONS_KEY);
  if (!rawVersions) {
    loadCVVersions(data);
    rawVersions = localStorage.getItem(VERSIONS_KEY);
  }
  if (!rawVersions) return false;
  const parsed = JSON.parse(rawVersions);
  if (!parsed || !Array.isArray(parsed.items)) return false;

  const activeId = targetVersionId || localStorage.getItem(ACTIVE_VERSION_KEY) || (parsed.items[0] && parsed.items[0].id);
  if (!activeId) return false;

  const idx = parsed.items.findIndex(v => v.id === activeId);
  if (idx !== -1) {
    parsed.items[idx].data = data;
    parsed.items[idx].updatedAt = nowIso;
    if (data && data.profile && data.profile.jobTitle && parsed.items[idx].name === "Draft Utama") {
      parsed.items[idx].name = `CV - ${data.profile.jobTitle.trim()}`;
    }
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(parsed));
    return true;
  }
  return false;
}

export function loadCVVersions(currentDataFallback = null) {
  try {
    const raw = localStorage.getItem(VERSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        // Pastikan setiap versi memiliki documentLanguage yang ternormalisasi ('id' atau 'en')
        parsed.items.forEach(item => {
          if (!item.data || typeof item.data !== "object") item.data = { documentLanguage: "id" };
          if (item.data.documentLanguage !== "en") item.data.documentLanguage = "id";
        });
        return parsed.items;
      }
    }

    // Migrasi otomatis dari draft tunggal jika belum ada daftar versi
    const baseData = currentDataFallback || loadCVFromStorage() || { documentLanguage: "id" };
    if (baseData.documentLanguage !== "en") baseData.documentLanguage = "id";

    const roleLabel = baseData.profile && baseData.profile.jobTitle
      ? `CV - ${baseData.profile.jobTitle.trim()}`
      : "Draft Utama";

    const defaultVersion = {
      id: "ver-default-1",
      name: roleLabel,
      updatedAt: new Date().toISOString(),
      data: baseData
    };

    const container = { schemaVersion: 2, items: [defaultVersion] };
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(container));
    localStorage.setItem(ACTIVE_VERSION_KEY, defaultVersion.id);
    return container.items;
  } catch (error) {
    return [];
  }
}

export function getActiveVersionId() {
  try {
    return localStorage.getItem(ACTIVE_VERSION_KEY) || "ver-default-1";
  } catch (e) {
    return "ver-default-1";
  }
}

export function setActiveVersionId(id) {
  const oldActiveId = localStorage.getItem(ACTIVE_VERSION_KEY);
  try {
    const items = loadCVVersions();
    const target = items.find(v => v.id === id);
    if (!target || !target.data) return null;

    localStorage.setItem(ACTIVE_VERSION_KEY, id);
    const saveOk = saveCVToStorage(target.data, id);
    if (!saveOk) {
      if (oldActiveId !== null) localStorage.setItem(ACTIVE_VERSION_KEY, oldActiveId);
      else localStorage.removeItem(ACTIVE_VERSION_KEY);
      return null;
    }
    return target.data;
  } catch (e) {
    if (oldActiveId !== null) localStorage.setItem(ACTIVE_VERSION_KEY, oldActiveId);
    else localStorage.removeItem(ACTIVE_VERSION_KEY);
    return null;
  }
}

export function createNewCVVersion(name, templateData, targetDocumentLanguage = null) {
  const nowIso = getNextMonotonicIso();
  const prevVersions = localStorage.getItem(VERSIONS_KEY);
  const prevActive = localStorage.getItem(ACTIVE_VERSION_KEY);
  const prevDraft = localStorage.getItem(STORAGE_KEY);

  const rollback = () => {
    const rollbackIso = getRollbackIso(nowIso);
    try {
      if (prevVersions !== null) localStorage.setItem(VERSIONS_KEY, stampRollbackVersions(prevVersions, rollbackIso));
      else localStorage.removeItem(VERSIONS_KEY);
    } catch (_) {}
    try {
      if (prevActive !== null) localStorage.setItem(ACTIVE_VERSION_KEY, prevActive);
      else localStorage.removeItem(ACTIVE_VERSION_KEY);
    } catch (_) {}
    try {
      if (prevDraft !== null) localStorage.setItem(STORAGE_KEY, stampRollbackDraft(prevDraft, rollbackIso));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    lastSavedTimestamp = rollbackIso;
  };

  try {
    const items = loadCVVersions();
    const newId = "ver-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const clonedData = JSON.parse(JSON.stringify(templateData || {}));
    if (targetDocumentLanguage === "en" || targetDocumentLanguage === "id") {
      clonedData.documentLanguage = targetDocumentLanguage;
    } else if (clonedData.documentLanguage !== "en") {
      clonedData.documentLanguage = "id";
    }
    const newEntry = {
      id: newId,
      name: (name && name.trim()) ? name.trim() : `Versi CV (${items.length + 1})`,
      updatedAt: nowIso,
      data: clonedData
    };
    items.unshift(newEntry);
    localStorage.setItem(VERSIONS_KEY, JSON.stringify({ schemaVersion: 2, items }));
    localStorage.setItem(ACTIVE_VERSION_KEY, newId);
    const saveOk = saveCVToStorage(clonedData, newId);
    if (!saveOk) {
      rollback();
      return null;
    }
    return newEntry;
  } catch (e) {
    console.error("Gagal membuat versi CV baru:", e);
    rollback();
    return null;
  }
}

export function renameCVVersion(id, newName) {
  try {
    const items = loadCVVersions();
    const target = items.find(v => v.id === id);
    if (!target || !newName || !newName.trim()) return false;
    const nowIso = getNextMonotonicIso();
    target.name = newName.trim();
    target.updatedAt = nowIso;
    localStorage.setItem(VERSIONS_KEY, JSON.stringify({ schemaVersion: 2, items }));
    lastSavedTimestamp = nowIso;
    return true;
  } catch (e) {
    return false;
  }
}

export function deleteCVVersion(id) {
  const nowIso = getNextMonotonicIso();
  const prevVersions = localStorage.getItem(VERSIONS_KEY);
  const prevActive = localStorage.getItem(ACTIVE_VERSION_KEY);
  const prevDraft = localStorage.getItem(STORAGE_KEY);

  const rollback = () => {
    const rollbackIso = getRollbackIso(nowIso);
    try {
      if (prevVersions !== null) localStorage.setItem(VERSIONS_KEY, stampRollbackVersions(prevVersions, rollbackIso));
      else localStorage.removeItem(VERSIONS_KEY);
    } catch (_) {}
    try {
      if (prevActive !== null) localStorage.setItem(ACTIVE_VERSION_KEY, prevActive);
      else localStorage.removeItem(ACTIVE_VERSION_KEY);
    } catch (_) {}
    try {
      if (prevDraft !== null) localStorage.setItem(STORAGE_KEY, stampRollbackDraft(prevDraft, rollbackIso));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    lastSavedTimestamp = rollbackIso;
  };

  try {
    let items = loadCVVersions();
    if (items.length <= 1) return false; // Pertahankan minimal 1 versi
    items = items.filter(v => v.id !== id);
    localStorage.setItem(VERSIONS_KEY, JSON.stringify({ schemaVersion: 2, items }));

    if (getActiveVersionId() === id && items.length > 0) {
      localStorage.setItem(ACTIVE_VERSION_KEY, items[0].id);
      const saveOk = saveCVToStorage(items[0].data, items[0].id);
      if (!saveOk) {
        rollback();
        return false;
      }
    }
    return true;
  } catch (e) {
    rollback();
    return false;
  }
}

/**
 * Mengunduh data CV tunggal yang sedang aktif dalam bentuk file JSON.
 * Menyertakan documentLanguage tetapi TIDAK menyertakan interfaceLanguage.
 * @param {Object} data 
 * @param {string} fileName 
 */
export function exportCVAsJSON(data, fileName = "draft_cv_ats.json") {
  const cleanPayload = JSON.parse(JSON.stringify(data || {}));
  cleanPayload.documentLanguage = cleanPayload.documentLanguage === "en" ? "en" : "id";
  delete cleanPayload.interfaceLanguage;

  const jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanPayload, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", jsonString);
  downloadAnchor.setAttribute("download", fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Mengunduh cadangan lengkap (seluruh versi CV, versi aktif, & draft) dalam satu berkas JSON.
 * Mendukung penyertaan state in-memory editor saat ada perubahan tertunda dan ID versi sumber.
 * @param {string|Object} fileNameOrState
 * @param {Object} [fallbackState]
 * @param {string|null} [sourceVersionId]
 * @returns {boolean}
 */
export function exportFullBackupJSON(fileNameOrState = "backup_ats_cv_builder_lengkap.json", fallbackState = null, sourceVersionId = null) {
  try {
    let fileName = "backup_ats_cv_builder_lengkap.json";
    let currentState = null;
    let targetVersionId = sourceVersionId;

    if (typeof fileNameOrState === "string") {
      fileName = fileNameOrState;
      currentState = fallbackState;
    } else if (fileNameOrState && typeof fileNameOrState === "object") {
      currentState = fileNameOrState;
      if (typeof fallbackState === "string") {
        targetVersionId = fallbackState;
      }
    }

    const versions = loadCVVersions();
    const activeVersionId = getActiveVersionId();
    const effectiveSourceId = targetVersionId || activeVersionId;
    const rawDraft = localStorage.getItem(STORAGE_KEY);
    let draftPayload = null;
    try {
      if (rawDraft) draftPayload = JSON.parse(rawDraft);
    } catch (_) {}

    // Jika currentState diberikan (misal dari state in-memory editor dengan perubahan yang belum ter-debounce),
    // pastikan versi yang sesuai di berkas backup mencerminkan currentState terkini.
    if (currentState && typeof currentState === "object") {
      const targetIdx = versions.findIndex(v => v.id === effectiveSourceId);
      if (targetIdx !== -1) {
        versions[targetIdx].data = JSON.parse(JSON.stringify(currentState));
        versions[targetIdx].updatedAt = new Date().toISOString();
      } else {
        // Versi sumber tidak lagi ada di koleksi (misal telah dihapus oleh tab lain).
        // Jangan menimpa versions[0] (record versi sehat yang masih ada).
        // Simpan state in-memory editor sebagai record orphan terpisah agar edit pengguna tetap terlindungi.
        const orphanRole = (currentState.profile && currentState.profile.jobTitle && currentState.profile.jobTitle.trim())
          ? currentState.profile.jobTitle.trim()
          : "Sesi Terpisah";
        versions.push({
          id: effectiveSourceId || `ver-recovered-${Date.now()}`,
          name: `CV Terpulihkan (${orphanRole})`,
          updatedAt: new Date().toISOString(),
          data: JSON.parse(JSON.stringify(currentState))
        });
      }

      // Draft payload di backup hanya disinkronkan ke currentState jika versi sumber adalah versi aktif global
      // atau belum ada draft payload sebelumnya di penyimpanan lokal.
      if (effectiveSourceId === activeVersionId || !draftPayload) {
        draftPayload = {
          version: 2,
          savedAt: new Date().toISOString(),
          activeVersionId,
          data: JSON.parse(JSON.stringify(currentState))
        };
      }
    }

    const backupData = {
      type: FULL_BACKUP_TYPE,
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      activeVersionId,
      versions,
      draft: draftPayload
    };

    const jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    return true;
  } catch (err) {
    console.error("Gagal mengekspor backup lengkap:", err);
    return false;
  }
}

/**
 * Memvalidasi struktur dan tipe data record CV secara mendalam.
 * Menolak record dengan tipe data rusak (misal profile berupa angka, section bukan array).
 * @param {Object} data
 */
export function validateCVStructure(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Data CV harus berupa object.");
  }

  // 1. profile
  if ("profile" in data) {
    if (!data.profile || typeof data.profile !== "object" || Array.isArray(data.profile)) {
      throw new Error("Field 'profile' harus berupa object.");
    }
    for (const [k, v] of Object.entries(data.profile)) {
      if (v !== null && v !== undefined && typeof v !== "string") {
        throw new Error(`Property 'profile.${k}' harus berupa string.`);
      }
    }
  }

  // 2. skills
  if ("skills" in data) {
    if (!data.skills || typeof data.skills !== "object" || Array.isArray(data.skills)) {
      throw new Error("Field 'skills' harus berupa object.");
    }
    for (const [k, v] of Object.entries(data.skills)) {
      if (v !== null && v !== undefined && typeof v !== "string") {
        throw new Error(`Property 'skills.${k}' harus berupa string.`);
      }
    }
  }

  // 3. settings
  if ("settings" in data) {
    if (!data.settings || typeof data.settings !== "object" || Array.isArray(data.settings)) {
      throw new Error("Field 'settings' harus berupa object.");
    }
    for (const [k, v] of Object.entries(data.settings)) {
      if (v !== null && v !== undefined && typeof v !== "string") {
        throw new Error(`Property 'settings.${k}' harus berupa string.`);
      }
    }
  }

  // 4. Repeatable array fields
  const ARRAY_FIELDS = [
    "experience", "education", "projects", "certifications",
    "organizations", "sectionOrder", "hiddenSections"
  ];
  for (const arrField of ARRAY_FIELDS) {
    if (arrField in data) {
      if (!Array.isArray(data[arrField])) {
        throw new Error(`Field '${arrField}' harus berupa array.`);
      }
    }
  }

  const REPEATABLE_ITEM_ARRAYS = [
    "experience", "education", "projects", "certifications", "organizations"
  ];
  for (const field of REPEATABLE_ITEM_ARRAYS) {
    if (Array.isArray(data[field])) {
      data[field].forEach((item, idx) => {
        if (item !== null && item !== undefined && (typeof item !== "object" || Array.isArray(item))) {
          throw new Error(`Item ke-${idx + 1} pada '${field}' harus berupa object.`);
        }
      });
    }
  }

  // 5. String fields
  const STRING_FIELDS = ["summary", "jobDescriptionText", "careerTrack", "documentLanguage"];
  for (const strField of STRING_FIELDS) {
    if (strField in data) {
      if (data[strField] !== null && data[strField] !== undefined && typeof data[strField] !== "string") {
        throw new Error(`Field '${strField}' harus berupa string.`);
      }
    }
  }

  // 6. Whitelist of recognized props
  const ALLOWED_CV_PROPS = [
    "profile", "experience", "education", "skills", "projects",
    "certifications", "organizations", "summary", "careerTrack",
    "documentLanguage", "settings", "sectionOrder", "hiddenSections",
    "jobDescriptionText"
  ];
  const keys = Object.keys(data);
  const hasRecognizedProp = keys.some(k => ALLOWED_CV_PROPS.includes(k));
  if (keys.length > 0 && !hasRecognizedProp) {
    throw new Error("Struktur data CV tidak memiliki properti yang dikenali.");
  }
}

/**
 * Memulihkan data cadangan lengkap ke LocalStorage.
 * Memvalidasi skema, memvalidasi tiap record CV, dan menjamin rollback atomik jika penulisan gagal.
 * @param {Object} backupObj
 * @returns {Object} Data versi aktif yang dipulihkan
 */
export function restoreFullBackup(backupObj) {
  if (!backupObj || typeof backupObj !== "object" || Array.isArray(backupObj)) {
    throw new Error("Data cadangan tidak valid.");
  }

  // Tolak skema versi masa depan yang tidak didukung (hanya versi 1 dan 2 yang didukung)
  if (backupObj.schemaVersion !== undefined) {
    if (typeof backupObj.schemaVersion !== "number" || backupObj.schemaVersion > 2 || backupObj.schemaVersion < 1) {
      throw new Error(`Versi skema cadangan tidak didukung (versi: ${backupObj.schemaVersion}).`);
    }
  }

  if (backupObj.type && typeof backupObj.type === "string" && backupObj.type !== FULL_BACKUP_TYPE) {
    throw new Error(`Tipe berkas cadangan tidak dikenali: ${backupObj.type}`);
  }

  const versions = Array.isArray(backupObj.versions)
    ? backupObj.versions
    : (Array.isArray(backupObj.items) ? backupObj.items : null);

  if (!versions || versions.length === 0) {
    throw new Error("Berkas cadangan tidak memiliki daftar versi CV yang valid.");
  }

  // Validasi ketat tiap record versi sebelum melakukan mutasi apa pun
  for (let i = 0; i < versions.length; i++) {
    const v = versions[i];
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      throw new Error(`Item versi ke-${i + 1} tidak valid.`);
    }
    const rawData = v.data || v;
    validateCVStructure(rawData);
  }

  // Sanitasi dan normalisasi tiap versi menggunakan mergeWithDefaults serta jamin ID unik
  const seenIds = new Set();
  const restoreTimestamp = getNextMonotonicIso();
  const sanitizedVersions = versions.map((v, i) => {
    const rawData = v.data || v;
    const validData = mergeWithDefaults(rawData, defaultEmptyCV);
    let id = typeof v.id === "string" && v.id.trim() ? v.id.trim() : `ver-restored-${Date.now()}-${i + 1}`;
    if (seenIds.has(id)) {
      id = `${id}-${i + 1}`;
    }
    seenIds.add(id);
    return {
      id,
      name: typeof v.name === "string" && v.name.trim() ? v.name.trim() : `Versi ${i + 1}`,
      updatedAt: restoreTimestamp,
      historicalUpdatedAt: typeof v.updatedAt === "string" ? v.updatedAt : restoreTimestamp,
      data: validData
    };
  });

  const activeId = (typeof backupObj.activeVersionId === "string" && sanitizedVersions.some(v => v.id === backupObj.activeVersionId))
    ? backupObj.activeVersionId
    : sanitizedVersions[0].id;

  const activeItem = sanitizedVersions.find(v => v.id === activeId) || sanitizedVersions[0];

  // Snapshot seluruh key sebelum melakukan penulisan untuk jaminan rollback atomik
  const snapshot = {
    draft: localStorage.getItem(STORAGE_KEY),
    versions: localStorage.getItem(VERSIONS_KEY),
    active: localStorage.getItem(ACTIVE_VERSION_KEY)
  };

  const rollback = () => {
    const rollbackIso = getRollbackIso(restoreTimestamp);
    try {
      if (snapshot.versions !== null) {
        localStorage.setItem(VERSIONS_KEY, stampRollbackVersions(snapshot.versions, rollbackIso));
      } else {
        localStorage.removeItem(VERSIONS_KEY);
      }
    } catch (_) {}
    try {
      if (snapshot.active !== null) localStorage.setItem(ACTIVE_VERSION_KEY, snapshot.active);
      else localStorage.removeItem(ACTIVE_VERSION_KEY);
    } catch (_) {}
    try {
      if (snapshot.draft !== null) {
        localStorage.setItem(STORAGE_KEY, stampRollbackDraft(snapshot.draft, rollbackIso));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
    lastSavedTimestamp = rollbackIso;
  };

  try {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify({ schemaVersion: 2, items: sanitizedVersions }));
    localStorage.setItem(ACTIVE_VERSION_KEY, activeId);
    const saveOk = saveCVToStorage(activeItem.data, activeId);
    if (!saveOk) {
      throw new Error("Gagal menyimpan draf aktif ke penyimpanan saat memulihkan cadangan.");
    }
    lastSavedTimestamp = getLastSavedTimestamp() || restoreTimestamp;
    return activeItem.data;
  } catch (err) {
    rollback();
    throw err;
  }
}

/**
 * Membaca data CV atau berkas cadangan lengkap dari file JSON yang diunggah pengguna.
 * @param {File} file 
 * @returns {Promise<Object>}
 */
export function importCVFromJSON(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Tidak ada berkas yang dipilih."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Berkas JSON tidak valid.");
        }

        // Cek jika ini adalah paket full backup
        if (
          parsed.type === FULL_BACKUP_TYPE ||
          (Array.isArray(parsed.versions) && parsed.versions.length > 0) ||
          (parsed.schemaVersion && Array.isArray(parsed.items))
        ) {
          resolve({ _isFullBackup: true, ...parsed });
          return;
        }

        // Tangani format CV tunggal (raw data atau objek wrapper)
        const cvData = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
        validateCVStructure(cvData);
        if (!cvData.profile && !cvData.experience && !cvData.education && !cvData.summary) {
          throw new Error("Format berkas JSON tidak sesuai struktur CV ATS.");
        }

        // Sanitasi mendalam sebelum diserahkan ke caller
        const sanitized = mergeWithDefaults(cvData, defaultEmptyCV);
        resolve(sanitized);
      } catch (err) {
        reject(new Error("Berkas JSON tidak valid atau rusak: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca berkas."));
    reader.readAsText(file);
  });
}
