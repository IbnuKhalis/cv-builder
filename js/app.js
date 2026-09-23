/**
 * Antarmuka Utama & Logika Interaksi ATS CV Builder (Bilingual: Bahasa Indonesia & English).
 * Mendukung:
 * - Pemisahan Bahasa Aplikasi (interfaceLanguage) dan Bahasa Dokumen CV per versi (documentLanguage)
 * - Penyimpanan tangguh (deteksi storage rusak, fallback kuota penuh, multi-versi CV)
 * - Wizard 5 Langkah + Mode Semua Bagian
 * - Jalur Karir (Fresh Graduate vs Profesional Berpengalaman)
 * - Validasi Inline per Field & Indikator Kesiapan Dua Pilar (Kelengkapan vs Kualitas)
 * - Penyusun Poin Pencapaian Terstruktur (Achievement Bullet Builder)
 * - Pencocok Kata Kunci Deskripsi Lowongan per Bahasa (ID/EN)
 * - Pengatur Urutan & Visibilitas Bagian
 * - Diagnostik Pra-Ekspor PDF & Pratinjau A4 Dinamis
 */

import {
  defaultEmptyCV,
  getSampleDataset
} from "./data.js";
import {
  saveCVToStorage,
  loadCVFromStorage,
  clearCVStorage,
  exportCVAsJSON,
  importCVFromJSON,
  hasAnyCVContent,
  mergeWithDefaults,
  getStorageStatus,
  loadCVVersions,
  getActiveVersionId,
  setActiveVersionId,
  createNewCVVersion,
  renameCVVersion,
  deleteCVVersion
} from "./storage.js";
import {
  analyzeCVCompleteness,
  analyzeJobDescriptionMatch,
  runPreExportDiagnostics,
  buildPdfFileName,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  validateYearRange
} from "./ats-checker.js";
import {
  initInterfaceLanguage,
  getInterfaceLanguage,
  setInterfaceLanguage,
  normalizeLanguage,
  t,
  getDocumentCopy,
  formatSavedTime,
  verifyCatalogKeyParity
} from "./i18n.js";

// State global aplikasi
let cvState = null;
let saveDebounceTimer = null;
let currentWizardStep = 1;
let editorViewMode = "wizard"; // "wizard" | "all"
let lastFocusedElement = null;
let estimatedA4Pages = 1;
const touchedFields = new Set();

// Ekspos utilitas pengujian ke window untuk verifikasi otomatis
if (typeof window !== "undefined") {
  window.__atsI18n = {
    t,
    getInterfaceLanguage,
    setInterfaceLanguage,
    getDocumentCopy,
    verifyCatalogKeyParity
  };
}

// ==========================================================================
// Inisialisasi Aplikasi
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  // 1. Inisialisasi bahasa antarmuka (preferensi tersimpan -> browser -> fallback 'id')
  const initialUiLang = initInterfaceLanguage();

  // 2. Muat state CV dari localStorage (jangan gunakan bahasa browser untuk mengubah documentLanguage draft yang sudah ada)
  const savedData = loadCVFromStorage();
  const storageStatus = getStorageStatus();
  const hasStorageDraft = savedData !== null;

  if (storageStatus === "corrupt") {
    cvState = JSON.parse(JSON.stringify(defaultEmptyCV));
    showCorruptStorageAlert();
    showStarterBanner();
  } else if (hasStorageDraft) {
    cvState = mergeWithDefaults(savedData, defaultEmptyCV);
    const hasContent = hasAnyCVContent(cvState);
    if (hasContent) {
      hideStarterBanner();
    } else {
      showStarterBanner();
    }
  } else {
    cvState = JSON.parse(JSON.stringify(defaultEmptyCV));
    showStarterBanner();
  }

  // 3. Pasang semua event listener
  setupHeaderEvents();
  setupLanguageEvents();
  setupWizardAndCareerEvents();
  setupMobileTabs();
  setupPreviewToolbarEvents();
  setupModalEvents();
  setupStarterBannerEvents();
  setupCorruptAndErrorEvents();
  setupKeyboardAccessibility();

  // 4. Terapkan terjemahan UI & render formulir editor
  const uiLangSelect = document.getElementById("select-interface-language");
  if (uiLangSelect) uiLangSelect.value = initialUiLang;

  applyInterfaceTranslations();
  renderAllFormFields();
  updateWizardUI();
  updateActiveVersionPill();

  // 5. Sinkronisasi tampilan pratinjau live & kesiapan
  updateLivePreview();
  updateCompletenessWidget();
  updateJobDescriptionMatcherUI();

  if (storageStatus === "corrupt") {
    showToast(t("toasts.corruptLoaded"));
  } else if (hasStorageDraft) {
    showToast(t("toasts.draftRestored"));
  } else {
    showToast(t("toasts.welcomeNew"));
  }
}

// ==========================================================================
// Lokalisasi Antarmuka (interfaceLanguage) & Dokumen (documentLanguage)
// ==========================================================================
function announceToScreenReader(message) {
  const announcer = document.getElementById("a11y-live-announcer");
  if (!announcer) return;
  announcer.textContent = "";
  setTimeout(() => {
    announcer.textContent = message;
  }, 20);
}

function setupLanguageEvents() {
  // 1. Pemilih Bahasa Aplikasi (UI Language) di menu Lainnya / More
  const uiLangSelect = document.getElementById("select-interface-language");
  if (uiLangSelect) {
    uiLangSelect.addEventListener("change", (e) => {
      const nextLang = normalizeLanguage(e.target.value);
      switchInterfaceLanguage(nextLang);
    });
  }

  // 2. Pemilih Bahasa Dokumen CV (CV Language) di Langkah 5 & Toolbar Pratinjau
  const docLangSelect = document.getElementById("select-document-language");
  const previewDocLangSelect = document.getElementById("select-preview-doc-language");

  const handleDocLangChange = (rawVal) => {
    const nextDocLang = normalizeLanguage(rawVal);
    if (cvState.documentLanguage === nextDocLang) return;
    cvState.documentLanguage = nextDocLang;

    if (docLangSelect) docLangSelect.value = nextDocLang;
    if (previewDocLangSelect) previewDocLangSelect.value = nextDocLang;

    // Perbarui placeholder, form, dan pratinjau seketika tanpa menunggu debounce autosave
    applyDocumentPlaceholders();
    renderExperienceList();
    renderEducationList();
    renderProjectsList();
    renderCertificationsList();
    renderOrganizationsList();
    renderSettingsForm();
    updateLivePreview();
    updateCompletenessWidget();
    updateJobDescriptionMatcherUI();
    updateActiveVersionPill();

    // Sorot pratinjau untuk menunjukkan dampak perubahan bahasa CV
    const previewDoc = document.getElementById("cv-live-document");
    if (previewDoc) {
      previewDoc.setAttribute("lang", nextDocLang);
      previewDoc.classList.add("preview-lang-highlight");
      setTimeout(() => previewDoc.classList.remove("preview-lang-highlight"), 1200);
    }

    triggerAutoSave();

    const langName = nextDocLang === "en" ? "English (EN)" : "Bahasa Indonesia (ID)";
    const msg = t("toasts.docLangChanged", { lang: langName });
    showToast(msg);
    announceToScreenReader(msg);
  };

  if (docLangSelect) {
    docLangSelect.addEventListener("change", (e) => handleDocLangChange(e.target.value));
  }
  if (previewDocLangSelect) {
    previewDocLangSelect.addEventListener("change", (e) => handleDocLangChange(e.target.value));
  }
}

export function switchInterfaceLanguage(nextLang) {
  const editorPane = document.querySelector(".panel-editor");
  const savedScrollTop = editorPane ? editorPane.scrollTop : 0;
  const activeElId = document.activeElement && document.activeElement.id ? document.activeElement.id : null;

  const normalized = setInterfaceLanguage(nextLang);
  const uiLangSelect = document.getElementById("select-interface-language");
  if (uiLangSelect) uiLangSelect.value = normalized;

  applyInterfaceTranslations();
  renderAllFormFields();
  updateWizardUI();
  updateActiveVersionPill();
  updateLivePreview();
  updateCompletenessWidget();
  updateJobDescriptionMatcherUI();

  // Pertahankan posisi scroll dan fokus
  if (editorPane) editorPane.scrollTop = savedScrollTop;
  if (activeElId) {
    const el = document.getElementById(activeElId);
    if (el && typeof el.focus === "function") {
      try { el.focus(); } catch { /* ignore */ }
    }
  }

  const msg = t("toasts.uiLangChanged");
  showToast(msg);
  announceToScreenReader(msg);
}

function applyInterfaceTranslations() {
  document.title = t("meta.appTitle");

  // Terjemahkan semua elemen statis dengan [data-i18n]
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key) {
      const val = t(key);
      if (typeof val === "string") {
        el.textContent = val;
      }
    }
  });

  // Terjemahkan instruksi cetak terformat dengan [data-i18n-html] (hanya dari katalog internal tepercaya)
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    if (key) {
      const val = t(key);
      if (typeof val === "string") {
        el.innerHTML = val;
      }
    }
  });

  const expHelper = document.getElementById("exp-section-helper");
  if (expHelper) {
    expHelper.textContent = cvState && cvState.careerTrack === "freshgrad"
      ? t("sections.experienceHelperFresh")
      : t("sections.experienceHelperExp");
  }

  applyDocumentPlaceholders();
}

function applyDocumentPlaceholders() {
  const docLang = normalizeLanguage(cvState && cvState.documentLanguage);
  const ph = getDocumentCopy(docLang).placeholders || {};

  const mapIdToPlaceholder = {
    "prof-name": ph.fullName,
    "prof-title": ph.jobTitle,
    "prof-email": ph.email,
    "prof-phone": ph.phone,
    "prof-location": ph.location,
    "prof-linkedin": ph.linkedin,
    "prof-portfolio": ph.portfolio,
    "summary-textarea": ph.summary,
    "skills-technical": ph.skillsTech,
    "skills-tools": ph.skillsTools,
    "skills-soft": ph.skillsSoft,
    "skills-languages": ph.skillsLang,
    "jd-input-textarea": t("jdMatcher.placeholder"),
    "input-new-version-name": t("modals.newVersionPlaceholder")
  };

  Object.entries(mapIdToPlaceholder).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el && text) {
      el.setAttribute("placeholder", text);
    }
  });
}

// ==========================================================================
// Penanganan Storage Corrupt & Error Fallback
// ==========================================================================
function showCorruptStorageAlert() {
  const alertEl = document.getElementById("corrupt-storage-alert");
  if (alertEl) alertEl.style.display = "block";
}

function hideCorruptStorageAlert() {
  const alertEl = document.getElementById("corrupt-storage-alert");
  if (alertEl) alertEl.style.display = "none";
}

function setupCorruptAndErrorEvents() {
  const btnClearCorrupt = document.getElementById("btn-clear-corrupt-storage") || document.getElementById("btn-dismiss-corrupt-alert");
  if (btnClearCorrupt) {
    btnClearCorrupt.onclick = () => {
      clearCVStorage();
      saveCVToStorage(cvState);
      hideCorruptStorageAlert();
      showToast(t("toasts.storageResetSafe"));
    };
  }

  const btnBackupError = document.getElementById("btn-backup-on-error");
  if (btnBackupError) {
    btnBackupError.onclick = () => {
      const name = (cvState.profile && cvState.profile.fullName)
        ? cvState.profile.fullName.trim().replace(/\s+/g, "_")
        : "CV";
      exportCVAsJSON(cvState, `Backup_${name}_ATS.json`);
      showToast(t("toasts.backupDownloaded"));
    };
  }
}

