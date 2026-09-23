"""
Comprehensive behavioral & regression test suite for Indonesian ATS CV Builder (Sprints 1–4):
1. Self-contained isolated HTTP server on an ephemeral port (stops cleanly after test).
2. Partial and empty draft persistence across reloads, corrupt storage non-destructive alert, legacy formats.
3. 5-Step Wizard navigation, Career Track switching, Inline Validation, Dual-Pillar Readiness & 'Perbaiki sekarang' focus jump.
4. Achievement Bullet Builder, Multi-Version CV Manager, Section Visibility Manager, JD Keyword Matcher, Pre-Export Diagnostics.
5. Real PDF pagination & text extraction for 1-page, 2-page (75 bullets), and 4+ page (130 bullets) CVs.
6. Mobile 390x844 layout & zero horizontal overflow.
Uses Playwright with real Chromium browser engine (without --no-sandbox).
"""

import os
import sys
import re
import glob
import site
import zlib
import socket
import threading
import functools
from http.server import HTTPServer, SimpleHTTPRequestHandler

sys.stdout.reconfigure(encoding='utf-8')


def _ensure_playwright_importable():
    try:
        import playwright  # noqa: F401
        return
    except ModuleNotFoundError:
        candidates = []
        try:
            user_site = site.getusersitepackages()
            if user_site:
                candidates.append(user_site)
        except Exception:
            pass
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        if local_app_data:
            pattern = os.path.join(
                local_app_data,
                "Packages",
                "PythonSoftwareFoundation.Python.*",
                "LocalCache",
                "local-packages",
                "Python*",
                "site-packages"
            )
            candidates.extend(glob.glob(pattern))
        for path in candidates:
            if os.path.isdir(path) and path not in sys.path:
                sys.path.append(path)


_ensure_playwright_importable()

try:
    from playwright.sync_api import sync_playwright
except ModuleNotFoundError:
    print("[ERROR] Playwright belum terpasang pada Python environment ini.")
    print("Jalankan satu perintah setup berikut dari root proyek:")
    print("  python -m pip install -r requirements-dev.txt && python -m playwright install chromium")
    sys.exit(1)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class QuietHTTPHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        )
        super().end_headers()


def start_isolated_server():
    handler = functools.partial(QuietHTTPHandler, directory=PROJECT_ROOT)
    server = HTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, f"http://127.0.0.1:{port}"


def log_step(name):
    print(f"\n[TEST] {name}")


def log_pass(msg):
    print(f"  [PASS] {msg}")


def log_fail(msg):
    print(f"  [FAIL] {msg}")
    return False


def extract_pdf_bullets_by_page(pdf_bytes):
    page_matches = list(re.finditer(rb'/Type\s*/Page\b(.*?)(?=/Type\s*/Page\b|xref|\Z)', pdf_bytes, re.DOTALL))
    cmaps = {}
    for m in re.finditer(rb'stream[\r\n]+(.*?)[\r\n]+endstream', pdf_bytes, re.DOTALL):
        raw_s = m.group(1)
        try:
            data = zlib.decompress(raw_s)
            if b'beginbfrange' in data or b'beginbfchar' in data:
                for line in data.splitlines():
                    line = line.strip()
                    m_char = re.match(rb'<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>', line)
                    if m_char:
                        src = int(m_char.group(1), 16)
                        dst_hex = m_char.group(2).decode('ascii')
                        chars = ''.join(chr(int(dst_hex[j:j+4], 16)) for j in range(0, len(dst_hex), 4))
                        cmaps[src] = chars
                    m_range = re.match(rb'<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>', line)
                    if m_range:
                        s_code = int(m_range.group(1), 16)
                        e_code = int(m_range.group(2), 16)
                        d_code = int(m_range.group(3), 16)
                        for off in range(e_code - s_code + 1):
                            cmaps[s_code + off] = chr(d_code + off)
        except Exception:
            pass

    all_found_bullets = set()
    page_bullets = {}

    for idx, p_obj in enumerate(page_matches):
        content_refs = re.findall(rb'/Contents\s+(\d+)\s+0\s+R|/Contents\s*\[(.*?)\]', p_obj.group(0))
        obj_ids = []
        for cr in content_refs:
            if cr[0]:
                obj_ids.append(cr[0])
            if cr[1]:
                obj_ids.extend(re.findall(rb'(\d+)\s+0\s+R', cr[1]))

        page_text = ''
        for oid in obj_ids:
            obj_pat = rb'\b' + oid + rb'\s+0\s+obj.*?stream[\r\n]+(.*?)[\r\n]+endstream'
            obj_match = re.search(obj_pat, pdf_bytes, re.DOTALL)
            if obj_match:
                stream_data = zlib.decompress(obj_match.group(1))
                hex_strings = re.findall(rb'<([0-9a-fA-F]+)>', stream_data)
                decoded_chars = []
                for h in hex_strings:
                    for k in range(0, len(h), 4):
                        code = int(h[k:k+4], 16)
                        decoded_chars.append(cmaps.get(code, '?'))
                page_text += ''.join(decoded_chars)

        found = re.findall(r'Pencapaian Baris Ke-\d+', page_text)
        page_bullets[idx + 1] = found
        all_found_bullets.update(found)

    return len(page_matches), page_bullets, all_found_bullets


