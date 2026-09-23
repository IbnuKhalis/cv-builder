/**
 * Modul Lokalisasi (i18n) — Mendukung Bahasa Indonesia (id) dan English (en).
 * Memisahkan Bahasa Antarmuka (interfaceLanguage) dari Bahasa Dokumen CV (documentLanguage).
 */

import { localeId } from "./locales/id.js";
import { localeEn } from "./locales/en.js";

export const UI_PREFERENCES_KEY = "ats_cv_builder_ui_preferences_v1";
export const SUPPORTED_LANGUAGES = ["id", "en"];

const CATALOGS = {
  id: localeId,
  en: localeEn
};

let currentInterfaceLanguage = "id";
const languageChangeListeners = new Set();

/**
 * Normalisasi kode bahasa ke 'id' atau 'en'. Fallback aman selalu 'id'.
 */
export function normalizeLanguage(lang) {
  if (typeof lang !== "string") return "id";
  const clean = lang.trim().toLowerCase();
  if (clean === "en" || clean.startsWith("en-")) return "en";
  return "id";
}

/**
 * Inisialisasi bahasa antarmuka berdasarkan urutan prioritas:
 * 1. Preferensi tersimpan di localStorage (UI_PREFERENCES_KEY)
 * 2. Bahasa browser (navigator.language) jika diawali 'id' atau 'en'
 * 3. Fallback 'id'
 */
export function initInterfaceLanguage() {
  let resolved = "id";
  try {
    const rawPref = localStorage.getItem(UI_PREFERENCES_KEY);
    if (rawPref) {
      const parsed = JSON.parse(rawPref);
      if (parsed && (parsed.interfaceLanguage === "id" || parsed.interfaceLanguage === "en")) {
        resolved = parsed.interfaceLanguage;
        currentInterfaceLanguage = resolved;
        applyHtmlLangAttribute(resolved);
        return resolved;
      }
    }
  } catch {
    // Abaikan jika localStorage diblokir atau korup
  }

  if (typeof navigator !== "undefined" && navigator.language) {
    const navLang = navigator.language.toLowerCase();
    if (navLang.startsWith("en")) {
      resolved = "en";
    } else if (navLang.startsWith("id")) {
      resolved = "id";
    }
  }

  currentInterfaceLanguage = resolved;
  applyHtmlLangAttribute(resolved);
  return resolved;
}

export function getInterfaceLanguage() {
  return currentInterfaceLanguage;
}

export function setInterfaceLanguage(lang, { persist = true, notify = true } = {}) {
  const normalized = normalizeLanguage(lang);
  currentInterfaceLanguage = normalized;
  applyHtmlLangAttribute(normalized);

  if (persist) {
    try {
      localStorage.setItem(
        UI_PREFERENCES_KEY,
        JSON.stringify({ interfaceLanguage: normalized, updatedAt: new Date().toISOString() })
      );
    } catch {
      // Abaikan kegagalan penyimpanan preferensi UI
    }
  }

  if (notify) {
    languageChangeListeners.forEach(fn => {
      try {
        fn(normalized);
      } catch (err) {
        console.error("[i18n] Error pada listener perubahan bahasa:", err);
      }
    });
  }

  return normalized;
}

export function onInterfaceLanguageChange(callback) {
  if (typeof callback === "function") {
    languageChangeListeners.add(callback);
  }
  return () => languageChangeListeners.delete(callback);
}

function applyHtmlLangAttribute(lang) {
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.setAttribute("lang", lang);
  }
}

/**
 * Mengambil nilai bersarang dari objek berdasarkan dot-path key (contoh: 'wizard.step1').
 */
function resolveKeyPath(obj, keyPath) {
  if (!obj || typeof keyPath !== "string") return undefined;
  return keyPath.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

/**
 * Sanitasi parameter dinamis agar aman dari injeksi HTML.
 */
function escapeInterpolationParam(val) {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Fungsi terjemahan utama dengan fallback ke 'id' per key dan interpolasi aman.
 * @param {string} key - Key semantik (contoh: 'header.downloadPdf')
 * @param {Object} [params={}] - Nilai interpolasi (contoh: { current: 1, total: 5 })
 * @param {string|null} [langOverride=null] - Opsional memaksa locale tertentu ('id' | 'en')
 */
export function t(key, params = {}, langOverride = null) {
  const activeLang = langOverride ? normalizeLanguage(langOverride) : currentInterfaceLanguage;
  const primaryCatalog = CATALOGS[activeLang] || localeId;

  let template = resolveKeyPath(primaryCatalog, key);

  if (template === undefined) {
    if (activeLang !== "id") {
      template = resolveKeyPath(localeId, key);
    }
    if (template === undefined) {
      console.warn(`[i18n] Key lokalisasi tidak ditemukan: "${key}"`);
      return key;
    } else {
      console.warn(`[i18n] Key "${key}" hilang pada locale "${activeLang}", menggunakan fallback "id".`);
    }
  }

  if (typeof template !== "string") {
    return template;
  }

  if (!params || Object.keys(params).length === 0) {
    return template;
  }

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, paramKey) => {
    if (Object.prototype.hasOwnProperty.call(params, paramKey)) {
      return escapeInterpolationParam(params[paramKey]);
    }
    return `{${paramKey}}`;
  });
}

/**
 * Mengambil paket konten bahasa dokumen CV (headings, skillLabels, presentLabel, placeholders, actionVerbs, dll.)
 * @param {string} documentLanguage - 'id' | 'en'
 */
export function getDocumentCopy(documentLanguage) {
  const lang = normalizeLanguage(documentLanguage);
  const catalog = CATALOGS[lang] || localeId;
  return catalog.document || localeId.document;
}

/**
 * Memformat waktu simpan sesuai locale aktif menggunakan Intl.DateTimeFormat.
 */
export function formatSavedTime(date = new Date(), lang = currentInterfaceLanguage) {
  const localeTag = normalizeLanguage(lang) === "en" ? "en-US" : "id-ID";
  try {
    return new Intl.DateTimeFormat(localeTag, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  } catch {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
}

/**
 * Utilitas untuk memverifikasi kesetaraan seluruh key antara katalog 'id' dan 'en'.
 */
export function verifyCatalogKeyParity() {
  const collectKeys = (obj, prefix = "") => {
    let keys = [];
    for (const k of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      const val = obj[k];
      if (val && typeof val === "object" && !Array.isArray(val)) {
        keys = keys.concat(collectKeys(val, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  };

  const idKeys = new Set(collectKeys(localeId));
  const enKeys = new Set(collectKeys(localeEn));

  const missingInEn = [...idKeys].filter(k => !enKeys.has(k));
  const missingInId = [...enKeys].filter(k => !idKeys.has(k));

  return {
    isEqual: missingInEn.length === 0 && missingInId.length === 0,
    totalKeysId: idKeys.size,
    totalKeysEn: enKeys.size,
    missingInEn,
    missingInId
  };
}