// ==========================================================================
// Penanganan Header, Dropdown, & Versi CV
// ==========================================================================
function setupHeaderEvents() {
  const closeHeaderDropdown = () => {
    const dropdown = document.getElementById("header-more-dropdown");
    if (dropdown) dropdown.removeAttribute("open");
  };

  const btnSampleModal = document.getElementById("btn-open-sample-modal");
  if (btnSampleModal) {
    btnSampleModal.addEventListener("click", (e) => {
      closeHeaderDropdown();
      openModal("modal-sample-picker", e.currentTarget);
    });
  }

  const btnOpenVersions = document.getElementById("btn-open-versions-modal");
  const btnMenuVersions = document.getElementById("btn-open-versions-menu") || document.getElementById("btn-menu-versions");
  [btnOpenVersions, btnMenuVersions].forEach(btn => {
    if (btn) {
      btn.addEventListener("click", (e) => {
        closeHeaderDropdown();
        renderVersionsModalList();
        openModal("modal-versions-manager", e.currentTarget);
      });
    }
  });

  const btnReset = document.getElementById("btn-reset-cv");
  if (btnReset) {
    btnReset.addEventListener("click", (e) => {
      closeHeaderDropdown();
      openModal("modal-confirm-reset", e.currentTarget);
    });
  }

  const btnExport = document.getElementById("btn-export-json");
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      closeHeaderDropdown();
      const name = (cvState.profile && cvState.profile.fullName)
        ? cvState.profile.fullName.trim().replace(/\s+/g, "_")
        : "CV";
      exportCVAsJSON(cvState, `Draft_${name}_ATS.json`);
      showToast(t("toasts.jsonExported"));
    });
  }

  const fileInput = document.getElementById("input-import-json");
  const btnImportTrigger = document.getElementById("btn-import-json-trigger");
  if (btnImportTrigger && fileInput) {
    btnImportTrigger.addEventListener("click", () => {
      closeHeaderDropdown();
      fileInput.click();
    });
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const imported = await importCVFromJSON(file);
        cvState = mergeWithDefaults(imported, defaultEmptyCV);
        saveCVToStorage(cvState);
        hideCorruptStorageAlert();
        applyDocumentPlaceholders();
        renderAllFormFields();
        updateLivePreview();
        updateCompletenessWidget();
        updateJobDescriptionMatcherUI();
        showToast(t("toasts.jsonImported"));
      } catch (err) {
        alert("Error: " + err.message);
      } finally {
        fileInput.value = "";
      }
    });
  }

  const btnCopyText = document.getElementById("btn-copy-plain-text");
  if (btnCopyText) {
    btnCopyText.addEventListener("click", copyPlainTextATS);
  }

  const triggerPrintModal = (e) => {
    renderPreExportDiagnostics();
    openModal("modal-print-guide", e.currentTarget);
  };

  const btnPrintPDF = document.getElementById("btn-download-pdf");
  if (btnPrintPDF) btnPrintPDF.addEventListener("click", triggerPrintModal);

  const btnPreviewPrintPDF = document.getElementById("btn-preview-download-pdf");
  if (btnPreviewPrintPDF) btnPreviewPrintPDF.addEventListener("click", triggerPrintModal);

  const btnMobilePrintPDF = document.getElementById("btn-mobile-export-pdf");
  if (btnMobilePrintPDF) btnMobilePrintPDF.addEventListener("click", triggerPrintModal);

  const btnProceedPrint = document.getElementById("btn-proceed-print");
  if (btnProceedPrint) {
    btnProceedPrint.addEventListener("click", () => {
      closeModal("modal-print-guide");
      executePrintPDF();
    });
  }
}

// ==========================================================================
// Wizard 5 Langkah & Jalur Karir (Career Track)
// ==========================================================================
function setupWizardAndCareerEvents() {
  document.querySelectorAll("#wizard-steps-nav .wizard-step-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const step = Number(btn.dataset.step) || 1;
      editorViewMode = "wizard";
      setWizardStep(step);
    });
  });

  const btnPrev = document.getElementById("btn-wizard-prev");
  const btnNext = document.getElementById("btn-wizard-next");

  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      if (currentWizardStep > 1) {
        editorViewMode = "wizard";
        setWizardStep(currentWizardStep - 1);
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      validateStepFields(currentWizardStep);
      if (currentWizardStep < 5) {
        editorViewMode = "wizard";
        setWizardStep(currentWizardStep + 1);
      } else {
        renderPreExportDiagnostics();
        openModal("modal-print-guide", btnNext);
      }
    });
  }

  const btnToggleMode = document.getElementById("btn-toggle-editor-mode");
  if (btnToggleMode) {
    btnToggleMode.addEventListener("click", () => {
      editorViewMode = editorViewMode === "wizard" ? "all" : "wizard";
      updateWizardUI();
      showToast(editorViewMode === "all"
        ? t("toasts.modeAllActive")
        : t("toasts.modeWizardActive", { step: currentWizardStep }));
    });
  }

  const careerSelect = document.getElementById("select-career-track");
  if (careerSelect) {
    careerSelect.value = cvState.careerTrack || "experienced";
    careerSelect.addEventListener("change", (e) => {
      applyCareerTrack(e.target.value, true);
    });
  }
}

function applyCareerTrack(track, announce = false) {
  cvState.careerTrack = track === "freshgrad" ? "freshgrad" : "experienced";
  const careerSelect = document.getElementById("select-career-track");
  if (careerSelect) careerSelect.value = cvState.careerTrack;

  if (cvState.careerTrack === "freshgrad") {
    cvState.sectionOrder = ["summary", "education", "experience", "organizations", "projects", "skills", "certifications"];
  } else {
    cvState.sectionOrder = ["summary", "experience", "education", "skills", "projects", "certifications", "organizations"];
  }

  const expHelper = document.getElementById("exp-section-helper");
  if (expHelper) {
    expHelper.textContent = cvState.careerTrack === "freshgrad"
      ? t("sections.experienceHelperFresh")
      : t("sections.experienceHelperExp");
  }

  renderExperienceList();
  renderSettingsForm();
  triggerAutoSave();

  if (announce) {
    showToast(cvState.careerTrack === "freshgrad"
      ? t("toasts.trackFreshActive")
      : t("toasts.trackExpActive"));
  }
}

export function setWizardStep(step) {
  currentWizardStep = Math.max(1, Math.min(5, Number(step) || 1));
  updateWizardUI();
  const panelEditor = document.querySelector(".panel-editor");
  if (panelEditor) panelEditor.scrollTop = 0;
}