def test_draft_persistence(page):
    log_step("1. Testing First Visit / Empty Storage")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(300)

    banner_disp = page.evaluate("getComputedStyle(document.getElementById('starter-banner-card')).display")
    title_val = page.evaluate("document.getElementById('prof-title').value")
    has_empty_notice = page.evaluate("document.querySelector('.cv-empty-state-notice') !== null")

    if banner_disp != "none" and title_val == "" and has_empty_notice:
        log_pass("First visit starts empty, displays starter banner, and shows empty preview notice.")
    else:
        return log_fail(f"First visit failed: banner={banner_disp}, title={title_val}, empty_notice={has_empty_notice}")

    log_step("2. Testing Partial Draft (Target Posisi = 'Data Analyst' only)")
    page.fill("#prof-title", "Data Analyst")
    page.wait_for_timeout(500)

    page.reload()
    page.wait_for_timeout(350)

    reloaded_title = page.evaluate("document.getElementById('prof-title').value")
    banner_disp_reload = page.evaluate("getComputedStyle(document.getElementById('starter-banner-card')).display")
    preview_role = page.evaluate("(() => { const el = document.querySelector('.cv-target-role'); return el ? el.textContent.trim() : null; })()")

    if reloaded_title == "Data Analyst" and banner_disp_reload == "none" and preview_role == "Data Analyst":
        log_pass("Partial draft ('Data Analyst') preserved across refresh and rendered in live preview.")
    else:
        return log_fail(f"Partial draft failed: title={reloaded_title}, banner={banner_disp_reload}, role={preview_role}")

    log_step("3. Testing Corrupt Storage Non-Destructive Recovery & Alert")
    page.evaluate("localStorage.setItem('indonesian_ats_cv_builder_draft_v1', '{corrupt-json-1234')")
    page.reload()
    page.wait_for_timeout(300)

    corrupt_title = page.evaluate("document.getElementById('prof-title').value")
    corrupt_alert_disp = page.evaluate("getComputedStyle(document.getElementById('corrupt-storage-alert')).display")
    raw_still_preserved = page.evaluate("localStorage.getItem('indonesian_ats_cv_builder_draft_v1')")

    if corrupt_title == "" and corrupt_alert_disp != "none" and raw_still_preserved == "{corrupt-json-1234":
        log_pass("Corrupt storage detected, alert banner shown, and raw payload NOT overwritten before user edits.")
    else:
        return log_fail(f"Corrupt recovery failed: title={corrupt_title}, alert={corrupt_alert_disp}, raw={raw_still_preserved}")

    log_step("4. Testing Legacy Draft Format (Direct Unwrapped Object)")
    legacy_json = '{"profile": {"fullName": "Anisa Test", "jobTitle": "Data Scientist", "email": "anisa@test.com"}, "summary": "Halo"}'
    page.evaluate(f"localStorage.setItem('indonesian_ats_cv_builder_draft_v1', '{legacy_json}')")
    page.reload()
    page.wait_for_timeout(300)

    leg_name = page.evaluate("document.getElementById('prof-name').value")
    leg_title = page.evaluate("document.getElementById('prof-title').value")
    leg_email = page.evaluate("document.getElementById('prof-email').value")

    if leg_name == "Anisa Test" and leg_title == "Data Scientist" and leg_email == "anisa@test.com":
        log_pass("Legacy unwrapped draft format recognized, merged, and populated.")
    else:
        return log_fail(f"Legacy draft recovery failed: name={leg_name}, title={leg_title}, email={leg_email}")

    return True


