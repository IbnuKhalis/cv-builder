/**
 * Manajemen Penyimpanan Lokal (LocalStorage), Multi-Versi CV, & Ekspor/Impor Draft JSON.
 */

export const STORAGE_KEY = "indonesian_ats_cv_builder_draft_v1";
export const VERSIONS_KEY = "indonesian_ats_cv_builder_versions_v1";
export const ACTIVE_VERSION_KEY = "indonesian_ats_cv_builder_active_version_v1";

let lastStorageStatus = "ok"; // "ok" | "empty" | "corrupt" | "save_error"
let lastStorageError = "";

export function getStorageStatus() {
  return lastStorageStatus;
}

export function getLastStorageError() {
  return lastStorageError;
}

/**
 * Menyimpan data CV ke LocalStorage browser.
 * Juga menyinkronkan ke daftar versi CV jika versi aktif tersedia.
 * @param {Object} data 
 * @returns {boolean}
 */
export function saveCVToStorage(data) {
  try {
    const nowIso = new Date().toISOString();
    const payload = {
      version: 2,
      savedAt: nowIso,
      data: data
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    // Sinkronkan juga ke daftar multi-versi lokal
    syncActiveVersionData(data, nowIso);

    lastStorageStatus = "ok";
    lastStorageError = "";
    return true;
  } catch (error) {
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

/**
 * Menggabungkan draft yang dimuat (bisa berupa draft parsial atau versi lama)
 * dengan skema default secara aman agar semua properti dan array selalu ada.
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
    sectionOrder: Array.isArray(saved.sectionOrder) && saved.sectionOrder.length > 0
      ? [...saved.sectionOrder]
      : [...(defaults.sectionOrder || ["summary", "experience", "education", "skills", "projects", "certifications", "organizations"])],
    hiddenSections: Array.isArray(saved.hiddenSections) ? [...saved.hiddenSections] : [],
    experience: Array.isArray(saved.experience) ? saved.experience : [],
    education: Array.isArray(saved.education) ? saved.education : [],
    skills: {
      technical: typeof sSaved.technical === "string" ? sSaved.technical : (sDef.technical || ""),
      tools: typeof sSaved.tools === "string" ? sSaved.tools : (sDef.tools || ""),
      soft: typeof sSaved.soft === "string" ? sSaved.soft : (sDef.soft || ""),
      languages: typeof sSaved.languages === "string" ? sSaved.languages : (sDef.languages || "")
    },
    projects: Array.isArray(saved.projects) ? saved.projects : [],
    certifications: Array.isArray(saved.certifications) ? saved.certifications : [],
    organizations: Array.isArray(saved.organizations) ? saved.organizations : [],
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

// ==========================================================================
// Pengelolaan Multi-Versi CV Lokal (Dengan Migrasi Skema)
// ==========================================================================

function syncActiveVersionData(data, nowIso) {
  try {
    const rawVersions = localStorage.getItem(VERSIONS_KEY);
    if (!rawVersions) return;
    const parsed = JSON.parse(rawVersions);
    if (!parsed || !Array.isArray(parsed.items)) return;

    const activeId = localStorage.getItem(ACTIVE_VERSION_KEY) || (parsed.items[0] && parsed.items[0].id);
    if (!activeId) return;

    const idx = parsed.items.findIndex(v => v.id === activeId);
    if (idx !== -1) {
      parsed.items[idx].data = data;
      parsed.items[idx].updatedAt = nowIso;
      if (data && data.profile && data.profile.jobTitle && parsed.items[idx].name === "Draft Utama") {
        parsed.items[idx].name = `CV - ${data.profile.jobTitle.trim()}`;
      }
      localStorage.setItem(VERSIONS_KEY, JSON.stringify(parsed));
    }
  } catch (e) {
    // Abaikan jika gagal sinkronisasi multi-versi
  }
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
  try {
    const items = loadCVVersions();
    const target = items.find(v => v.id === id);
    localStorage.setItem(ACTIVE_VERSION_KEY, id);
    if (target && target.data) {
      saveCVToStorage(target.data);
      return target.data;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function createNewCVVersion(name, templateData, targetDocumentLanguage = null) {
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
      updatedAt: new Date().toISOString(),
      data: clonedData
    };
    items.unshift(newEntry);
    localStorage.setItem(VERSIONS_KEY, JSON.stringify({ schemaVersion: 2, items }));
    localStorage.setItem(ACTIVE_VERSION_KEY, newId);
    saveCVToStorage(clonedData);
    return newEntry;
  } catch (e) {
    console.error("Gagal membuat versi CV baru:", e);
    return null;
  }
}

export function renameCVVersion(id, newName) {
  try {
    const items = loadCVVersions();
    const target = items.find(v => v.id === id);
    if (!target || !newName || !newName.trim()) return false;
    target.name = newName.trim();
    target.updatedAt = new Date().toISOString();
    localStorage.setItem(VERSIONS_KEY, JSON.stringify({ schemaVersion: 2, items }));
    return true;
  } catch (e) {
    return false;
  }
}

export function deleteCVVersion(id) {
  try {
    let items = loadCVVersions();
    if (items.length <= 1) return false; // Pertahankan minimal 1 versi
    items = items.filter(v => v.id !== id);
    localStorage.setItem(VERSIONS_KEY, JSON.stringify({ schemaVersion: 2, items }));

    if (getActiveVersionId() === id && items.length > 0) {
      setActiveVersionId(items[0].id);
      saveCVToStorage(items[0].data);
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Mengunduh data CV dalam bentuk file JSON.
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
 * Membaca data CV dari file JSON yang diunggah pengguna.
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
        // Tangani jika format json adalah raw data atau objek wrapper
        const cvData = parsed.data ? parsed.data : parsed;
        if (!cvData || typeof cvData !== "object" || (!cvData.profile && !cvData.experience && !cvData.education)) {
          throw new Error("Format berkas JSON tidak sesuai struktur CV ATS.");
        }
        resolve(cvData);
      } catch (err) {
        reject(new Error("Berkas JSON tidak valid atau rusak: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca berkas."));
    reader.readAsText(file);
  });
}