function updateWizardUI() {
  const sections = document.querySelectorAll(".form-section-box[data-wizard-step], .editor-section[data-wizard-step]");
  sections.forEach(sec => {
    const secStep = Number(sec.dataset.wizardStep);
    if (editorViewMode === "all" || secStep === currentWizardStep) {
      sec.classList.remove("wizard-step-hidden");
    } else {
      sec.classList.add("wizard-step-hidden");
    }
  });

  document.querySelectorAll("#wizard-steps-nav .wizard-step-btn").forEach(btn => {
    const s = Number(btn.dataset.step);
    const isActive = editorViewMode === "wizard" && s === currentWizardStep;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const prevBtn = document.getElementById("btn-wizard-prev");
  const nextBtn = document.getElementById("btn-wizard-next");
  const indicator = document.getElementById("wizard-step-indicator") || document.getElementById("wizard-step-counter");
  const footerNav = document.getElementById("wizard-footer-nav");

  if (footerNav) {
    footerNav.style.display = editorViewMode === "wizard" ? "flex" : "none";
  }
  if (prevBtn) {
    prevBtn.disabled = currentWizardStep <= 1;
    prevBtn.textContent = t("wizard.prevBtn");
  }
  if (nextBtn) {
    nextBtn.textContent = currentWizardStep >= 5 ? t("wizard.finishBtn") : t("wizard.nextBtn");
  }
  if (indicator) {
    indicator.textContent = t("wizard.stepIndicator", { current: currentWizardStep, total: 5 });
  }

  const btnToggleMode = document.getElementById("btn-toggle-editor-mode");
  if (btnToggleMode) {
    btnToggleMode.textContent = editorViewMode === "wizard"
      ? t("wizard.modeWizard")
      : t("wizard.modeAll");
  }
}

// ==========================================================================
// Tab Mobile & Toolbar Zoom Pratinjau
// ==========================================================================
function setupMobileTabs() {
  const tabEditor = document.getElementById("tab-mobile-editor");
  const tabPreview = document.getElementById("tab-mobile-preview");
  const btnMobileBackEdit = document.getElementById("btn-mobile-back-edit");

  const activateEditorTab = () => {
    document.body.classList.remove("show-preview-active");
    if (tabEditor) {
      tabEditor.classList.add("active");
      tabEditor.setAttribute("aria-selected", "true");
    }
    if (tabPreview) {
      tabPreview.classList.remove("active");
      tabPreview.setAttribute("aria-selected", "false");
    }
  };

  const activatePreviewTab = () => {
    document.body.classList.add("show-preview-active");
    if (tabPreview) {
      tabPreview.classList.add("active");
      tabPreview.setAttribute("aria-selected", "true");
    }
    if (tabEditor) {
      tabEditor.classList.remove("active");
      tabEditor.setAttribute("aria-selected", "false");
    }
    updateLivePreview();
  };

  if (tabEditor && tabPreview) {
    tabEditor.addEventListener("click", activateEditorTab);
    tabPreview.addEventListener("click", activatePreviewTab);
  }

  if (btnMobileBackEdit) {
    btnMobileBackEdit.addEventListener("click", activateEditorTab);
  }
}

function setupPreviewToolbarEvents() {
  const docEl = document.getElementById("cv-live-document");
  const zoomBtns = [
    { id: "btn-zoom-fit", cls: "zoom-fit" },
    { id: "btn-zoom-90", cls: "zoom-90" },
    { id: "btn-zoom-100", cls: "zoom-100" }
  ];

  zoomBtns.forEach(({ id, cls }) => {
    const btn = document.getElementById(id);
    if (btn && docEl) {
      btn.addEventListener("click", () => {
        docEl.classList.remove("zoom-fit", "zoom-90", "zoom-100");
        docEl.classList.add(cls);
        zoomBtns.forEach(b => {
          const el = document.getElementById(b.id);
          if (el) el.classList.toggle("active", b.id === id);
        });
      });
    }
  });
}

// ==========================================================================
// Validasi Inline Per Field & Navigasi Perbaikan
// ==========================================================================
function setFieldError(inputId, errorId, message) {
  const inputEl = document.getElementById(inputId);
  const errEl = document.getElementById(errorId);
  if (!inputEl || !errEl) return;

  if (message) {
    inputEl.classList.add("input-invalid");
    inputEl.setAttribute("aria-invalid", "true");
    errEl.textContent = message;
  } else {
    inputEl.classList.remove("input-invalid");
    inputEl.removeAttribute("aria-invalid");
    errEl.textContent = "";
  }
}

function validateProfileField(fieldId) {
  const p = cvState.profile || {};
  if (fieldId === "prof-name") {
    const msg = (!p.fullName || p.fullName.trim().length < 2) ? t("validation.nameRequired") : "";
    setFieldError("prof-name", "err-prof-name", msg);
    return !msg;
  }
  if (fieldId === "prof-title") {
    const msg = (!p.jobTitle || p.jobTitle.trim().length < 2) ? t("validation.titleRequired") : "";
    setFieldError("prof-title", "err-prof-title", msg);
    return !msg;
  }
  if (fieldId === "prof-email") {
    let msg = "";
    if (!p.email || !p.email.trim()) {
      msg = t("validation.emailRequired");
    } else if (!isValidEmail(p.email)) {
      msg = t("validation.emailInvalid");
    }
    setFieldError("prof-email", "err-prof-email", msg);
    return !msg;
  }
  if (fieldId === "prof-phone") {
    let msg = "";
    if (!p.phone || !p.phone.trim()) {
      msg = t("validation.phoneRequired");
    } else if (!isValidPhone(p.phone)) {
      msg = t("validation.phoneInvalid");
    }
    setFieldError("prof-phone", "err-prof-phone", msg);
    return !msg;
  }
  if (fieldId === "prof-location") {
    const msg = (!p.location || p.location.trim().length < 2) ? t("validation.locationRequired") : "";
    setFieldError("prof-location", "err-prof-location", msg);
    return !msg;
  }
  if (fieldId === "prof-linkedin") {
    const msg = (p.linkedin && p.linkedin.trim() && !isValidUrl(p.linkedin))
      ? t("validation.urlInvalid")
      : "";
    setFieldError("prof-linkedin", "err-prof-linkedin", msg);
    return !msg;
  }
  if (fieldId === "prof-portfolio") {
    const msg = (p.portfolio && p.portfolio.trim() && !isValidUrl(p.portfolio))
      ? t("validation.urlInvalid")
      : "";
    setFieldError("prof-portfolio", "err-prof-portfolio", msg);
    return !msg;
  }
  return true;
}

function validateStepFields(step) {
  if (step === 1) {
    ["prof-name", "prof-title", "prof-email", "prof-phone", "prof-location", "prof-linkedin", "prof-portfolio"].forEach(id => {
      touchedFields.add(id);
      validateProfileField(id);
    });
  }
}

export function jumpToFieldAndFocus(targetStep, targetSelector) {
  if (targetStep) {
    setWizardStep(Number(targetStep));
  }
  const tabEditor = document.getElementById("tab-mobile-editor");
  if (tabEditor && document.body.classList.contains("show-preview-active")) {
    tabEditor.click();
  }

  setTimeout(() => {
    if (!targetSelector) return;
    const el = document.querySelector(targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof el.focus === "function") {
        el.focus();
      }
    }
  }, 80);
}

// ==========================================================================
// Rendering Form Editor & Event Binding
// ==========================================================================
function renderAllFormFields() {
  const careerSelect = document.getElementById("select-career-track");
  if (careerSelect) {
    careerSelect.value = cvState.careerTrack || "experienced";
  }

  const docLang = normalizeLanguage(cvState && cvState.documentLanguage);
  const docLangSelect = document.getElementById("select-document-language");
  const previewDocLangSelect = document.getElementById("select-preview-doc-language");
  if (docLangSelect) docLangSelect.value = docLang;
  if (previewDocLangSelect) previewDocLangSelect.value = docLang;

  renderProfileForm();
  renderSummaryForm();
  renderExperienceList();
  renderEducationList();
  renderSkillsForm();
  renderProjectsList();
  renderCertificationsList();
  renderOrganizationsList();
  renderSettingsForm();
  renderJobDescriptionForm();

  // Perbarui ulang pesan validasi inline yang sudah pernah disentuh
  touchedFields.forEach(id => validateProfileField(id));
}

/**
 * 1. Form Profil & Kontak
 */
function renderProfileForm() {
  const p = cvState.profile || {};
  bindValidatedInput("prof-name", p.fullName, (val) => { cvState.profile.fullName = val; });
  bindValidatedInput("prof-title", p.jobTitle, (val) => { cvState.profile.jobTitle = val; });
  bindValidatedInput("prof-email", p.email, (val) => { cvState.profile.email = val; });
  bindValidatedInput("prof-phone", p.phone, (val) => { cvState.profile.phone = val; });
  bindValidatedInput("prof-location", p.location, (val) => { cvState.profile.location = val; });
  bindValidatedInput("prof-linkedin", p.linkedin, (val) => { cvState.profile.linkedin = val; });
  bindValidatedInput("prof-portfolio", p.portfolio, (val) => { cvState.profile.portfolio = val; });
}

function bindValidatedInput(id, initialVal, updateFn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = initialVal || "";
  el.oninput = (e) => {
    updateFn(e.target.value);
    if (touchedFields.has(id)) {
      validateProfileField(id);
    }
    triggerAutoSave();
  };
  el.onblur = () => {
    touchedFields.add(id);
    validateProfileField(id);
  };
}

/**
 * 2. Form Ringkasan Profesional
 */
function renderSummaryForm() {
  const summaryEl = document.getElementById("summary-textarea");
  const counterEl = document.getElementById("summary-word-count");

  if (summaryEl) {
    summaryEl.value = cvState.summary || "";
    const updateCount = () => {
      const words = summaryEl.value.trim() ? summaryEl.value.trim().split(/\s+/).filter(Boolean).length : 0;
      if (counterEl) {
        counterEl.textContent = t("fields.wordCountInfo", { count: words });
      }
    };
    updateCount();

    summaryEl.oninput = (e) => {
      cvState.summary = e.target.value;
      updateCount();
      triggerAutoSave();
    };
  }
}

/**
 * 3. Form Pengalaman Kerja (Repeatable + Achievement Bullet Builder)
 */
function renderExperienceList() {
  const container = document.getElementById("experience-repeatable-list");
  if (!container) return;
  container.innerHTML = "";

  const docLang = normalizeLanguage(cvState && cvState.documentLanguage);
  const docCopy = getDocumentCopy(docLang);
  const ph = docCopy.placeholders || {};
  const trackExamples = (docCopy.bulletExamples && docCopy.bulletExamples[cvState.careerTrack || "experienced"]) || [];

  const items = cvState.experience || [];

  if (items.length === 0) {
    container.innerHTML = `<div class="form-helper" style="padding: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center;">${escapeHTML(t("fields.emptyExperience"))}</div>`;
  } else {
    items.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "repeatable-card";
      const prefix = `exp-${index}`;
      const periodValidation = validateYearRange(item.startDate, item.endDate, item.isCurrent);

      card.innerHTML = `
        <div class="repeatable-card-header">
          <div class="repeatable-card-title">
            <strong>${escapeHTML(item.role || t("fields.expRole"))}</strong> - ${escapeHTML(item.company || t("fields.expCompany"))}
          </div>
          <div class="card-actions">
            <button type="button" class="btn btn-subtle btn-sm btn-move-up" title="${escapeAttr(t("fields.moveUp"))}" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="btn btn-subtle btn-sm btn-move-down" title="${escapeAttr(t("fields.moveDown"))}" ${index === items.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="btn btn-danger-subtle btn-sm btn-delete-item" title="${escapeAttr(t("fields.deleteBtn"))}">${escapeHTML(t("fields.deleteBtn"))}</button>
          </div>
        </div>
        <div class="repeatable-card-body">
          <div class="form-grid">
            <div class="form-group">
              <label for="${prefix}-role" class="form-label">${escapeHTML(t("fields.expRole"))} <span class="required">*</span></label>
              <input type="text" id="${prefix}-role" class="form-input exp-role" value="${escapeAttr(item.role || "")}" placeholder="${escapeAttr(ph.expRole || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-company" class="form-label">${escapeHTML(t("fields.expCompany"))} <span class="required">*</span></label>
              <input type="text" id="${prefix}-company" class="form-input exp-company" value="${escapeAttr(item.company || "")}" placeholder="${escapeAttr(ph.expCompany || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-location" class="form-label">${escapeHTML(t("fields.expLocation"))}</label>
              <input type="text" id="${prefix}-location" class="form-input exp-location" value="${escapeAttr(item.location || "")}" placeholder="${escapeAttr(ph.expLocation || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-start" class="form-label">${escapeHTML(t("fields.expPeriod"))}</label>
              <div class="period-row">
                <input type="text" id="${prefix}-start" class="form-input exp-start" value="${escapeAttr(item.startDate || "")}" placeholder="${escapeAttr(ph.expStart || "")}" />
                <span>-</span>
                <input type="text" id="${prefix}-end" class="form-input exp-end" value="${escapeAttr(item.endDate || "")}" placeholder="${escapeAttr(ph.expEnd || "")}" ${item.isCurrent ? "disabled" : ""} />
              </div>
              <span class="field-error exp-period-error" id="${prefix}-period-err" aria-live="polite">${periodValidation.valid ? "" : escapeHTML(periodValidation.message)}</span>
              <label class="checkbox-label" style="margin-top: 4px;">
                <input type="checkbox" id="${prefix}-current" class="exp-current" ${item.isCurrent ? "checked" : ""} /> ${escapeHTML(t("fields.expCurrent"))}
              </label>
            </div>
            <div class="form-group form-grid-full">
              <label for="${prefix}-desc" class="form-label">
                ${escapeHTML(t("fields.expDesc"))}
              </label>
              <span class="form-helper">${escapeHTML(t("fields.expDescHelper"))}</span>
              <textarea id="${prefix}-desc" class="form-textarea exp-desc" rows="4" placeholder="${escapeAttr(ph.expDesc || "")}">${escapeHTML(item.description || "")}</textarea>

              <!-- Penyusun Poin Pencapaian Terstruktur -->
              <div class="bullet-builder-box">
                <div class="bullet-builder-header">
                  <span><strong>${escapeHTML(t("bulletBuilder.title"))}</strong></span>
                  <button type="button" class="btn btn-subtle btn-sm btn-toggle-bullet-builder">${escapeHTML(t("bulletBuilder.openBtn"))}</button>
                </div>
                <div class="bullet-builder-body" style="display: none; margin-top: 8px;">
                  <div class="bullet-builder-grid">
                    <div class="form-group">
                      <label for="${prefix}-bb-action" class="form-label">${escapeHTML(t("bulletBuilder.actionLabel"))}</label>
                      <input type="text" id="${prefix}-bb-action" class="form-input bb-action" placeholder="${escapeAttr(ph.bbAction || "")}" />
                    </div>
                    <div class="form-group">
                      <label for="${prefix}-bb-method" class="form-label">${escapeHTML(t("bulletBuilder.methodLabel"))}</label>
                      <input type="text" id="${prefix}-bb-method" class="form-input bb-method" placeholder="${escapeAttr(ph.bbMethod || "")}" />
                    </div>
                    <div class="form-group">
                      <label for="${prefix}-bb-impact" class="form-label">${escapeHTML(t("bulletBuilder.impactLabel"))}</label>
                      <input type="text" id="${prefix}-bb-impact" class="form-input bb-impact" placeholder="${escapeAttr(ph.bbImpact || "")}" />
                    </div>
                  </div>
                  <div class="bullet-builder-actions">
                    <span class="form-helper">${escapeHTML(t("bulletBuilder.quickExamplePrefix"))} ${trackExamples[0] ? escapeHTML(trackExamples[0]) : ""}</span>
                    <button type="button" class="btn btn-secondary btn-sm btn-insert-bullet">${escapeHTML(t("bulletBuilder.insertBtn"))}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const roleInput = card.querySelector(".exp-role");
      const companyInput = card.querySelector(".exp-company");
      const locationInput = card.querySelector(".exp-location");
      const startInput = card.querySelector(".exp-start");
      const endInput = card.querySelector(".exp-end");
      const periodErrEl = card.querySelector(".exp-period-error");
      const currentCb = card.querySelector(".exp-current");
      const descInput = card.querySelector(".exp-desc");

      const checkPeriod = () => {
        const res = validateYearRange(item.startDate, item.endDate, item.isCurrent);
        if (periodErrEl) periodErrEl.textContent = res.valid ? "" : res.message;
      };

      roleInput.oninput = (e) => { item.role = e.target.value; triggerAutoSave(); };
      companyInput.oninput = (e) => { item.company = e.target.value; triggerAutoSave(); };
      locationInput.oninput = (e) => { item.location = e.target.value; triggerAutoSave(); };
      startInput.oninput = (e) => { item.startDate = e.target.value; checkPeriod(); triggerAutoSave(); };
      endInput.oninput = (e) => { item.endDate = e.target.value; checkPeriod(); triggerAutoSave(); };
      currentCb.onchange = (e) => {
        item.isCurrent = e.target.checked;
        const presentWord = docCopy.presentLabel || "Sekarang";
        if (item.isCurrent) {
          item.endDate = presentWord;
          endInput.value = presentWord;
          endInput.disabled = true;
        } else {
          endInput.disabled = false;
        }
        checkPeriod();
        triggerAutoSave();
      };
      descInput.oninput = (e) => { item.description = e.target.value; triggerAutoSave(); };

      const btnToggleBB = card.querySelector(".btn-toggle-bullet-builder");
      const bbBody = card.querySelector(".bullet-builder-body");
      if (btnToggleBB && bbBody) {
        btnToggleBB.onclick = () => {
          const isHidden = bbBody.style.display === "none";
          bbBody.style.display = isHidden ? "block" : "none";
          btnToggleBB.textContent = isHidden ? t("bulletBuilder.closeBtn") : t("bulletBuilder.openBtn");
        };
      }

      const btnInsertBullet = card.querySelector(".btn-insert-bullet");
      if (btnInsertBullet) {
        btnInsertBullet.onclick = () => {
          const act = card.querySelector(".bb-action").value.trim();
          const met = card.querySelector(".bb-method").value.trim();
          const imp = card.querySelector(".bb-impact").value.trim();
          if (!act && !met && !imp) {
            showToast(t("bulletBuilder.emptyWarning"));
            return;
          }
          const parts = [act, met, imp].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
          const bulletLine = `• ${parts.endsWith(".") ? parts : parts + "."}`;
          item.description = item.description && item.description.trim()
            ? `${item.description.trim()}\n${bulletLine}`
            : bulletLine;
          descInput.value = item.description;
          card.querySelector(".bb-action").value = "";
          card.querySelector(".bb-method").value = "";
          card.querySelector(".bb-impact").value = "";
          triggerAutoSave();
          showToast(t("bulletBuilder.addedToast"));
        };
      }

      card.querySelector(".btn-move-up").onclick = () => moveItem(items, index, -1, renderExperienceList);
      card.querySelector(".btn-move-down").onclick = () => moveItem(items, index, 1, renderExperienceList);
      card.querySelector(".btn-delete-item").onclick = () => {
        items.splice(index, 1);
        renderExperienceList();
        triggerAutoSave();
      };

      container.appendChild(card);
    });
  }

  const btnAdd = document.getElementById("btn-add-experience");
  if (btnAdd) {
    btnAdd.onclick = () => {
      if (!cvState.experience) cvState.experience = [];
      cvState.experience.push({
        id: "exp-" + Date.now(),
        role: "",
        company: "",
        location: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
        description: ""
      });
      renderExperienceList();
      triggerAutoSave();
    };
  }
}

/**
 * 4. Form Pendidikan (Repeatable)
 */
function renderEducationList() {
  const container = document.getElementById("education-repeatable-list");
  if (!container) return;
  container.innerHTML = "";

  const docLang = normalizeLanguage(cvState && cvState.documentLanguage);
  const ph = getDocumentCopy(docLang).placeholders || {};
  const items = cvState.education || [];

  if (items.length === 0) {
    container.innerHTML = `<div class="form-helper" style="padding: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center;">${escapeHTML(t("fields.emptyEducation"))}</div>`;
  } else {
    items.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "repeatable-card";
      const prefix = `edu-${index}`;
      const periodValidation = validateYearRange(item.startDate, item.endDate, false);

      card.innerHTML = `
        <div class="repeatable-card-header">
          <div class="repeatable-card-title">
            <strong>${escapeHTML(item.degree || t("fields.eduDegree"))}</strong> ${item.field ? `- ${escapeHTML(item.field)}` : ""} (${escapeHTML(item.institution || t("fields.eduInst"))})
          </div>
          <div class="card-actions">
            <button type="button" class="btn btn-subtle btn-sm btn-move-up" title="${escapeAttr(t("fields.moveUp"))}" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="btn btn-subtle btn-sm btn-move-down" title="${escapeAttr(t("fields.moveDown"))}" ${index === items.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="btn btn-danger-subtle btn-sm btn-delete-item" title="${escapeAttr(t("fields.deleteBtn"))}">${escapeHTML(t("fields.deleteBtn"))}</button>
          </div>
        </div>
        <div class="repeatable-card-body">
          <div class="form-grid">
            <div class="form-group">
              <label for="${prefix}-inst" class="form-label">${escapeHTML(t("fields.eduInst"))} <span class="required">*</span></label>
              <input type="text" id="${prefix}-inst" class="form-input edu-inst" value="${escapeAttr(item.institution || "")}" placeholder="${escapeAttr(ph.eduInst || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-degree" class="form-label">${escapeHTML(t("fields.eduDegree"))} <span class="required">*</span></label>
              <input type="text" id="${prefix}-degree" class="form-input edu-degree" value="${escapeAttr(item.degree || "")}" placeholder="${escapeAttr(ph.eduDegree || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-field" class="form-label">${escapeHTML(t("fields.eduField"))}</label>
              <input type="text" id="${prefix}-field" class="form-input edu-field" value="${escapeAttr(item.field || "")}" placeholder="${escapeAttr(ph.eduField || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-loc" class="form-label">${escapeHTML(t("fields.eduLoc"))}</label>
              <input type="text" id="${prefix}-loc" class="form-input edu-loc" value="${escapeAttr(item.location || "")}" placeholder="${escapeAttr(ph.eduLoc || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-start" class="form-label">${escapeHTML(t("fields.eduPeriod"))}</label>
              <div class="period-row">
                <input type="text" id="${prefix}-start" class="form-input edu-start" value="${escapeAttr(item.startDate || "")}" placeholder="${escapeAttr(ph.eduStart || "")}" />
                <span>-</span>
                <input type="text" id="${prefix}-end" class="form-input edu-end" value="${escapeAttr(item.endDate || "")}" placeholder="${escapeAttr(ph.eduEnd || "")}" />
              </div>
              <span class="field-error edu-period-error" id="${prefix}-period-err" aria-live="polite">${periodValidation.valid ? "" : escapeHTML(periodValidation.message)}</span>
            </div>
            <div class="form-group">
              <label for="${prefix}-gpa" class="form-label">${escapeHTML(t("fields.eduGpa"))}</label>
              <input type="text" id="${prefix}-gpa" class="form-input edu-gpa" value="${escapeAttr(item.gpa || "")}" placeholder="${escapeAttr(ph.eduGpa || "")}" />
            </div>
            <div class="form-group form-grid-full">
              <label for="${prefix}-desc" class="form-label">${escapeHTML(t("fields.eduDesc"))}</label>
              <textarea id="${prefix}-desc" class="form-textarea edu-desc" rows="2" placeholder="${escapeAttr(ph.eduDesc || "")}">${escapeHTML(item.description || "")}</textarea>
            </div>
          </div>
        </div>
      `;

      const instInput = card.querySelector(".edu-inst");
      const degreeInput = card.querySelector(".edu-degree");
      const fieldInput = card.querySelector(".edu-field");
      const locInput = card.querySelector(".edu-loc");
      const startInput = card.querySelector(".edu-start");
      const endInput = card.querySelector(".edu-end");
      const periodErrEl = card.querySelector(".edu-period-error");
      const gpaInput = card.querySelector(".edu-gpa");
      const descInput = card.querySelector(".edu-desc");

      const checkPeriod = () => {
        const res = validateYearRange(item.startDate, item.endDate, false);
        if (periodErrEl) periodErrEl.textContent = res.valid ? "" : res.message;
      };

      instInput.oninput = (e) => { item.institution = e.target.value; triggerAutoSave(); };
      degreeInput.oninput = (e) => { item.degree = e.target.value; triggerAutoSave(); };
      fieldInput.oninput = (e) => { item.field = e.target.value; triggerAutoSave(); };
      locInput.oninput = (e) => { item.location = e.target.value; triggerAutoSave(); };
      startInput.oninput = (e) => { item.startDate = e.target.value; checkPeriod(); triggerAutoSave(); };
      endInput.oninput = (e) => { item.endDate = e.target.value; checkPeriod(); triggerAutoSave(); };
      gpaInput.oninput = (e) => { item.gpa = e.target.value; triggerAutoSave(); };
      descInput.oninput = (e) => { item.description = e.target.value; triggerAutoSave(); };

      card.querySelector(".btn-move-up").onclick = () => moveItem(items, index, -1, renderEducationList);
      card.querySelector(".btn-move-down").onclick = () => moveItem(items, index, 1, renderEducationList);
      card.querySelector(".btn-delete-item").onclick = () => {
        items.splice(index, 1);
        renderEducationList();
        triggerAutoSave();
      };

      container.appendChild(card);
    });
  }

  const btnAdd = document.getElementById("btn-add-education");
  if (btnAdd) {
    btnAdd.onclick = () => {
      if (!cvState.education) cvState.education = [];
      cvState.education.push({
        id: "edu-" + Date.now(),
        degree: "",
        field: "",
        institution: "",
        location: "",
        startDate: "",
        endDate: "",
        gpa: "",
        description: ""
      });
      renderEducationList();
      triggerAutoSave();
    };
  }
}

/**
 * 5. Form Keahlian (Skills)
 */
function renderSkillsForm() {
  if (!cvState.skills) cvState.skills = {};
  const s = cvState.skills;
  bindInput("skills-technical", s.technical, (val) => { cvState.skills.technical = val; });
  bindInput("skills-tools", s.tools, (val) => { cvState.skills.tools = val; });
  bindInput("skills-soft", s.soft, (val) => { cvState.skills.soft = val; });
  bindInput("skills-languages", s.languages, (val) => { cvState.skills.languages = val; });
}

/**
 * 6. Form Proyek Opsional (Repeatable)
 */
function renderProjectsList() {
  const container = document.getElementById("projects-repeatable-list");
  if (!container) return;
  container.innerHTML = "";

  const docLang = normalizeLanguage(cvState && cvState.documentLanguage);
  const ph = getDocumentCopy(docLang).placeholders || {};
  const items = cvState.projects || [];

  if (items.length === 0) {
    container.innerHTML = `<div class="form-helper" style="padding: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center;">${escapeHTML(t("fields.emptyProjects"))}</div>`;
  } else {
    items.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "repeatable-card";
      const prefix = `proj-${index}`;
      card.innerHTML = `
        <div class="repeatable-card-header">
          <div class="repeatable-card-title">
            <strong>${escapeHTML(item.title || t("fields.projTitle"))}</strong> ${item.role ? `(${escapeHTML(item.role)})` : ""}
          </div>
          <div class="card-actions">
            <button type="button" class="btn btn-subtle btn-sm btn-move-up" title="${escapeAttr(t("fields.moveUp"))}" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="btn btn-subtle btn-sm btn-move-down" title="${escapeAttr(t("fields.moveDown"))}" ${index === items.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="btn btn-danger-subtle btn-sm btn-delete-item" title="${escapeAttr(t("fields.deleteBtn"))}">${escapeHTML(t("fields.deleteBtn"))}</button>
          </div>
        </div>
        <div class="repeatable-card-body">
          <div class="form-grid">
            <div class="form-group">
              <label for="${prefix}-title" class="form-label">${escapeHTML(t("fields.projTitle"))} <span class="required">*</span></label>
              <input type="text" id="${prefix}-title" class="form-input proj-title" value="${escapeAttr(item.title || "")}" placeholder="${escapeAttr(ph.projTitle || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-role" class="form-label">${escapeHTML(t("fields.projRole"))}</label>
              <input type="text" id="${prefix}-role" class="form-input proj-role" value="${escapeAttr(item.role || "")}" placeholder="${escapeAttr(ph.projRole || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-tech" class="form-label">${escapeHTML(t("fields.projTech"))}</label>
              <input type="text" id="${prefix}-tech" class="form-input proj-tech" value="${escapeAttr(item.tech || "")}" placeholder="${escapeAttr(ph.projTech || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-link" class="form-label">${escapeHTML(t("fields.projLink"))}</label>
              <input type="text" id="${prefix}-link" class="form-input proj-link" value="${escapeAttr(item.link || "")}" placeholder="${escapeAttr(ph.projLink || "")}" />
            </div>
            <div class="form-group form-grid-full">
              <label for="${prefix}-desc" class="form-label">${escapeHTML(t("fields.projDesc"))}</label>
              <textarea id="${prefix}-desc" class="form-textarea proj-desc" rows="3" placeholder="${escapeAttr(ph.projDesc || "")}">${escapeHTML(item.description || "")}</textarea>
            </div>
          </div>
        </div>
      `;

      card.querySelector(".proj-title").oninput = (e) => { item.title = e.target.value; triggerAutoSave(); };
      card.querySelector(".proj-role").oninput = (e) => { item.role = e.target.value; triggerAutoSave(); };
      card.querySelector(".proj-tech").oninput = (e) => { item.tech = e.target.value; triggerAutoSave(); };
      card.querySelector(".proj-link").oninput = (e) => { item.link = e.target.value; triggerAutoSave(); };
      card.querySelector(".proj-desc").oninput = (e) => { item.description = e.target.value; triggerAutoSave(); };

      card.querySelector(".btn-move-up").onclick = () => moveItem(items, index, -1, renderProjectsList);
      card.querySelector(".btn-move-down").onclick = () => moveItem(items, index, 1, renderProjectsList);
      card.querySelector(".btn-delete-item").onclick = () => {
        items.splice(index, 1);
        renderProjectsList();
        triggerAutoSave();
      };

      container.appendChild(card);
    });
  }

  const btnAdd = document.getElementById("btn-add-project");
  if (btnAdd) {
    btnAdd.onclick = () => {
      if (!cvState.projects) cvState.projects = [];
      cvState.projects.push({
        id: "proj-" + Date.now(),
        title: "",
        role: "",
        tech: "",
        link: "",
        description: ""
      });
      renderProjectsList();
      triggerAutoSave();
    };
  }
}

/**
 * 7. Form Sertifikasi Opsional (Repeatable)
 */
function renderCertificationsList() {
  const container = document.getElementById("certifications-repeatable-list");
  if (!container) return;
  container.innerHTML = "";

  const docLang = normalizeLanguage(cvState && cvState.documentLanguage);
  const ph = getDocumentCopy(docLang).placeholders || {};
  const items = cvState.certifications || [];

  if (items.length === 0) {
    container.innerHTML = `<div class="form-helper" style="padding: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center;">${escapeHTML(t("fields.emptyCertifications"))}</div>`;
  } else {
    items.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "repeatable-card";
      const prefix = `cert-${index}`;
      card.innerHTML = `
        <div class="repeatable-card-header">
          <div class="repeatable-card-title">
            <strong>${escapeHTML(item.name || t("fields.certName"))}</strong> (${escapeHTML(item.issuer || t("fields.certIssuer"))})
          </div>
          <div class="card-actions">
            <button type="button" class="btn btn-subtle btn-sm btn-move-up" title="${escapeAttr(t("fields.moveUp"))}" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="btn btn-subtle btn-sm btn-move-down" title="${escapeAttr(t("fields.moveDown"))}" ${index === items.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="btn btn-danger-subtle btn-sm btn-delete-item" title="${escapeAttr(t("fields.deleteBtn"))}">${escapeHTML(t("fields.deleteBtn"))}</button>
          </div>
        </div>
        <div class="repeatable-card-body">
          <div class="form-grid">
            <div class="form-group">
              <label for="${prefix}-name" class="form-label">${escapeHTML(t("fields.certName"))} <span class="required">*</span></label>
              <input type="text" id="${prefix}-name" class="form-input cert-name" value="${escapeAttr(item.name || "")}" placeholder="${escapeAttr(ph.certName || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-issuer" class="form-label">${escapeHTML(t("fields.certIssuer"))} <span class="required">*</span></label>
              <input type="text" id="${prefix}-issuer" class="form-input cert-issuer" value="${escapeAttr(item.issuer || "")}" placeholder="${escapeAttr(ph.certIssuer || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-year" class="form-label">${escapeHTML(t("fields.certYear"))}</label>
              <input type="text" id="${prefix}-year" class="form-input cert-year" value="${escapeAttr(item.year || "")}" placeholder="${escapeAttr(ph.certYear || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-url" class="form-label">${escapeHTML(t("fields.certUrl"))}</label>
              <input type="text" id="${prefix}-url" class="form-input cert-url" value="${escapeAttr(item.credentialUrl || "")}" placeholder="${escapeAttr(ph.certUrl || "")}" />
            </div>
          </div>
        </div>
      `;

      card.querySelector(".cert-name").oninput = (e) => { item.name = e.target.value; triggerAutoSave(); };
      card.querySelector(".cert-issuer").oninput = (e) => { item.issuer = e.target.value; triggerAutoSave(); };
      card.querySelector(".cert-year").oninput = (e) => { item.year = e.target.value; triggerAutoSave(); };
      card.querySelector(".cert-url").oninput = (e) => { item.credentialUrl = e.target.value; triggerAutoSave(); };

      card.querySelector(".btn-move-up").onclick = () => moveItem(items, index, -1, renderCertificationsList);
      card.querySelector(".btn-move-down").onclick = () => moveItem(items, index, 1, renderCertificationsList);
      card.querySelector(".btn-delete-item").onclick = () => {
        items.splice(index, 1);
        renderCertificationsList();
        triggerAutoSave();
      };

      container.appendChild(card);
    });
  }

  const btnAdd = document.getElementById("btn-add-certification");
  if (btnAdd) {
    btnAdd.onclick = () => {
      if (!cvState.certifications) cvState.certifications = [];
      cvState.certifications.push({
        id: "cert-" + Date.now(),
        name: "",
        issuer: "",
        year: "",
        credentialUrl: ""
      });
      renderCertificationsList();
      triggerAutoSave();
    };
  }
}

/**
 * 8. Form Organisasi Opsional (Repeatable)
 */
function renderOrganizationsList() {
  const container = document.getElementById("organizations-repeatable-list");
  if (!container) return;
  container.innerHTML = "";

  const docLang = normalizeLanguage(cvState && cvState.documentLanguage);
  const ph = getDocumentCopy(docLang).placeholders || {};
  const items = cvState.organizations || [];

  if (items.length === 0) {
    container.innerHTML = `<div class="form-helper" style="padding: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center;">${escapeHTML(t("fields.emptyOrganizations"))}</div>`;
  } else {
    items.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "repeatable-card";
      const prefix = `org-${index}`;
      card.innerHTML = `
        <div class="repeatable-card-header">
          <div class="repeatable-card-title">
            <strong>${escapeHTML(item.name || t("fields.orgName"))}</strong> (${escapeHTML(item.role || t("fields.orgRole"))})
          </div>
          <div class="card-actions">
            <button type="button" class="btn btn-subtle btn-sm btn-move-up" title="${escapeAttr(t("fields.moveUp"))}" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="btn btn-subtle btn-sm btn-move-down" title="${escapeAttr(t("fields.moveDown"))}" ${index === items.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="btn btn-danger-subtle btn-sm btn-delete-item" title="${escapeAttr(t("fields.deleteBtn"))}">${escapeHTML(t("fields.deleteBtn"))}</button>
          </div>
        </div>
        <div class="repeatable-card-body">
          <div class="form-grid">
            <div class="form-group">
              <label for="${prefix}-name" class="form-label">${escapeHTML(t("fields.orgName"))} <span class="required">*</span></label>
              <input type="text" id="${prefix}-name" class="form-input org-name" value="${escapeAttr(item.name || "")}" placeholder="${escapeAttr(ph.orgName || "")}" />
            </div>
            <div class="form-group">
              <label for="${prefix}-role" class="form-label">${escapeHTML(t("fields.orgRole"))} <span class="required">*</span></label>
              <input type="text" id="${prefix}-role" class="form-input org-role" value="${escapeAttr(item.role || "")}" placeholder="${escapeAttr(ph.orgRole || "")}" />
            </div>
            <div class="form-group form-grid-full">
              <label for="${prefix}-period" class="form-label">${escapeHTML(t("fields.orgPeriod"))}</label>
              <input type="text" id="${prefix}-period" class="form-input org-period" value="${escapeAttr(item.period || "")}" placeholder="${escapeAttr(ph.orgPeriod || "")}" />
            </div>
            <div class="form-group form-grid-full">
              <label for="${prefix}-desc" class="form-label">${escapeHTML(t("fields.orgDesc"))}</label>
              <textarea id="${prefix}-desc" class="form-textarea org-desc" rows="3" placeholder="${escapeAttr(ph.orgDesc || "")}">${escapeHTML(item.description || "")}</textarea>
            </div>
          </div>
        </div>
      `;

      card.querySelector(".org-name").oninput = (e) => { item.name = e.target.value; triggerAutoSave(); };
      card.querySelector(".org-role").oninput = (e) => { item.role = e.target.value; triggerAutoSave(); };
      card.querySelector(".org-period").oninput = (e) => { item.period = e.target.value; triggerAutoSave(); };
      card.querySelector(".org-desc").oninput = (e) => { item.description = e.target.value; triggerAutoSave(); };

      card.querySelector(".btn-move-up").onclick = () => moveItem(items, index, -1, renderOrganizationsList);
      card.querySelector(".btn-move-down").onclick = () => moveItem(items, index, 1, renderOrganizationsList);
      card.querySelector(".btn-delete-item").onclick = () => {
        items.splice(index, 1);
        renderOrganizationsList();
        triggerAutoSave();
      };

      container.appendChild(card);
    });
  }

  const btnAdd = document.getElementById("btn-add-organization");
  if (btnAdd) {
    btnAdd.onclick = () => {
      if (!cvState.organizations) cvState.organizations = [];
      cvState.organizations.push({
        id: "org-" + Date.now(),
        name: "",
        role: "",
        period: "",
        description: ""
      });
      renderOrganizationsList();
      triggerAutoSave();
    };
  }
}

/**
 * 9. Form Pengaturan Tata Letak, Bahasa CV, Urutan & Visibilitas Bagian
 */
function renderSettingsForm() {
  if (!cvState.settings) {
    cvState.settings = {
      fontFamily: "Calibri, Arial, sans-serif",
      fontSize: "10.5pt",
      lineHeight: "1.45"
    };
  }
  if (!Array.isArray(cvState.hiddenSections)) {
    cvState.hiddenSections = [];
  }
  if (!Array.isArray(cvState.sectionOrder) || cvState.sectionOrder.length === 0) {
    cvState.sectionOrder = ["summary", "experience", "education", "skills", "projects", "certifications", "organizations"];
  }

  const docLang = normalizeLanguage(cvState.documentLanguage);
  const docLangSelect = document.getElementById("select-document-language");
  const previewDocLangSelect = document.getElementById("select-preview-doc-language");
  if (docLangSelect) docLangSelect.value = docLang;
  if (previewDocLangSelect) previewDocLangSelect.value = docLang;

  const fontSelect = document.getElementById("setting-font-family");
  if (fontSelect) {
    fontSelect.value = cvState.settings.fontFamily;
    fontSelect.onchange = (e) => {
      cvState.settings.fontFamily = e.target.value;
      triggerAutoSave();
    };
  }

  const sizeSelect = document.getElementById("setting-font-size");
  if (sizeSelect) {
    sizeSelect.value = cvState.settings.fontSize;
    sizeSelect.onchange = (e) => {
      cvState.settings.fontSize = e.target.value;
      triggerAutoSave();
    };
  }

  const btnPresetFresh = document.getElementById("btn-preset-fresh-order");
  if (btnPresetFresh) {
    btnPresetFresh.onclick = () => {
      applyCareerTrack("freshgrad", true);
    };
  }

  const btnPresetExp = document.getElementById("btn-preset-exp-order");
  if (btnPresetExp) {
    btnPresetExp.onclick = () => {
      applyCareerTrack("experienced", true);
    };
  }

  renderSectionOrderManager();
}

function renderSectionOrderManager() {
  const listEl = document.getElementById("section-order-list");
  if (!listEl) return;
  listEl.innerHTML = "";

  const order = cvState.sectionOrder || ["summary", "experience", "education", "skills", "projects", "certifications", "organizations"];
  const hidden = new Set(cvState.hiddenSections || []);
  const sectionNames = t("settings.sectionNames") || {};

  order.forEach((secKey, idx) => {
    const label = sectionNames[secKey] || secKey;
    const isVisible = !hidden.has(secKey);
    const li = document.createElement("div");
    li.className = "section-order-item";
    li.innerHTML = `
      <label class="section-order-label">
        <input type="checkbox" class="section-visibility-cb" data-section="${escapeAttr(secKey)}" ${isVisible ? "checked" : ""} />
        <span>${escapeHTML(label)}</span>
        ${!isVisible ? `<span style="font-size:0.7rem; color:#94a3b8; font-weight:400;">${escapeHTML(t("settings.hiddenBadge"))}</span>` : ""}
      </label>
      <div class="card-actions">
        <button type="button" class="btn btn-subtle btn-sm btn-sec-up" title="${escapeAttr(t("fields.moveUp"))}" ${idx === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="btn btn-subtle btn-sm btn-sec-down" title="${escapeAttr(t("fields.moveDown"))}" ${idx === order.length - 1 ? "disabled" : ""}>↓</button>
      </div>
    `;

    const cb = li.querySelector(".section-visibility-cb");
    cb.onchange = (e) => {
      const checked = e.target.checked;
      if (checked) {
        cvState.hiddenSections = (cvState.hiddenSections || []).filter(k => k !== secKey);
      } else {
        if (!cvState.hiddenSections.includes(secKey)) {
          cvState.hiddenSections.push(secKey);
        }
      }
      renderSectionOrderManager();
      triggerAutoSave();
    };

    li.querySelector(".btn-sec-up").onclick = () => {
      moveItem(cvState.sectionOrder, idx, -1, renderSectionOrderManager);
    };
    li.querySelector(".btn-sec-down").onclick = () => {
      moveItem(cvState.sectionOrder, idx, 1, renderSectionOrderManager);
    };

    listEl.appendChild(li);
  });
}

// ==========================================================================
// Pencocok Kata Kunci Deskripsi Lowongan (Sprint 4 & 7 - Bilingual)
// ==========================================================================
function renderJobDescriptionForm() {
  const jdTextarea = document.getElementById("jd-input-textarea");
  const btnClearJd = document.getElementById("btn-clear-jd");

  if (jdTextarea) {
    jdTextarea.value = cvState.jobDescriptionText || "";
    jdTextarea.oninput = (e) => {
      cvState.jobDescriptionText = e.target.value;
      updateJobDescriptionMatcherUI();
      triggerAutoSave();
    };
  }

  if (btnClearJd) {
    btnClearJd.onclick = () => {
      cvState.jobDescriptionText = "";
      if (jdTextarea) jdTextarea.value = "";
      updateJobDescriptionMatcherUI();
      triggerAutoSave();
    };
  }
}

function updateJobDescriptionMatcherUI() {
  const container = document.getElementById("jd-match-results");
  if (!container) return;

  const jdText = (cvState && cvState.jobDescriptionText) || "";
  if (!jdText.trim()) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }

  const match = analyzeJobDescriptionMatch(cvState, jdText);
  const totalKeywords = (match.matchedKeywords ? match.matchedKeywords.length : 0) +
    (match.missingKeywords ? match.missingKeywords.length : 0);
  container.style.display = "block";

  if (!match.hasInput || totalKeywords === 0) {
    container.innerHTML = `<p class="form-helper">${escapeHTML(t("jdMatcher.moreTextNeeded"))}</p>`;
    return;
  }

  const matchRate = Math.round((match.matchedKeywords.length / totalKeywords) * 100);
  const langLabel = match.analysisLanguage === "en" ? "English (EN)" : "Indonesia (ID)";

  const matchedHTML = match.matchedKeywords.length > 0
    ? match.matchedKeywords.map(k => `<span class="jd-keyword-pill matched">✓ ${escapeHTML(k)}</span>`).join("")
    : `<span class="form-helper">${escapeHTML(t("jdMatcher.noneMatched"))}</span>`;

  const missingHTML = match.missingKeywords.length > 0
    ? match.missingKeywords.map(k => `<span class="jd-keyword-pill missing">+ ${escapeHTML(k)}</span>`).join("")
    : `<span class="form-helper" style="color:var(--success);">${escapeHTML(t("jdMatcher.allMatched"))}</span>`;

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:4px;">
      <strong style="font-size:0.78rem; color:var(--text-main);">${escapeHTML(t("jdMatcher.scoreHeader", { matched: match.matchedKeywords.length, total: totalKeywords, rate: matchRate }))}</strong>
      <span class="completeness-badge" style="font-size:0.7rem;">${escapeHTML(t("jdMatcher.analysisLangBadge", { lang: langLabel }))}</span>
    </div>
    <div style="margin-bottom:8px;">
      <div style="font-size:0.72rem; font-weight:600; color:var(--success); margin-bottom:3px;">${escapeHTML(t("jdMatcher.matchedHeader"))}</div>
      <div class="jd-keyword-pills">${matchedHTML}</div>
    </div>
    <div>
      <div style="font-size:0.72rem; font-weight:600; color:#b45309; margin-bottom:3px;">${escapeHTML(t("jdMatcher.missingHeader"))}</div>
      <div class="jd-keyword-pills">${missingHTML}</div>
    </div>
  `;
}

// ==========================================================================
// Live Preview Generation & Single-Column ATS Rendering (Mengikuti documentLanguage)
// ==========================================================================
export function updateLivePreview() {
  const container = document.getElementById("cv-live-document");
  if (!container) return;

  const {
    documentLanguage = "id",
    profile = {},
    summary = "",
    experience = [],
    education = [],
    skills = {},
    projects = [],
    certifications = [],
    organizations = [],
    settings = {},
    sectionOrder = [],
    hiddenSections = []
  } = cvState;

  const docLang = normalizeLanguage(documentLanguage);
  const docCopy = getDocumentCopy(docLang);
  const headings = docCopy.headings || {};
  const skillLabels = docCopy.skillLabels || {};
  const presentWord = docCopy.presentLabel || (docLang === "en" ? "Present" : "Sekarang");

  // Set atribut lang pada container pratinjau sesuai Bahasa CV
  container.setAttribute("lang", docLang);

  const hiddenSet = new Set(Array.isArray(hiddenSections) ? hiddenSections : []);
  const isEmptyCV = !hasAnyCVContent(cvState);

  if (isEmptyCV) {
    container.innerHTML = `
      <div class="cv-empty-state-notice">
        <div class="empty-state-icon">📄</div>
        <h2 class="empty-state-title">${escapeHTML(docCopy.emptyPreviewTitle)}</h2>
        <p class="empty-state-text">
          ${escapeHTML(docCopy.emptyPreviewDesc)}
        </p>
        <div class="empty-state-badges">
          <span class="empty-badge">${escapeHTML(docCopy.emptyBadge1)}</span>
          <span class="empty-badge">${escapeHTML(docCopy.emptyBadge2)}</span>
          <span class="empty-badge">${escapeHTML(docCopy.emptyBadge3)}</span>
          <span class="empty-badge">${escapeHTML(docCopy.emptyBadge4)}</span>
        </div>
        <div class="empty-state-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-empty-preview-sample">
            ${escapeHTML(docCopy.emptySampleBtn)}
          </button>
        </div>
      </div>
    `;
    const btnEmptySample = document.getElementById("btn-empty-preview-sample");
    if (btnEmptySample) {
      btnEmptySample.onclick = (e) => openModal("modal-sample-picker", e.currentTarget);
    }
    updateEstimatedPageCount(1);
    return;
  }

  container.style.setProperty("--ats-font-family", settings.fontFamily || "Calibri, Arial, sans-serif");
  container.style.setProperty("--ats-font-size", settings.fontSize || "10.5pt");
  container.style.setProperty("--ats-line-height", settings.lineHeight || "1.45");

  const contactItems = [];
  if (profile.email) contactItems.push(`<span class="cv-contact-item">${escapeHTML(profile.email)}</span>`);
  if (profile.phone) contactItems.push(`<span class="cv-contact-item">${escapeHTML(profile.phone)}</span>`);
  if (profile.location) contactItems.push(`<span class="cv-contact-item">${escapeHTML(profile.location)}</span>`);
  if (profile.linkedin) contactItems.push(`<span class="cv-contact-item">${escapeHTML(profile.linkedin)}</span>`);
  if (profile.portfolio) contactItems.push(`<span class="cv-contact-item">${escapeHTML(profile.portfolio)}</span>`);

  const headerHTML = `
    <header class="cv-header">
      <h1 class="cv-name">${escapeHTML(profile.fullName || docCopy.defaultNameHeading || "FULL NAME")}</h1>
      ${profile.jobTitle ? `<div class="cv-target-role">${escapeHTML(profile.jobTitle)}</div>` : ""}
      ${contactItems.length > 0 ? `<div class="cv-contact-line">${contactItems.join("")}</div>` : ""}
    </header>
  `;

  const formatEndPeriod = (item) => {
    if (item.isCurrent) return presentWord;
    if (!item.endDate) return "";
    if (docLang === "en" && item.endDate.trim().toLowerCase() === "sekarang") return "Present";
    if (docLang === "id" && item.endDate.trim().toLowerCase() === "present") return "Sekarang";
    return item.endDate;
  };

  const sectionBuilders = {
    summary: () => {
      if (!summary || !summary.trim()) return "";
      return `
        <section class="cv-section">
          <h2 class="cv-section-title">${escapeHTML(headings.summary || "Professional Summary")}</h2>
          <p class="cv-summary-text">${escapeHTML(summary.trim())}</p>
        </section>
      `;
    },

    experience: () => {
      const validItems = experience.filter(item => item.role || item.company || item.description);
      if (validItems.length === 0) return "";

      const itemsHTML = validItems.map(item => {
        const endStr = formatEndPeriod(item);
        const periodStr = item.startDate
          ? `${escapeHTML(item.startDate)} – ${escapeHTML(endStr)}`
          : escapeHTML(endStr);
        return `
          <div class="cv-item">
            <div class="cv-item-header">
              <div class="cv-item-title-group">
                <span class="cv-item-role">${escapeHTML(item.role || "")}</span>
                ${item.company ? `<span class="cv-item-company"> — ${escapeHTML(item.company)}</span>` : ""}
              </div>
              <div class="cv-item-meta-group">
                ${periodStr ? `<span class="cv-item-period">${periodStr}</span>` : ""}
                ${item.location ? ` | <span class="cv-item-location">${escapeHTML(item.location)}</span>` : ""}
              </div>
            </div>
            ${renderDescriptionBullets(item.description)}
          </div>
        `;
      }).join("");

      return `
        <section class="cv-section">
          <h2 class="cv-section-title">${escapeHTML(headings.experience || "Work Experience")}</h2>
          ${itemsHTML}
        </section>
      `;
    },

    education: () => {
      const validItems = education.filter(item => item.degree || item.institution || item.field);
      if (validItems.length === 0) return "";

      const itemsHTML = validItems.map(item => {
        const periodStr = item.startDate
          ? `${escapeHTML(item.startDate)} – ${escapeHTML(item.endDate || "")}`
          : (item.endDate ? escapeHTML(item.endDate) : "");
        return `
          <div class="cv-item">
            <div class="cv-item-header">
              <div class="cv-item-title-group">
                <span class="cv-item-role">${escapeHTML(item.institution || "")}</span>
                ${item.location ? `<span class="cv-item-location">, ${escapeHTML(item.location)}</span>` : ""}
              </div>
              <div class="cv-item-meta-group">
                ${periodStr ? `<span class="cv-item-period">${periodStr}</span>` : ""}
              </div>
            </div>
            <div class="cv-item-submeta">
              <span class="cv-item-company">${escapeHTML(item.degree || "")}${item.field ? `, ${escapeHTML(item.field)}` : ""}</span>
              ${item.gpa ? ` — <span class="cv-item-gpa">${escapeHTML(docCopy.gpaPrefix || "GPA:")} ${escapeHTML(item.gpa)}</span>` : ""}
            </div>
            ${renderDescriptionBullets(item.description)}
          </div>
        `;
      }).join("");

      return `
        <section class="cv-section">
          <h2 class="cv-section-title">${escapeHTML(headings.education || "Education")}</h2>
          ${itemsHTML}
        </section>
      `;
    },

    skills: () => {
      const rows = [];
      if (skills.technical && skills.technical.trim()) {
        rows.push(`<div class="cv-skill-group"><span class="cv-skill-label">${escapeHTML(skillLabels.technical || "Technical Skills:")}</span> <span class="cv-skill-values">${escapeHTML(skills.technical.trim())}</span></div>`);
      }
      if (skills.tools && skills.tools.trim()) {
        rows.push(`<div class="cv-skill-group"><span class="cv-skill-label">${escapeHTML(skillLabels.tools || "Tools:")}</span> <span class="cv-skill-values">${escapeHTML(skills.tools.trim())}</span></div>`);
      }
      if (skills.soft && skills.soft.trim()) {
        rows.push(`<div class="cv-skill-group"><span class="cv-skill-label">${escapeHTML(skillLabels.soft || "Soft Skills:")}</span> <span class="cv-skill-values">${escapeHTML(skills.soft.trim())}</span></div>`);
      }
      if (skills.languages && skills.languages.trim()) {
        rows.push(`<div class="cv-skill-group"><span class="cv-skill-label">${escapeHTML(skillLabels.languages || "Languages:")}</span> <span class="cv-skill-values">${escapeHTML(skills.languages.trim())}</span></div>`);
      }

      if (rows.length === 0) return "";

      return `
        <section class="cv-section">
          <h2 class="cv-section-title">${escapeHTML(headings.skills || "Skills")}</h2>
          ${rows.join("")}
        </section>
      `;
    },

    projects: () => {
      const validItems = projects.filter(item => item.title || item.description);
      if (validItems.length === 0) return "";

      const itemsHTML = validItems.map(item => {
        return `
          <div class="cv-item">
            <div class="cv-item-header">
              <div class="cv-item-title-group">
                <span class="cv-item-role">${escapeHTML(item.title || "")}</span>
                ${item.role ? ` — <span class="cv-item-company">${escapeHTML(item.role)}</span>` : ""}
              </div>
              <div class="cv-item-meta-group">
                ${item.tech ? `<span>[${escapeHTML(item.tech)}]</span>` : ""}
              </div>
            </div>
            ${item.link ? `<div class="cv-item-submeta"><a href="https://${escapeAttr(item.link.replace(/^https?:\/\//, ''))}" target="_blank" rel="noopener">${escapeHTML(item.link)}</a></div>` : ""}
            ${renderDescriptionBullets(item.description)}
          </div>
        `;
      }).join("");

      return `
        <section class="cv-section">
          <h2 class="cv-section-title">${escapeHTML(headings.projects || "Projects")}</h2>
          ${itemsHTML}
        </section>
      `;
    },

    certifications: () => {
      const validItems = certifications.filter(item => item.name || item.issuer);
      if (validItems.length === 0) return "";

      const itemsHTML = validItems.map(item => {
        return `
          <div class="cv-cert-item">
            <div class="cv-item-header">
              <div class="cv-item-title-group">
                <span class="cv-item-role">${escapeHTML(item.name || "")}</span>
                ${item.issuer ? ` — <span class="cv-item-company">${escapeHTML(item.issuer)}</span>` : ""}
              </div>
              <div class="cv-item-meta-group">
                ${item.year ? `<span class="cv-item-period">${escapeHTML(item.year)}</span>` : ""}
              </div>
            </div>
            ${item.credentialUrl ? `<div class="cv-item-submeta"><span style="color:#6b7280; font-size:9pt;">${escapeHTML(docCopy.credentialPrefix || "Credential:")} ${escapeHTML(item.credentialUrl)}</span></div>` : ""}
          </div>
        `;
      }).join("");

      return `
        <section class="cv-section">
          <h2 class="cv-section-title">${escapeHTML(headings.certifications || "Certifications")}</h2>
          ${itemsHTML}
        </section>
      `;
    },

    organizations: () => {
      const validItems = organizations.filter(item => item.name || item.role);
      if (validItems.length === 0) return "";

      const itemsHTML = validItems.map(item => {
        return `
          <div class="cv-org-item">
            <div class="cv-item-header">
              <div class="cv-item-title-group">
                <span class="cv-item-role">${escapeHTML(item.name || "")}</span>
                ${item.role ? ` — <span class="cv-item-company">${escapeHTML(item.role)}</span>` : ""}
              </div>
              <div class="cv-item-meta-group">
                ${item.period ? `<span class="cv-item-period">${escapeHTML(item.period)}</span>` : ""}
              </div>
            </div>
            ${renderDescriptionBullets(item.description)}
          </div>
        `;
      }).join("");

      return `
        <section class="cv-section">
          <h2 class="cv-section-title">${escapeHTML(headings.organizations || "Organizations")}</h2>
          ${itemsHTML}
        </section>
      `;
    }
  };

  const defaultOrder = ["summary", "experience", "education", "skills", "projects", "certifications", "organizations"];
  const order = (sectionOrder && sectionOrder.length > 0) ? sectionOrder : defaultOrder;

  const bodySectionsHTML = order
    .filter(sectionKey => !hiddenSet.has(sectionKey))
    .map(sectionKey => (sectionBuilders[sectionKey] ? sectionBuilders[sectionKey]() : ""))
    .join("");

  container.innerHTML = headerHTML + bodySectionsHTML;

  const contentHeight = container.scrollHeight || 900;
  const pages = Math.max(1, Math.ceil((contentHeight - 40) / 1040));
  updateEstimatedPageCount(pages);
}

function updateEstimatedPageCount(pages) {
  estimatedA4Pages = pages;
  const pageCountEl = document.getElementById("preview-page-count");
  if (pageCountEl) {
    pageCountEl.textContent = t("preview.estimatedPages", { pages });
  }
}

function renderDescriptionBullets(rawText) {
  if (!rawText || !rawText.trim()) return "";
  const lines = rawText.split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/^[-•*]\s*/, ""));

  if (lines.length === 0) return "";

  const liElements = lines.map(line => `<li>${escapeHTML(line)}</li>`).join("");
  return `<ul class="cv-bullet-list">${liElements}</ul>`;
}

// ==========================================================================
// Widget Kesiapan Dua Pilar & Checklist Actionable ("Perbaiki sekarang")
// ==========================================================================
function updateCompletenessWidget() {
  const result = analyzeCVCompleteness(cvState);

  const fillEl = document.getElementById("completeness-fill");
  const percentEl = document.getElementById("completeness-percent");
  const badgeEl = document.getElementById("completeness-status-badge") || document.getElementById("quality-status-badge");
  const dataFillEl = document.getElementById("data-completeness-fill");
  const dataPercentEl = document.getElementById("data-completeness-percent");
  const qualFillEl = document.getElementById("content-quality-fill");
  const qualPercentEl = document.getElementById("content-quality-percent");
  const tipsListEl = document.getElementById("completeness-tips-list");

  const dataPct = (result.dataCompleteness && typeof result.dataCompleteness === "object")
    ? result.dataCompleteness.percentage
    : (result.dataCompleteness || 0);
  const qualPct = (result.contentQuality && typeof result.contentQuality === "object")
    ? result.contentQuality.percentage
    : (result.contentQuality || 0);

  if (fillEl && percentEl) {
    fillEl.style.width = `${result.completenessPercentage}%`;
    percentEl.textContent = `${result.completenessPercentage}%`;
    if (result.completenessPercentage >= 80) {
      fillEl.style.backgroundColor = "var(--success)";
    } else if (result.completenessPercentage >= 50) {
      fillEl.style.backgroundColor = "var(--primary)";
    } else {
      fillEl.style.backgroundColor = "var(--warning)";
    }
  }

  if (badgeEl) {
    badgeEl.textContent = result.overallStatusLabel || t("readiness.statusNeedsCompletion");
  }

  if (dataFillEl && dataPercentEl) {
    dataFillEl.style.width = `${dataPct}%`;
    dataPercentEl.textContent = `${dataPct}%`;
  }

  if (qualFillEl && qualPercentEl) {
    qualFillEl.style.width = `${qualPct}%`;
    qualPercentEl.textContent = `${qualPct}%`;
  }

  if (tipsListEl) {
    const dataTag = t("readiness.pillarDataTag");
    const qualTag = t("readiness.pillarQualityTag");
    const fixBtnLabel = t("readiness.fixNowBtn");
    const reasonPrefix = t("readiness.reasonPrefix");

    tipsListEl.innerHTML = result.checks.map(c => `
      <li class="tip-item">
        <span class="tip-status-icon">${c.passed ? "✅" : "⚠️"}</span>
        <div class="tip-content-wrap">
          <div>
            <strong>[${escapeHTML(c.pillar === "data" ? dataTag : qualTag)}] ${escapeHTML(c.category)}:</strong>
            ${escapeHTML(c.message)}
          </div>
          ${!c.passed && c.reason ? `<div class="tip-reason">${escapeHTML(reasonPrefix)} ${escapeHTML(c.reason)}${c.example ? ` — <em>${escapeHTML(c.example)}</em>` : ""}</div>` : ""}
          ${!c.passed ? `<button type="button" class="btn-fix-now" data-step="${c.targetStep || 1}" data-selector="${escapeAttr(c.targetSelector || "#prof-name")}">${escapeHTML(fixBtnLabel)}</button>` : ""}
        </div>
      </li>
    `).join("");

    tipsListEl.querySelectorAll(".btn-fix-now").forEach(btn => {
      btn.onclick = () => {
        const step = Number(btn.dataset.step) || 1;
        const selector = btn.dataset.selector || "#prof-name";
        jumpToFieldAndFocus(step, selector);
      };
    });
  }
}

// ==========================================================================
// Diagnostik Pra-Ekspor PDF (Sprint 3 & 6)
// ==========================================================================
function renderPreExportDiagnostics() {
  const box = document.getElementById("pre-export-summary-box");
  const btnFix = document.getElementById("btn-pre-export-fix");
  if (!box) return;

  const diag = runPreExportDiagnostics(cvState, estimatedA4Pages);
  const warnings = Array.isArray(diag.issues) ? diag.issues : (diag.warnings || []);

  const warningsHTML = warnings.length > 0
    ? `<ul class="pre-export-warning-list">${warnings.map(w => `<li>⚠️ ${escapeHTML(w.label || w.text || "")}</li>`).join("")}</ul>`
    : `<div style="color:var(--success); font-size:0.8rem; font-weight:600;">${escapeHTML(t("modals.printAllClear"))}</div>`;

  const hiddenInfo = diag.hiddenOrEmpty && diag.hiddenOrEmpty.length > 0
    ? `<div style="margin-top:6px; font-size:0.75rem; color:var(--text-secondary);"><strong>${escapeHTML(t("modals.printHiddenSectionsLabel"))}</strong> ${escapeHTML(diag.hiddenOrEmpty.join(", "))}</div>`
    : "";

  box.innerHTML = `
    <div class="pre-export-meta-row">
      <span class="pre-export-badge">${escapeHTML(t("modals.printFileBadge", { file: diag.fileName }))}</span>
      <span class="pre-export-badge">${escapeHTML(t("modals.printPagesBadge", { pages: diag.estimatedPages }))}</span>
    </div>
    ${warningsHTML}
    ${hiddenInfo}
  `;

  if (btnFix) {
    if (warnings.length > 0) {
      btnFix.style.display = "inline-flex";
      const firstWarn = warnings[0];
      btnFix.onclick = () => {
        closeModal("modal-print-guide");
        jumpToFieldAndFocus(firstWarn.step || 1, firstWarn.selector || "#prof-name");
      };
    } else {
      btnFix.style.display = "none";
    }
  }
}

// ==========================================================================
// Pengelola Multi-Versi CV Lokal (Sprint 3 & 6)
// ==========================================================================
function updateActiveVersionPill() {
  const labelEl = document.getElementById("active-version-label");
  if (!labelEl) return;
  const versions = loadCVVersions(cvState);
  const activeId = getActiveVersionId();
  const activeVer = versions.find(v => v.id === activeId) || versions[0];
  if (activeVer) {
    const docLangTag = (activeVer.data && activeVer.data.documentLanguage === "en") ? "EN" : "ID";
    labelEl.textContent = `${activeVer.name} (${docLangTag})`;
  }
}

function renderVersionsModalList() {
  const container = document.getElementById("versions-list-container");
  if (!container) return;
  const versions = loadCVVersions(cvState);
  const activeId = getActiveVersionId();
  const localeCode = getInterfaceLanguage() === "en" ? "en-US" : "id-ID";

  container.innerHTML = versions.map(v => {
    const isActive = v.id === activeId;
    const dateStr = new Date(v.updatedAt || Date.now()).toLocaleDateString(localeCode, {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
    });
    const roleTitle = (v.data && v.data.profile && v.data.profile.jobTitle)
      ? v.data.profile.jobTitle
      : t("modals.noTargetRole");
    const verDocLang = (v.data && v.data.documentLanguage === "en") ? "EN" : "ID";

    return `
      <div class="version-card-item version-row-item ${isActive ? "active is-active" : ""}">
        <div>
          <div class="version-item-title">
            <strong>${escapeHTML(v.name)}</strong>
            <span class="completeness-badge" style="margin-left:4px; font-size:0.68rem;">CV: ${verDocLang}</span>
            ${isActive ? `<span class="completeness-badge" style="margin-left:4px;">${escapeHTML(t("modals.activeBadge"))}</span>` : ""}
          </div>
          <div class="version-item-meta">${escapeHTML(roleTitle)} • ${escapeHTML(t("modals.updatedPrefix"))} ${escapeHTML(dateStr)}</div>
        </div>
        <div class="card-actions">
          ${!isActive ? `<button type="button" class="btn btn-secondary btn-sm btn-switch-version" data-id="${escapeAttr(v.id)}">${escapeHTML(t("modals.openVersionBtn"))}</button>` : ""}
          <button type="button" class="btn btn-subtle btn-sm btn-rename-version" data-id="${escapeAttr(v.id)}" data-name="${escapeAttr(v.name)}">${escapeHTML(t("modals.renameVersionBtn"))}</button>
          ${versions.length > 1 ? `<button type="button" class="btn btn-danger-subtle btn-sm btn-delete-version" data-id="${escapeAttr(v.id)}">${escapeHTML(t("modals.deleteVersionBtn"))}</button>` : ""}
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".btn-switch-version").forEach(btn => {
    btn.onclick = () => {
      const targetData = setActiveVersionId(btn.dataset.id);
      if (targetData) {
        cvState = mergeWithDefaults(targetData, defaultEmptyCV);
        applyDocumentPlaceholders();
        renderAllFormFields();
        updateLivePreview();
        updateCompletenessWidget();
        updateJobDescriptionMatcherUI();
        updateActiveVersionPill();
        renderVersionsModalList();
        showToast(t("toasts.versionSwitched"));
      }
    };
  });

  container.querySelectorAll(".btn-rename-version").forEach(btn => {
    btn.onclick = () => {
      const newName = prompt(t("modals.renamePrompt"), btn.dataset.name || "");
      if (newName && newName.trim()) {
        renameCVVersion(btn.dataset.id, newName.trim());
        updateActiveVersionPill();
        renderVersionsModalList();
      }
    };
  });

  container.querySelectorAll(".btn-delete-version").forEach(btn => {
    btn.onclick = () => {
      if (deleteCVVersion(btn.dataset.id)) {
        const currentRaw = loadCVFromStorage();
        cvState = mergeWithDefaults(currentRaw, defaultEmptyCV);
        applyDocumentPlaceholders();
        renderAllFormFields();
        updateLivePreview();
        updateCompletenessWidget();
        updateActiveVersionPill();
        renderVersionsModalList();
        showToast(t("toasts.versionDeleted"));
      }
    };
  });
}

// ==========================================================================
// Autosave & Helper Debounce
// ==========================================================================
function triggerAutoSave() {
  hideStarterBanner();
  hideCorruptStorageAlert();

  const statusEl = document.getElementById("save-status-text");
  const btnBackupErr = document.getElementById("btn-backup-on-error");
  if (statusEl) statusEl.textContent = t("status.saving");

  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    const savedOk = saveCVToStorage(cvState);
    updateLivePreview();
    updateCompletenessWidget();
    updateJobDescriptionMatcherUI();
    updateActiveVersionPill();

    if (savedOk) {
      if (btnBackupErr) btnBackupErr.style.display = "none";
      if (statusEl) {
        const timeStr = formatSavedTime(new Date(), getInterfaceLanguage());
        statusEl.textContent = t("status.savedAt", { time: timeStr });
      }
    } else {
      if (statusEl) {
        statusEl.textContent = t("status.saveError");
      }
      if (btnBackupErr) {
        btnBackupErr.style.display = "inline-flex";
      }
    }
  }, 350);
}

function bindInput(id, initialVal, updateFn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = initialVal || "";
  el.oninput = (e) => {
    updateFn(e.target.value);
    triggerAutoSave();
  };
}

function moveItem(array, index, delta, renderCallback) {
  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= array.length) return;
  const temp = array[index];
  array[index] = array[targetIndex];
  array[targetIndex] = temp;
  renderCallback();
  triggerAutoSave();
}

// ==========================================================================
// Fitur Salin Teks ATS (Plain Text ATS Converter - Mengikuti documentLanguage)
// ==========================================================================
function copyPlainTextATS() {
  const {
    documentLanguage = "id",
    profile = {},
    summary = "",
    experience = [],
    education = [],
    skills = {},
    projects = [],
    certifications = [],
    organizations = [],
    sectionOrder = [],
    hiddenSections = []
  } = cvState;

  const docLang = normalizeLanguage(documentLanguage);
  const docCopy = getDocumentCopy(docLang);
  const headings = docCopy.headings || {};
  const skillLabels = docCopy.skillLabels || {};
  const presentWord = docCopy.presentLabel || "Present";
  const hiddenSet = new Set(Array.isArray(hiddenSections) ? hiddenSections : []);

  if (!profile.fullName && experience.length === 0 && education.length === 0) {
    showToast(t("toasts.copyEmptyWarn"));
    return;
  }

  let out = "";
  out += `${(profile.fullName || "").toUpperCase()}\n`;
  if (profile.jobTitle) out += `${profile.jobTitle}\n`;
  const contact = [profile.email, profile.phone, profile.location, profile.linkedin, profile.portfolio].filter(Boolean).join(" | ");
  if (contact) out += `${contact}\n`;
  out += "\n" + "=".repeat(40) + "\n\n";

  const order = sectionOrder.length > 0 ? sectionOrder : ["summary", "experience", "education", "skills", "projects", "certifications", "organizations"];

  order.filter(key => !hiddenSet.has(key)).forEach(key => {
    if (key === "summary" && summary.trim()) {
      out += `${(headings.summary || "PROFESSIONAL SUMMARY").toUpperCase()}\n`;
      out += "-".repeat(25) + "\n";
      out += `${summary.trim()}\n\n`;
    } else if (key === "experience" && experience.length > 0) {
      out += `${(headings.experience || "WORK EXPERIENCE").toUpperCase()}\n`;
      out += "-".repeat(25) + "\n";
      experience.forEach(exp => {
        const period = exp.startDate ? `${exp.startDate} - ${exp.endDate || (exp.isCurrent ? presentWord : "")}` : "";
        out += `${exp.role || ""} | ${exp.company || ""} (${period})\n`;
        if (exp.location) out += `${docCopy.locationPrefix || "Location:"} ${exp.location}\n`;
        if (exp.description) {
          exp.description.split("\n").filter(Boolean).forEach(line => {
            out += `  • ${line.replace(/^[-•*]\s*/, "")}\n`;
          });
        }
        out += "\n";
      });
    } else if (key === "education" && education.length > 0) {
      out += `${(headings.education || "EDUCATION").toUpperCase()}\n`;
      out += "-".repeat(25) + "\n";
      education.forEach(edu => {
        const period = edu.startDate ? `${edu.startDate} - ${edu.endDate}` : edu.endDate || "";
        out += `${edu.institution || ""} | ${edu.degree || ""}${edu.field ? ` - ${edu.field}` : ""} (${period})\n`;
        if (edu.gpa) out += `${docCopy.gpaPrefix || "GPA:"} ${edu.gpa}\n`;
        if (edu.description) {
          edu.description.split("\n").filter(Boolean).forEach(line => {
            out += `  • ${line.replace(/^[-•*]\s*/, "")}\n`;
          });
        }
        out += "\n";
      });
    } else if (key === "skills") {
      const hasAnySkill = skills.technical || skills.tools || skills.soft || skills.languages;
      if (hasAnySkill) {
        out += `${(headings.skills || "SKILLS").toUpperCase()}\n`;
        out += "-".repeat(25) + "\n";
        if (skills.technical) out += `${skillLabels.technical || "Technical:"} ${skills.technical}\n`;
        if (skills.tools) out += `${skillLabels.tools || "Tools:"} ${skills.tools}\n`;
        if (skills.soft) out += `${skillLabels.soft || "Soft Skills:"} ${skills.soft}\n`;
        if (skills.languages) out += `${skillLabels.languages || "Languages:"} ${skills.languages}\n`;
        out += "\n";
      }
    } else if (key === "projects" && projects.length > 0) {
      out += `${(headings.projects || "PROJECTS").toUpperCase()}\n`;
      out += "-".repeat(25) + "\n";
      projects.forEach(p => {
        out += `${p.title || ""} ${p.role ? `(${p.role})` : ""} ${p.tech ? `[${p.tech}]` : ""}\n`;
        if (p.link) out += `${docCopy.linkPrefix || "Link:"} ${p.link}\n`;
        if (p.description) {
          p.description.split("\n").filter(Boolean).forEach(line => {
            out += `  • ${line.replace(/^[-•*]\s*/, "")}\n`;
          });
        }
        out += "\n";
      });
    } else if (key === "certifications" && certifications.length > 0) {
      out += `${(headings.certifications || "CERTIFICATIONS").toUpperCase()}\n`;
      out += "-".repeat(25) + "\n";
      certifications.forEach(c => {
        out += `${c.name || ""} - ${c.issuer || ""} (${c.year || ""})\n`;
        if (c.credentialUrl) out += `${docCopy.credentialPrefix || "Credential:"} ${c.credentialUrl}\n`;
      });
      out += "\n";
    } else if (key === "organizations" && organizations.length > 0) {
      out += `${(headings.organizations || "ORGANIZATIONS").toUpperCase()}\n`;
      out += "-".repeat(25) + "\n";
      organizations.forEach(o => {
        out += `${o.name || ""} | ${o.role || ""} (${o.period || ""})\n`;
        if (o.description) {
          o.description.split("\n").filter(Boolean).forEach(line => {
            out += `  • ${line.replace(/^[-•*]\s*/, "")}\n`;
          });
        }
        out += "\n";
      });
    }
  });

  navigator.clipboard.writeText(out).then(() => {
    showToast(t("toasts.copySuccess"));
  }).catch(() => {
    alert("Failed to copy plain text to clipboard.");
  });
}

// ==========================================================================
// Eksekusi Download PDF / Cetak Bersih (Nama File Netral Bahasa)
// ==========================================================================
function executePrintPDF() {
  const fileName = buildPdfFileName(cvState).replace(/\.pdf$/i, "");
  const originalTitle = document.title;
  document.title = fileName;

  updateLivePreview();
  window.print();

  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
}

// ==========================================================================
// Modal Handlers, Interaksi Preset & Aksesibilitas Dialog
// ==========================================================================
function applySampleByTrack(careerTrack) {
  // Gunakan documentLanguage yang sedang dipilih pada CV (independen dari bahasa antarmuka/browser)
  const targetDocLang = normalizeLanguage(cvState && cvState.documentLanguage);

  const dataset = getSampleDataset(careerTrack, targetDocLang);
  cvState = mergeWithDefaults(JSON.parse(JSON.stringify(dataset)), defaultEmptyCV);
  cvState.documentLanguage = targetDocLang;

  editorViewMode = "all";
  saveCVToStorage(cvState);
  hideCorruptStorageAlert();
  applyDocumentPlaceholders();
  renderAllFormFields();
  updateWizardUI();
  updateLivePreview();
  updateCompletenessWidget();
  updateJobDescriptionMatcherUI();
  updateActiveVersionPill();
  hideStarterBanner();

  const label = careerTrack === "freshgrad"
    ? t("wizard.trackFreshGrad")
    : t("wizard.trackExperienced");
  showToast(t("toasts.sampleLoaded", { label }));
}

function setupModalEvents() {
  const btnSelectExp = document.getElementById("btn-pick-experienced");
  if (btnSelectExp) {
    btnSelectExp.onclick = () => {
      applySampleByTrack("experienced");
      closeModal("modal-sample-picker");
    };
  }

  const btnSelectFresh = document.getElementById("btn-pick-freshgrad");
  if (btnSelectFresh) {
    btnSelectFresh.onclick = () => {
      applySampleByTrack("freshgrad");
      closeModal("modal-sample-picker");
    };
  }

  const btnConfirmReset = document.getElementById("btn-confirm-reset-action");
  if (btnConfirmReset) {
    btnConfirmReset.onclick = () => {
      const preservedDocLang = normalizeLanguage(cvState && cvState.documentLanguage);
      cvState = JSON.parse(JSON.stringify(defaultEmptyCV));
      cvState.documentLanguage = preservedDocLang;
      touchedFields.clear();
      clearCVStorage();
      editorViewMode = "wizard";
      currentWizardStep = 1;
      applyDocumentPlaceholders();
      renderAllFormFields();
      updateWizardUI();
      updateLivePreview();
      updateCompletenessWidget();
      updateJobDescriptionMatcherUI();
      showStarterBanner();
      closeModal("modal-confirm-reset");
      showToast(t("toasts.formResetDone"));
    };
  }

  // Tombol Buat Versi Baru & Duplikat di Modal Versi (Mendukung Pilihan Bahasa CV)
  const inputNewVer = document.getElementById("input-new-version-name");
  const selectNewVerLang = document.getElementById("select-new-version-doc-lang");
  const btnCreateEmptyVer = document.getElementById("btn-create-empty-version") || document.getElementById("btn-create-new-version");
  const btnDupCurrentVer = document.getElementById("btn-duplicate-current-version");

  const resolveNewVersionDocLang = () => {
    const val = selectNewVerLang ? selectNewVerLang.value : "match";
    if (val === "en" || val === "id") return val;
    return normalizeLanguage(cvState && cvState.documentLanguage);
  };

  if (btnCreateEmptyVer) {
    btnCreateEmptyVer.onclick = () => {
      const targetLang = resolveNewVersionDocLang();
      const name = (inputNewVer && inputNewVer.value.trim()) || (targetLang === "en" ? "New English CV" : "CV Baru");
      const created = createNewCVVersion(name, defaultEmptyCV, targetLang);
      if (created) {
        cvState = mergeWithDefaults(created.data, defaultEmptyCV);
        if (inputNewVer) inputNewVer.value = "";
        applyDocumentPlaceholders();
        renderAllFormFields();
        updateLivePreview();
        updateCompletenessWidget();
        updateActiveVersionPill();
        renderVersionsModalList();
        showToast(t("toasts.versionCreated", { name: created.name }));
      }
    };
  }

  if (btnDupCurrentVer) {
    btnDupCurrentVer.onclick = () => {
      const targetLang = resolveNewVersionDocLang();
      const defaultName = `${(cvState.profile && cvState.profile.jobTitle) || "CV"} (${targetLang.toUpperCase()})`;
      const name = (inputNewVer && inputNewVer.value.trim()) || defaultName;
      const created = createNewCVVersion(name, cvState, targetLang);
      if (created) {
        cvState = mergeWithDefaults(created.data, defaultEmptyCV);
        if (inputNewVer) inputNewVer.value = "";
        applyDocumentPlaceholders();
        renderAllFormFields();
        updateLivePreview();
        updateCompletenessWidget();
        updateActiveVersionPill();
        renderVersionsModalList();
        showToast(t("toasts.versionDuplicated", { name: created.name }));
      }
    };
  }

  document.querySelectorAll(".modal-close-trigger").forEach(btn => {
    btn.onclick = () => {
      const modal = btn.closest(".modal-overlay");
      if (modal) closeModal(modal.id);
    };
  });
}

function setupStarterBannerEvents() {
  const btnExp = document.getElementById("btn-starter-experienced");
  if (btnExp) {
    btnExp.onclick = () => applySampleByTrack("experienced");
  }

  const btnFresh = document.getElementById("btn-starter-freshgrad");
  if (btnFresh) {
    btnFresh.onclick = () => applySampleByTrack("freshgrad");
  }

  const btnEmpty = document.getElementById("btn-starter-empty");
  if (btnEmpty) {
    btnEmpty.onclick = () => {
      hideStarterBanner();
      setWizardStep(1);
      const nameInput = document.getElementById("prof-name");
      if (nameInput) nameInput.focus();
      showToast(t("toasts.startFillingProfile"));
    };
  }
}

function showStarterBanner() {
  const banner = document.getElementById("starter-banner-card");
  if (banner) banner.style.display = "flex";
}

function hideStarterBanner() {
  const banner = document.getElementById("starter-banner-card");
  if (banner) banner.style.display = "none";
}

function openModal(id, triggerEl = null) {
  const modal = document.getElementById(id);
  if (!modal) return;
  let rawTrigger = triggerEl || document.activeElement;
  if (rawTrigger && typeof rawTrigger.closest === "function") {
    const parentDetails = rawTrigger.closest("details");
    if (parentDetails && rawTrigger.tagName !== "SUMMARY") {
      const summaryEl = parentDetails.querySelector("summary");
      if (summaryEl) rawTrigger = summaryEl;
    }
  }
  lastFocusedElement = rawTrigger;
  modal.style.display = "flex";

  const focusable = modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
  if (focusable.length > 0) {
    setTimeout(() => focusable[0].focus(), 30);
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "none";

  let target = lastFocusedElement;
  if (target && typeof target.closest === "function") {
    const closedDetails = target.closest("details:not([open])");
    if (closedDetails && target.tagName !== "SUMMARY") {
      target = closedDetails.querySelector("summary") || target;
    }
  }

  const isVisible = target &&
    document.body.contains(target) &&
    (target.offsetParent !== null || (typeof target.getClientRects === "function" && target.getClientRects().length > 0));

  if (!isVisible) {
    target = document.querySelector("#header-more-dropdown > summary") || document.getElementById("btn-download-pdf");
  }

  if (target && typeof target.focus === "function") {
    try {
      target.focus();
    } catch {
      // Abaikan jika elemen tidak lagi di DOM
    }
  }
}

function setupKeyboardAccessibility() {
  document.addEventListener("keydown", (e) => {
    const openModals = Array.from(document.querySelectorAll(".modal-overlay")).filter(
      m => m.style.display && m.style.display !== "none"
    );
    if (openModals.length === 0) return;

    const activeModal = openModals[openModals.length - 1];

    if (e.key === "Escape") {
      e.preventDefault();
      closeModal(activeModal.id);
      return;
    }

    if (e.key === "Tab") {
      const focusable = Array.from(
        activeModal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

function showToast(message) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>ℹ️</span> <span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// ==========================================================================
// Utilitas Sanitasi String
// ==========================================================================
function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