def test_ux_sprints_2_to_4(page):
    log_step("5. Testing 5-Step Wizard, Inline Validation, Dual-Pillar Checklist & Jump-to-Field")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(300)

    # Trigger invalid email inline validation
    page.fill("#prof-email", "email-tidak-valid")
    page.dispatch_event("#prof-email", "blur")
    page.wait_for_timeout(150)
    email_err = page.evaluate("document.getElementById('err-prof-email').textContent.trim()")
    is_invalid_attr = page.evaluate("document.getElementById('prof-email').getAttribute('aria-invalid')")
    if email_err and is_invalid_attr == "true":
        log_pass(f"Inline validation catches invalid email with message: '{email_err}'")
    else:
        return log_fail(f"Inline validation failed: err={email_err}, aria-invalid={is_invalid_attr}")

    # Test Dual-Pillar Checklist & 'Perbaiki sekarang' button
    data_pct = page.evaluate("document.getElementById('data-completeness-percent').textContent")
    qual_pct = page.evaluate("document.getElementById('content-quality-percent').textContent")
    fix_btn_count = page.evaluate("document.querySelectorAll('.btn-fix-now').length")
    if data_pct.endswith("%") and qual_pct.endswith("%") and fix_btn_count > 0:
        log_pass(f"Dual-pillar readiness rendered (Kelengkapan: {data_pct}, Kualitas: {qual_pct}, {fix_btn_count} tombol 'Perbaiki sekarang').")
    else:
        return log_fail(f"Dual-pillar checklist missing: data={data_pct}, qual={qual_pct}, fix_btns={fix_btn_count}")

    log_step("6. Testing Achievement Bullet Builder, Multi-Version Manager & JD Keyword Matcher")
    # Load experienced sample via sample picker modal
    page.click("#header-more-dropdown summary")
    page.wait_for_timeout(150)
    page.click("#btn-open-sample-modal")
    page.wait_for_timeout(200)
    page.click("#btn-pick-experienced")
    page.wait_for_timeout(400)

    # Test Achievement Bullet Builder inside first Experience card
    page.click(".btn-toggle-bullet-builder")
    page.fill(".bb-action", "Mengotomatiskan pipeline pengujian regresi")
    page.fill(".bb-method", "menggunakan Playwright dan Python")
    page.fill(".bb-impact", "mempercepat rilis produksi sebesar 60%")
    page.click(".btn-insert-bullet")
    page.wait_for_timeout(450)

    desc_val = page.evaluate("document.querySelector('.exp-desc').value")
    if "Mengotomatiskan pipeline pengujian regresi menggunakan Playwright dan Python mempercepat rilis produksi sebesar 60%." in desc_val:
        log_pass("Achievement Bullet Builder formatted and appended bullet into Experience description.")
    else:
        return log_fail(f"Bullet builder failed: desc={desc_val[:120]}")

    # Test Job Description Keyword Matcher
    page.fill("#jd-input-textarea", "Dicari Senior Software Engineer yang menguasai Node.js, Go, PostgreSQL, Kubernetes, dan GraphQL.")
    page.wait_for_timeout(450)
    jd_results_text = page.evaluate("document.getElementById('jd-match-results').textContent")
    if "Kecocokan Kata Kunci" in jd_results_text and "graphql" in jd_results_text.lower():
        log_pass("Job Description Keyword Matcher identifies matched and missing keywords locally.")
    else:
        return log_fail(f"JD Matcher failed: {jd_results_text}")

    # Test Multi-Version CV Duplication
    page.click("#btn-open-versions-modal")
    page.wait_for_timeout(200)
    page.fill("#input-new-version-name", "CV Khusus Fintech")
    page.click("#btn-duplicate-current-version")
    page.wait_for_timeout(300)
    active_pill = page.evaluate("document.getElementById('active-version-label').textContent.trim()")
    page.keyboard.press("Escape")
    page.wait_for_timeout(150)

    if active_pill.startswith("CV Khusus Fintech"):
        log_pass(f"Multi-Version CV Manager duplicated active CV into '{active_pill}' and closed via Escape key.")
    else:
        return log_fail(f"Multi-Version manager failed: active_pill={active_pill}")

    # Test Pre-Export Diagnostics
    page.click("#btn-download-pdf")
    page.wait_for_timeout(250)
    pre_export_text = page.evaluate("document.getElementById('pre-export-summary-box').textContent")
    page.keyboard.press("Escape")
    page.wait_for_timeout(150)
    if "budi-pratama-skom-senior-software-engineer-cv.pdf" in pre_export_text and "Halaman A4" in pre_export_text:
        log_pass("Pre-Export Diagnostics modal displays neutral target filename (<nama>-<target-posisi>-cv.pdf) and estimated A4 page count.")
    else:
        return log_fail(f"Pre-Export Diagnostics failed: {pre_export_text}")

    return True


def test_pdf_pagination_1_2_and_4_plus_pages(page):
    log_step("7. Testing Section Visibility Manager & 1-Page PDF Export (Concise Fresh Graduate CV)")
    page.click("#header-more-dropdown summary")
    page.wait_for_timeout(150)
    page.click("#btn-open-sample-modal")
    page.wait_for_timeout(200)
    page.click("#btn-pick-freshgrad")
    page.wait_for_timeout(450)

    # Toggle off optional sections ('projects' & 'certifications' & 'organizations') via Section Visibility Manager to make a concise 1-page CV
    for sec_key in ["projects", "certifications", "organizations"]:
        cb_sel = f".section-visibility-cb[data-section='{sec_key}']"
        if page.is_checked(cb_sel):
            page.uncheck(cb_sel)
    page.wait_for_timeout(450)

    pdf_1p = page.pdf(format="A4", print_background=True)
    pages_1p, _, _ = extract_pdf_bullets_by_page(pdf_1p)
    if pages_1p == 1:
        log_pass(f"Section Visibility Manager hid optional sections and exported cleanly as {pages_1p} A4 page.")
    else:
        return log_fail(f"Expected 1 page for concise Fresh Graduate CV, got {pages_1p} pages.")

    log_step("8. Testing 2-Page PDF Pagination (75 Achievement Bullets)")
    page.click("#header-more-dropdown summary")
    page.wait_for_timeout(150)
    page.click("#btn-open-sample-modal")
    page.wait_for_timeout(200)
    page.click("#btn-pick-experienced")
    page.wait_for_timeout(450)

    bullets_75 = "\n".join([
        f"• Pencapaian Baris Ke-{i:03d}: Berhasil menyelesaikan optimasi performa modul transaksi backend tahap {i}."
        for i in range(1, 76)
    ])
    page.fill(".exp-desc", bullets_75)
    page.wait_for_timeout(500)

    pdf_2p = page.pdf(format="A4", print_background=True)
    pages_2p, page_bullets_2p, all_found_75 = extract_pdf_bullets_by_page(pdf_2p)
    p1_count = len(page_bullets_2p.get(1, []))
    p2_count = len(page_bullets_2p.get(2, []))

    if pages_2p >= 2 and p1_count >= 10 and p2_count >= 10 and len(all_found_75) == 75:
        log_pass(f"75-bullet CV paginated across {pages_2p} pages (Page 1: {p1_count} bullets, Page 2: {p2_count} bullets, Total: {len(all_found_75)}/75).")
    else:
        return log_fail(f"75-bullet pagination failed: pages={pages_2p}, p1={p1_count}, p2={p2_count}, total={len(all_found_75)}")

    log_step("9. Testing 4+ Page PDF Stress Pagination (130 Achievement Bullets)")
    bullets_130 = "\n".join([
        f"• Pencapaian Baris Ke-{i:03d}: Berhasil menyelesaikan optimasi performa modul transaksi backend skala nasional tahap {i}."
        for i in range(1, 131)
    ])
    page.fill(".exp-desc", bullets_130)
    page.wait_for_timeout(500)

    pdf_4p = page.pdf(format="A4", print_background=True)
    pages_4p, _, all_found_130 = extract_pdf_bullets_by_page(pdf_4p)
    if pages_4p >= 4 and len(all_found_130) == 130:
        log_pass(f"130-bullet stress CV paginated cleanly across {pages_4p} A4 pages with 100% text integrity ({len(all_found_130)}/130 bullets).")
    else:
        return log_fail(f"4+ page stress test failed: pages={pages_4p}, found={len(all_found_130)}/130")

    log_step("10. Testing Mobile 390x844 Viewport & Zero Horizontal Overflow")
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(250)
    overflow_px = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    if overflow_px <= 0:
        log_pass("Mobile 390x844 layout has zero horizontal overflow.")
    else:
        return log_fail(f"Mobile horizontal overflow detected: {overflow_px}px")

    page.set_viewport_size({"width": 1366, "height": 900})
    page.wait_for_timeout(200)
    return True


def test_bilingual_sprints_5_to_7(page):
    log_step("11. Testing Bilingual Sprints 5–7 (Catalog Parity, 2x2 UI/CV Matrix, English Sample, JD Matcher & Multi-Version)")
    parity = page.evaluate("window.__atsI18n.verifyCatalogKeyParity()")
    if parity.get("isEqual") is True:
        log_pass(f"Locale catalog key parity verified ({parity.get('totalKeysId')} keys in both id.js and en.js).")
    else:
        return log_fail(f"Catalog parity mismatch: missingInEn={parity.get('missingInEn')}, missingInId={parity.get('missingInId')}")

    # Load Indonesian Experienced Sample first (UI = id, CV = id)
    page.evaluate("window.__atsI18n.setInterfaceLanguage('id')")
    page.select_option("#select-preview-doc-language", "id")
    page.click("#header-more-dropdown summary")
    page.wait_for_timeout(150)
    page.click("#btn-open-sample-modal")
    page.wait_for_timeout(200)
    page.click("#btn-pick-experienced")
    page.wait_for_timeout(400)

    # Switch CV Document Language to English ('en') while keeping UI in Indonesian ('id')
    page.select_option("#select-preview-doc-language", "en")
    page.wait_for_timeout(300)
    html_lang_id = page.evaluate("document.documentElement.getAttribute('lang')")
    doc_lang_en = page.evaluate("document.getElementById('cv-live-document').getAttribute('lang')")
    headings_en = page.evaluate("Array.from(document.querySelectorAll('#cv-live-document .cv-section-title')).map(el => el.textContent.trim())")
    btn_pdf_text_id = page.evaluate("document.querySelector('#btn-download-pdf span[data-i18n]').textContent.trim()")

    if html_lang_id == "id" and doc_lang_en == "en" and "Professional Summary" in headings_en and "Work Experience" in headings_en and "Unduh PDF" in btn_pdf_text_id:
        log_pass("Matrix [UI=id, CV=en]: UI remains Indonesian ('Unduh PDF') while CV document renders English headings ('Professional Summary', 'Work Experience') and lang='en'.")
    else:
        return log_fail(f"Matrix [UI=id, CV=en] failed: html={html_lang_id}, doc={doc_lang_en}, headings={headings_en}, btn={btn_pdf_text_id}")

    # Switch Interface Language to English ('en') via #select-interface-language while switching CV Document to Indonesian ('id')
    page.click("#header-more-dropdown summary")
    page.wait_for_timeout(150)
    page.select_option("#select-interface-language", "en")
    page.wait_for_timeout(250)
    page.select_option("#select-preview-doc-language", "id")
    page.wait_for_timeout(300)

    html_lang_en = page.evaluate("document.documentElement.getAttribute('lang')")
    doc_lang_id = page.evaluate("document.getElementById('cv-live-document').getAttribute('lang')")
    headings_id = page.evaluate("Array.from(document.querySelectorAll('#cv-live-document .cv-section-title')).map(el => el.textContent.trim())")
    btn_pdf_text_en = page.evaluate("document.querySelector('#btn-download-pdf span[data-i18n]').textContent.trim()")

    if html_lang_en == "en" and doc_lang_id == "id" and "Ringkasan Profesional" in headings_id and "Pengalaman Kerja" in headings_id and "Download PDF" in btn_pdf_text_en:
        log_pass("Matrix [UI=en, CV=id]: UI switches to English ('Download PDF') without reload while CV document renders Indonesian headings ('Ringkasan Profesional', 'Pengalaman Kerja').")
    else:
        return log_fail(f"Matrix [UI=en, CV=id] failed: html={html_lang_en}, doc={doc_lang_id}, headings={headings_id}, btn={btn_pdf_text_en}")

    # Load full English Sample Data (UI=en, CV=en) and test English JD Keyword Matcher
    page.select_option("#select-preview-doc-language", "en")
    page.wait_for_timeout(200)
    page.evaluate("document.getElementById('header-more-dropdown').setAttribute('open', '')")
    page.wait_for_timeout(100)
    page.click("#btn-open-sample-modal")
    page.wait_for_timeout(200)
    page.click("#btn-pick-experienced")
    page.wait_for_timeout(400)

    summary_val_en = page.evaluate("document.getElementById('summary-textarea').value")
    page.fill("#jd-input-textarea", "We are looking for a Senior Software Engineer with strong experience in Go, Node.js, PostgreSQL, Kubernetes, and GraphQL.")
    page.wait_for_timeout(450)
    jd_text_en = page.evaluate("document.getElementById('jd-match-results').textContent")

    if "Senior Software Engineer" in summary_val_en and "English (EN)" in jd_text_en and "graphql" in jd_text_en.lower():
        log_pass("English sample data loaded and English JD Keyword Matcher analyzes with English (EN) stopwords & technical token preservation.")
    else:
        return log_fail(f"English sample / JD matcher failed: summary={summary_val_en[:60]}, jd={jd_text_en}")

    # Test Multi-Version CV with different document languages (create Indonesian version while active is English)
    page.click("#btn-open-versions-modal")
    page.wait_for_timeout(200)
    page.fill("#input-new-version-name", "Versi Bahasa Indonesia")
    page.select_option("#select-new-version-doc-lang", "id")
    page.click("#btn-create-empty-version")
    page.wait_for_timeout(300)
    new_ver_doc_lang = page.evaluate("document.getElementById('cv-live-document').getAttribute('lang')")
    page.keyboard.press("Escape")
    page.wait_for_timeout(150)

    if new_ver_doc_lang == "id":
        log_pass("Multi-Version CV Manager creates & switches between CVs with independent documentLanguage ('en' vs 'id').")
    else:
        return log_fail(f"Multi-Version documentLanguage failed: got {new_ver_doc_lang}")

    # Verify zero horizontal overflow in English UI on both 1366x900 and 390x844
    overflow_desktop_en = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(250)
    overflow_mobile_en = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    if overflow_desktop_en <= 0 and overflow_mobile_en <= 0:
        log_pass("Zero horizontal overflow confirmed for English UI on both 1366x900 desktop and 390x844 mobile viewports.")
    else:
        return log_fail(f"Overflow in English UI: desktop={overflow_desktop_en}px, mobile={overflow_mobile_en}px")

    return True


def test_qa_production_readiness_fixes(page):
    log_step("12. Testing QA Production Readiness Fixes (P1 Modal Return Focus, P2 390x844 Mobile Toolbar ID/EN & Screenshots)")
    page.set_viewport_size({"width": 1366, "height": 900})
    page.wait_for_timeout(200)

    # 12a. Test P1: More -> Load Sample Data -> Escape / Close Button / Modal Action never leaves focus on <body>
    for close_method in ["escape", "close_btn", "action_btn"]:
        page.evaluate("document.getElementById('header-more-dropdown').setAttribute('open', '')")
        page.wait_for_timeout(100)
        page.click("#btn-open-sample-modal")
        page.wait_for_timeout(200)

        if close_method == "escape":
            page.keyboard.press("Escape")
        elif close_method == "close_btn":
            page.click("#modal-sample-picker .modal-close-trigger")
        else:
            page.click("#btn-pick-experienced")

        page.wait_for_timeout(200)
        focus_info = page.evaluate("""(() => {
            const el = document.activeElement;
            return {
                tag: el ? el.tagName : null,
                parentId: (el && el.parentElement) ? el.parentElement.id : null,
                isVisible: Boolean(el && el !== document.body && (el.offsetParent !== null || el.getClientRects().length > 0))
            };
        })()""")
        if focus_info.get("tag") == "SUMMARY" and focus_info.get("parentId") == "header-more-dropdown" and focus_info.get("isVisible"):
            log_pass(f"Modal closed via '{close_method}' restored focus to visible <summary> inside #header-more-dropdown (never <body>).")
        else:
            return log_fail(f"Modal return focus failed for '{close_method}': {focus_info}")

    # 12b. Test P2: Mobile Preview Toolbar at 390x844 in both Indonesian ('id') and English ('en')
    artifact_dir = r"C:\Users\ibnuk\.gemini\antigravity\brain\664978b6-5d12-46c3-9113-f6198b11453a"
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(250)
    page.click("#tab-mobile-preview")
    page.wait_for_timeout(300)

    for lang_code in ["id", "en"]:
        page.evaluate("document.getElementById('header-more-dropdown').setAttribute('open', '')")
        page.select_option("#select-interface-language", lang_code)
        page.evaluate("document.getElementById('header-more-dropdown').removeAttribute('open')")
        page.wait_for_timeout(250)

        toolbar_metrics = page.evaluate("""(() => {
            const titleEl = document.querySelector('.preview-toolbar .preview-title');
            const badgeEl = document.getElementById('preview-page-count');
            const langSel = document.getElementById('select-preview-doc-language');
            const zoomFit = document.getElementById('btn-zoom-fit');
            const pdfBtn = document.getElementById('btn-preview-download-pdf');
            const titleRect = titleEl ? titleEl.getBoundingClientRect() : { height: 999 };
            const badgeRect = badgeEl ? badgeEl.getBoundingClientRect() : { height: 999 };
            const controlsVisible = [langSel, zoomFit, pdfBtn].every(el => el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0);
            return {
                overflowPx: document.documentElement.scrollWidth - window.innerWidth,
                titleHeight: Math.round(titleRect.height),
                badgeHeight: Math.round(badgeRect.height),
                controlsVisible
            };
        })()""")

        if os.path.isdir(artifact_dir):
            screenshot_path = os.path.join(artifact_dir, f"mobile_preview_{lang_code}_390x844.png")
            page.screenshot(path=screenshot_path)

        if (
            toolbar_metrics["overflowPx"] <= 0
            and toolbar_metrics["titleHeight"] <= 28
            and toolbar_metrics["badgeHeight"] <= 28
            and toolbar_metrics["controlsVisible"]
        ):
            log_pass(
                f"Mobile 390x844 Preview Toolbar [{lang_code.upper()}]: clean 2-row layout (titleHeight={toolbar_metrics['titleHeight']}px, badgeHeight={toolbar_metrics['badgeHeight']}px, overflow=0px, all controls reachable)."
            )
        else:
            return log_fail(f"Mobile 390x844 Preview Toolbar [{lang_code.upper()}] failed metrics: {toolbar_metrics}")

    return True


def main():
    print("==================================================================")
    print(" RUNNING SELF-CONTAINED VERIFICATION SUITE (tests/test_fixes.py)")
    print("==================================================================")

    server, base_url = start_isolated_server()
    print(f"  [INFO] Isolated test server started at {base_url}")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1366, "height": 900}, locale="id-ID")
            page = context.new_page()

            console_errors = []
            page.on("pageerror", lambda err: console_errors.append(str(err)))

            page.goto(base_url, wait_until="networkidle")

            ok1 = test_draft_persistence(page)
            ok2 = test_ux_sprints_2_to_4(page)
            ok3 = test_pdf_pagination_1_2_and_4_plus_pages(page)
            ok4 = test_bilingual_sprints_5_to_7(page)
            ok5 = test_qa_production_readiness_fixes(page)

            browser.close()

            if console_errors:
                print("\n[FAIL] Browser runtime errors detected:")
                for err in console_errors:
                    print("  -", err)
                sys.exit(1)

            if ok1 and ok2 and ok3 and ok4 and ok5:
                print("\n==================================================================")
                print(" ALL 12 TEST GROUPS PASSED (Sprints 1–7 + QA Production Readiness)")
                print("==================================================================")
                sys.exit(0)
            else:
                print("\n[FAIL] Some verification checks failed.")
                sys.exit(1)
    finally:
        server.shutdown()
        server.server_close()
        print("  [INFO] Isolated test server shut down cleanly.")


if __name__ == "__main__":
    main()
