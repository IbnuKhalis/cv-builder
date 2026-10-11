"""
Audit Regression Suite for Indonesian ATS CV Builder.
Verifies fixes for Codex Audit Findings (F1 to F6):
  F1: Storage Quota Failure Atomic Propagation & Status Reporting
  F2: Flush Autosave on Fast Switch & Rapid Reload
  F3: Deep Sanitization for Malformed JSON Imports (No Startup Crash)
  F4: Cross-Tab Storage Synchronization & Multi-Tab Edit Preservation
  F5: Reset CV Clears Active Version in Collections
  F6: Full Backup Export and Restoration of All Versions
"""

import importlib.util
import json
import os
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')

# Import isolated test server from test_fixes
spec = importlib.util.spec_from_file_location("test_fixes", PROJECT_ROOT / "tests" / "test_fixes.py")
test_fixes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(test_fixes)
start_isolated_server = test_fixes.start_isolated_server

from playwright.sync_api import sync_playwright

def log_test(name):
    print(f"\n[AUDIT TEST] {name}")

def log_pass(msg):
    print(f"  [PASS] {msg}")

def log_fail(msg):
    print(f"  [FAIL] {msg}")
    return False

def run_all_audit_tests():
    server, base_url = start_isolated_server()
    print(f"  [INFO] Isolated audit test server started at {base_url}")
    failures = 0

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)

            def make_page():
                context = browser.new_context(locale="id-ID", viewport={"width": 1366, "height": 900})
                page = context.new_page()
                page.goto(base_url, wait_until="networkidle")
                return context, page

            # ==============================================================
            # F1: Storage Quota Failure Atomic Propagation & Status Reporting
            # ==============================================================
            log_test("F1: Storage Quota Failure Atomic Propagation & Status Reporting")
            context, page = make_page()
            f1_result = page.evaluate("""async () => {
                const s = await import('/js/storage.js');
                const { defaultEmptyCV } = await import('/js/data.js');
                const original = structuredClone(defaultEmptyCV);
                original.profile.fullName = 'Audit Original';
                s.saveCVToStorage(original);
                s.loadCVVersions(original);

                const changed = structuredClone(original);
                changed.profile.fullName = 'Audit Changed';

                const realSet = Storage.prototype.setItem;
                Storage.prototype.setItem = function(key, value) {
                    if (key === s.VERSIONS_KEY) {
                        throw new DOMException('Simulated quota exceeded for versions collection', 'QuotaExceededError');
                    }
                    return realSet.call(this, key, value);
                };

                let saved;
                try {
                    saved = s.saveCVToStorage(changed);
                } finally {
                    Storage.prototype.setItem = realSet;
                }

                return {
                    saved,
                    status: s.getStorageStatus(),
                    draftName: s.loadCVFromStorage().profile.fullName,
                    versionName: s.loadCVVersions()[0].data.profile.fullName
                };
            }""")
            context.close()

            if f1_result["saved"] is False and f1_result["status"] == "save_error":
                log_pass("saveCVToStorage correctly returned false and recorded status 'save_error'.")
            else:
                log_fail(f"F1 failed: expected saved=False, status='save_error', got {f1_result}")
                failures += 1

            if f1_result["draftName"] == "Audit Original":
                log_pass("Draft rolled back to 'Audit Original' consistently when versions collection write failed.")
            else:
                log_fail(f"F1 rollback failed: draftName={f1_result['draftName']}")
                failures += 1

            # ==============================================================
            # F2: Flush Autosave on Fast Switch & Rapid Reload
            # ==============================================================
            log_test("F2: Flush Autosave on Fast Switch & Rapid Reload")
            context, page = make_page()
            page.fill('#prof-name', 'Audit Version A')
            page.wait_for_timeout(450)
            page.click('#btn-open-versions-modal')
            page.fill('#input-new-version-name', 'Audit Version B')
            page.click('#btn-create-empty-version')
            page.keyboard.press('Escape')
            page.click('#btn-open-versions-modal')

            # Fast switch before 350ms debounce
            page.evaluate("""() => {
                const field = document.getElementById('prof-name');
                field.value = 'Audit Unsaved B';
                field.dispatchEvent(new Event('input', { bubbles: true }));
                document.querySelector('.btn-switch-version').click();
            }""")
            page.wait_for_timeout(450)

            versions_after_fast_switch = page.evaluate("""() => {
                const raw = localStorage.getItem('indonesian_ats_cv_builder_versions_v1');
                return JSON.parse(raw).items.map(v => ({ name: v.name, fullName: v.data.profile.fullName }));
            }""")
            context.close()

            version_b = next((v for v in versions_after_fast_switch if v["name"] == "Audit Version B"), None)
            if version_b and version_b["fullName"] == "Audit Unsaved B":
                log_pass("Fast version switch flushed pending debounce; Version B persisted 'Audit Unsaved B'.")
            else:
                log_fail(f"F2 fast switch failed: {versions_after_fast_switch}")
                failures += 1

            # Rapid reload test before 350ms debounce
            context, page = make_page()
            page.evaluate("""() => {
                const f = document.getElementById('prof-name');
                f.value = 'Audit Rapid Reload';
                f.dispatchEvent(new Event('input', { bubbles: true }));
            }""")
            page.reload(wait_until="networkidle")
            name_after_reload = page.input_value('#prof-name')
            context.close()

            if name_after_reload == "Audit Rapid Reload":
                log_pass("Rapid reload flushed pending debounce via page lifecycle; 'Audit Rapid Reload' preserved.")
            else:
                log_fail(f"F2 rapid reload failed: expected 'Audit Rapid Reload', got '{name_after_reload}'")
                failures += 1

            # ==============================================================
            # F3: Deep Sanitization for Malformed JSON Imports
            # ==============================================================
            log_test("F3: Deep Sanitization for Malformed JSON Imports (No Startup Crash)")
            context, page = make_page()
            page_errors = []
            page.on("pageerror", lambda err: page_errors.append(str(err)))

            malformed_payload = {
                "profile": {"fullName": "Audit Malformed Import"},
                "experience": [None, {"role": "Tester", "startDate": None}]
            }
            page.locator('#input-import-json').set_input_files({
                "name": "audit-malformed.json",
                "mimeType": "application/json",
                "buffer": json.dumps(malformed_payload).encode("utf-8")
            })
            page.wait_for_timeout(450)
            persisted_experience = page.evaluate("""() => {
                const raw = localStorage.getItem('indonesian_ats_cv_builder_draft_v1');
                return JSON.parse(raw).data.experience;
            }""")
            # Reload to test startup resilience
            page.reload(wait_until="networkidle")
            name_on_startup = page.input_value('#prof-name')
            context.close()

            if len(page_errors) == 0:
                log_pass("Zero runtime page errors during import and subsequent reload of malformed payload.")
            else:
                log_fail(f"F3 errors detected: {page_errors}")
                failures += 1

            if name_on_startup == "Audit Malformed Import" and isinstance(persisted_experience, list):
                log_pass("Malformed array items cleaned; valid fields populated smoothly.")
            else:
                log_fail(f"F3 data check failed: name={name_on_startup}, exp={persisted_experience}")
                failures += 1

            # ==============================================================
            # F4: Cross-Tab Storage Synchronization & Multi-Tab Edit Preservation
            # ==============================================================
            log_test("F4: Cross-Tab Storage Synchronization & Multi-Tab Edit Preservation")
            context = browser.new_context(locale="id-ID", viewport={"width": 1366, "height": 900})
            tab_a = context.new_page()
            tab_a.goto(base_url, wait_until="networkidle")
            tab_a.fill('#prof-name', 'Audit Shared Candidate')
            tab_a.wait_for_timeout(450)

            tab_b = context.new_page()
            tab_b.goto(base_url, wait_until="networkidle")

            # Tab A saves email
            tab_a.fill('#prof-email', 'audit@example.invalid')
            tab_a.wait_for_timeout(450)

            # Tab B saves title while receiving storage sync
            tab_b.fill('#prof-title', 'Audit Stale Tab')
            tab_b.wait_for_timeout(450)

            final_draft_profile = tab_b.evaluate("""() => {
                const raw = localStorage.getItem('indonesian_ats_cv_builder_draft_v1');
                return JSON.parse(raw).data.profile;
            }""")
            context.close()

            if final_draft_profile.get("email") == "audit@example.invalid" and final_draft_profile.get("jobTitle") == "Audit Stale Tab":
                log_pass("Cross-tab edit preserved: Tab A email and Tab B title both intact in storage.")
            else:
                log_fail(f"F4 clobber detected: profile={final_draft_profile}")
                failures += 1

            # ==============================================================
            # F5: Reset CV Clears Active Version in Collections
            # ==============================================================
            log_test("F5: Reset CV Clears Active Version in Collections")
            context, page = make_page()
            page.fill('#prof-name', 'Audit First CV')
            page.wait_for_timeout(450)
            page.click('#btn-open-versions-modal')
            page.fill('#input-new-version-name', 'Audit Second CV')
            page.click('#btn-create-empty-version')
            page.keyboard.press('Escape')

            page.fill('#prof-name', 'Audit Reset Victim B')
            page.wait_for_timeout(450)

            # Confirm reset
            page.evaluate("document.getElementById('btn-reset-cv').click()")
            page.click('#btn-confirm-reset-action')
            page.wait_for_timeout(300)

            reset_check = page.evaluate("""() => {
                const formName = document.getElementById('prof-name').value;
                const draftRaw = localStorage.getItem('indonesian_ats_cv_builder_draft_v1');
                const versionsRaw = localStorage.getItem('indonesian_ats_cv_builder_versions_v1');
                const draftName = JSON.parse(draftRaw).data.profile.fullName;
                const versions = JSON.parse(versionsRaw).items.map(v => ({ name: v.name, fullName: v.data.profile.fullName }));
                return { formName, draftName, versions };
            }""")
            context.close()

            second_cv_after_reset = next((v for v in reset_check["versions"] if v["name"] == "Audit Second CV"), None)
            first_cv_preserved = next((v for v in reset_check["versions"] if v["name"] != "Audit Second CV"), None)

            if reset_check["formName"] == "" and second_cv_after_reset and second_cv_after_reset["fullName"] == "":
                log_pass("Active version B data reset to empty in both editor form and versions collection.")
            else:
                log_fail(f"F5 reset check failed: {reset_check}")
                failures += 1

            if first_cv_preserved and first_cv_preserved["fullName"] == "Audit First CV":
                log_pass("Other CV versions (Version A) preserved untouched during reset.")
            else:
                log_fail(f"F5 isolation failed: first_cv={first_cv_preserved}")
                failures += 1

            # ==============================================================
            # F6: Full Backup Export and Restoration of All Versions
            # ==============================================================
            log_test("F6: Full Backup Export and Restoration of All Versions")
            context, page = make_page()
            page.fill('#prof-name', 'Candidate Alpha')
            page.wait_for_timeout(450)
            page.click('#btn-open-versions-modal')
            page.fill('#input-new-version-name', 'Candidate Beta Version')
            page.click('#btn-create-empty-version')
            page.keyboard.press('Escape')
            page.fill('#prof-name', 'Candidate Beta')
            page.wait_for_timeout(450)

            # Export full backup
            with page.expect_download() as download_info:
                page.evaluate("document.getElementById('header-more-dropdown').open = true")
                page.click('#btn-export-full-backup')
            download = download_info.value
            backup_path = PROJECT_ROOT / "test-results" / "test-full-backup.json"
            download.save_as(backup_path)

            backup_data = json.loads(backup_path.read_text(encoding="utf-8"))
            if backup_data.get("type") == "indonesian_ats_cv_builder_full_backup" and len(backup_data.get("versions", [])) >= 2:
                log_pass("Full backup contains indonesian_ats_cv_builder_full_backup type and all versions.")
            else:
                log_fail(f"F6 backup data invalid: {backup_data}")
                failures += 1

            # Clear storage or tamper
            page.evaluate("localStorage.clear()")
            page.reload(wait_until="networkidle")

            # Restore full backup
            page.locator('#input-import-json').set_input_files(str(backup_path))
            page.wait_for_timeout(450)

            restored_versions_count = page.evaluate("""() => {
                const raw = localStorage.getItem('indonesian_ats_cv_builder_versions_v1');
                return raw ? JSON.parse(raw).items.length : 0;
            }""")
            restored_name = page.input_value('#prof-name')
            context.close()

            if restored_versions_count >= 2 and restored_name in ("Candidate Alpha", "Candidate Beta"):
                log_pass(f"Full backup restored successfully with {restored_versions_count} versions and active CV intact.")
            else:
                log_fail(f"F6 restoration failed: count={restored_versions_count}, name='{restored_name}'")
                failures += 1

            # ==============================================================
            # R1: Sanitizer Field Contract Preservation & Sample UI Reload
            # ==============================================================
            log_test("R1: Sanitizer Field Contract Preservation & Sample UI Reload")
            context, page = make_page()
            r1_norm = page.evaluate("""async () => {
                const s = await import('/js/storage.js?v=0.2.0');
                const d = await import('/js/data.js?v=0.2.0');
                const n = s.mergeWithDefaults(d.sampleDataExperienced, d.defaultEmptyCV);
                const snapshot = x => ({
                    institution: x.education[0].institution,
                    projectTitle: x.projects[0].title,
                    projectTech: x.projects[0].tech,
                    certYear: x.certifications[0].year,
                    certUrl: x.certifications[0].credentialUrl,
                    isCurrent: x.experience[0].isCurrent
                });
                return { before: snapshot(d.sampleDataExperienced), after: snapshot(n) };
            }""")
            if r1_norm["before"] == r1_norm["after"]:
                log_pass("mergeWithDefaults preserved 100% of canonical fields (institution, projectTitle, tech, certYear, certUrl, isCurrent).")
            else:
                log_fail(f"R1 normalization mismatch: {r1_norm}")
                failures += 1

            page.click('#btn-starter-experienced')
            page.reload(wait_until='networkidle')
            r1_ui = {
                'institution': page.locator('.edu-institution').first.input_value() if page.locator('.edu-institution').count() else '',
                'project_title': page.locator('.proj-title').first.input_value() if page.locator('.proj-title').count() else '',
                'cert_year': page.locator('.cert-year').first.input_value() if page.locator('.cert-year').count() else ''
            }
            context.close()
            if r1_ui['institution'] and r1_ui['project_title'] and r1_ui['cert_year']:
                log_pass(f"Sample reload preserved UI fields: inst='{r1_ui['institution']}', proj='{r1_ui['project_title']}', cert='{r1_ui['cert_year']}'.")
            else:
                log_fail(f"R1 sample UI reload fields missing: {r1_ui}")
                failures += 1

            # ==============================================================
            # R2: Idle Tab Autosave State & Cross-Tab Overwrite Protection
            # ==============================================================
            log_test("R2: Idle Tab Autosave State & Cross-Tab Overwrite Protection")
            context, tab_a = make_page()
            tab_a.fill('#prof-name', 'Shared Review Candidate')
            tab_a.wait_for_timeout(450)
            tab_b = context.new_page()
            tab_b.goto(base_url, wait_until='networkidle')
            tab_b.fill('#summary-textarea', 'Initial Summary from B')
            tab_b.wait_for_timeout(450)
            tab_a.fill('#summary-textarea', 'Latest Summary from A')
            tab_a.wait_for_timeout(450)
            summary_before = tab_b.input_value('#summary-textarea')
            tab_b.fill('#prof-title', 'Tech Lead from B')
            tab_b.wait_for_timeout(450)
            final_summary = tab_b.evaluate("JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_draft_v1')).data.summary")
            context.close()
            if summary_before == 'Latest Summary from A' and final_summary == 'Latest Summary from A':
                log_pass("Idle Tab B accepted external update from Tab A and did not revert summary on subsequent edit.")
            else:
                log_fail(f"R2 multi-tab overwrite occurred: before='{summary_before}', final='{final_summary}'")
                failures += 1

            # ==============================================================
            # R3: Abort Version Switch When Flush Autosave Fails
            # ==============================================================
            log_test("R3: Abort Version Switch When Flush Autosave Fails")
            context, page = make_page()
            page.fill('#prof-name', 'Version A Original')
            page.wait_for_timeout(450)
            page.click('#btn-open-versions-modal')
            page.fill('#input-new-version-name', 'Version B')
            page.click('#btn-create-empty-version')
            page.keyboard.press('Escape')
            page.fill('#prof-name', 'Version B Original')
            page.wait_for_timeout(450)
            page.click('#btn-open-versions-modal')

            r3_result = page.evaluate("""async () => {
                const s = await import('/js/storage.js?v=0.2.0');
                const real = Storage.prototype.setItem;
                Storage.prototype.setItem = function(k, v) {
                    if (k === s.VERSIONS_KEY) throw new DOMException('simulated quota', 'QuotaExceededError');
                    return real.call(this, k, v);
                };
                const field = document.getElementById('prof-name');
                field.value = 'Version B UNSAVED';
                field.dispatchEvent(new Event('input', { bubbles: true }));
                document.querySelector('.btn-switch-version').click();
                Storage.prototype.setItem = real;
                return {
                    formName: field.value,
                    activeId: s.getActiveVersionId()
                };
            }""")
            context.close()
            if r3_result["formName"] == "Version B UNSAVED":
                log_pass("Version switch correctly aborted on flush quota failure; in-memory edit preserved.")
            else:
                log_fail(f"R3 version switch overwrote unsaved edit: {r3_result}")
                failures += 1

            # ==============================================================
            # R4: Restore Backup Atomic Rollback on Draft Storage Failure
            # ==============================================================
            log_test("R4: Restore Backup Atomic Rollback on Draft Storage Failure")
            context, page = make_page()
            page.fill('#prof-name', 'Original Healthy CV')
            page.wait_for_timeout(450)
            r4_result = page.evaluate("""async () => {
                const s = await import('/js/storage.js?v=0.2.0');
                const d = await import('/js/data.js?v=0.2.0');
                const data = structuredClone(d.defaultEmptyCV);
                data.profile.fullName = 'Restored CV';
                const beforeParsed = JSON.parse(localStorage.getItem(s.VERSIONS_KEY));
                const real = Storage.prototype.setItem;
                Storage.prototype.setItem = function(k, v) {
                    if (k === s.STORAGE_KEY) throw new DOMException('quota test', 'QuotaExceededError');
                    return real.call(this, k, v);
                };
                let error = null, returned = null;
                try {
                    returned = s.restoreFullBackup({
                        type: s.FULL_BACKUP_TYPE,
                        schemaVersion: 2,
                        activeVersionId: 'restored',
                        versions: [{ id: 'restored', name: 'Restored', data }]
                    });
                } catch (e) {
                    error = e.message;
                } finally {
                    Storage.prototype.setItem = real;
                }
                const afterParsed = JSON.parse(localStorage.getItem(s.VERSIONS_KEY));
                const normalize = items => (items || []).map(v => ({ id: v.id, name: v.name, data: v.data }));
                const itemsMatch = JSON.stringify(normalize(beforeParsed.items)) === JSON.stringify(normalize(afterParsed.items));
                const noRestoredItem = !afterParsed.items.some(v => v.id === 'restored');
                return {
                    error,
                    returned,
                    originalCollectionPreserved: itemsMatch && noRestoredItem
                };
            }""")
            context.close()
            if r4_result["error"] and r4_result["returned"] is None and r4_result["originalCollectionPreserved"]:
                log_pass("restoreFullBackup threw on draft failure and rolled back collections atomically.")
            else:
                log_fail(f"R4 restore failure propagation failed: {r4_result}")
                failures += 1

            # ==============================================================
            # R5: Reject Future Schema Versions Without Corrupting Storage
            # ==============================================================
            log_test("R5: Reject Future Schema Versions Without Corrupting Storage")
            context, page = make_page()
            page.fill('#prof-name', 'Known Healthy CV')
            page.wait_for_timeout(450)
            r5_result = page.evaluate("""async () => {
                const s = await import('/js/storage.js?v=0.2.0');
                let error = null, returned = null;
                try {
                    returned = s.restoreFullBackup({
                        type: s.FULL_BACKUP_TYPE,
                        schemaVersion: 999,
                        versions: [{ id: 'future', data: { unknownFutureData: 'content' } }]
                    });
                } catch (e) {
                    error = e.message;
                }
                return {
                    error,
                    returned,
                    collection: s.loadCVVersions().map(v => v.id)
                };
            }""")
            context.close()
            if r5_result["error"] and r5_result["returned"] is None and "future" not in r5_result["collection"]:
                log_pass(f"Future schemaVersion 999 strictly rejected with message: '{r5_result['error']}'.")
            else:
                log_fail(f"R5 future schema acceptance bug: {r5_result}")
                failures += 1

            # ==============================================================
            # R6: Internal ES Module Dependency Graph Versioning Query Strings
            # ==============================================================
            log_test("R6: Internal ES Module Dependency Graph Versioning Query Strings")
            context = browser.new_context(locale="id-ID")
            page = context.new_page()
            requests = []
            page.on("request", lambda r: requests.append(r.url.split(base_url)[-1]) if "/js/" in r.url else None)
            page.goto(base_url, wait_until="networkidle")
            context.close()

            unversioned_js = [r for r in requests if not r.endswith("?v=0.2.0")]
            if len(unversioned_js) == 0 and len(requests) >= 5:
                log_pass(f"All {len(requests)} requested JavaScript modules include cache-busting ?v=0.2.0 query strings.")
            else:
                log_fail(f"R6 unversioned JavaScript module requests found: {unversioned_js}")
                failures += 1

            # ==============================================================
            # R7: Full Backup Includes Pending In-Memory Edits
            # ==============================================================
            log_test("R7: Full Backup Includes Pending In-Memory Edits")
            context, page = make_page()
            page.fill('#prof-name', 'Old Saved Name')
            page.wait_for_timeout(450)
            with page.expect_download() as dl_event:
                page.evaluate("""() => {
                    const f = document.getElementById('prof-name');
                    f.value = 'Latest Pending Name';
                    f.dispatchEvent(new Event('input', { bubbles: true }));
                    document.getElementById('header-more-dropdown').open = true;
                    document.getElementById('btn-export-full-backup').click();
                }""")
            r7_dest = PROJECT_ROOT / "test-results" / "test-r7-fast-backup.json"
            dl_event.value.save_as(r7_dest)
            r7_backup = json.loads(r7_dest.read_text(encoding="utf-8"))
            context.close()

            r7_version_names = [v['data']['profile']['fullName'] for v in r7_backup.get('versions', [])]
            r7_draft_name = r7_backup.get('draft', {}).get('data', {}).get('profile', {}).get('fullName')
            if 'Latest Pending Name' in r7_version_names and r7_draft_name == 'Latest Pending Name':
                log_pass("Full backup exported during debounce window successfully captured latest in-memory edits.")
            else:
                log_fail(f"R7 pending edits dropped from backup: versions={r7_version_names}, draft={r7_draft_name}")
                failures += 1

            # ==============================================================
            # S1: Retry Version Switch After Failed Flush Preserves Edits
            # ==============================================================
            log_test("S1: Retry Version Switch After Failed Flush Preserves Edits")
            context, page = make_page()
            page.fill('#prof-name', 'Saved A')
            page.wait_for_timeout(450)
            page.click('#btn-open-versions-modal')
            page.fill('#input-new-version-name', 'Version B')
            page.click('#btn-create-empty-version')
            page.keyboard.press('Escape')
            page.fill('#prof-name', 'Saved B')
            page.wait_for_timeout(450)
            page.click('#btn-open-versions-modal')

            s1_result = page.evaluate("""() => {
                const real = Storage.prototype.setItem;
                Storage.prototype.setItem = function(k, v) {
                    if (k === 'indonesian_ats_cv_builder_versions_v1') throw new DOMException('quota test', 'QuotaExceededError');
                    return real.call(this, k, v);
                };
                const f = document.getElementById('prof-name');
                f.value = 'UNSAVED B';
                f.dispatchEvent(new Event('input', { bubbles: true }));
                document.querySelector('.btn-switch-version').click();
                const afterFirst = f.value;
                Storage.prototype.setItem = real;
                document.querySelector('.btn-switch-version').click();
                const versions = JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_versions_v1')).items.map(v => ({
                    name: v.name,
                    fullName: v.data.profile.fullName
                }));
                return { afterFirst, afterRetry: f.value, versions };
            }""")
            context.close()

            ver_b = next((v for v in s1_result['versions'] if v['name'] == 'Version B'), None)
            if s1_result['afterFirst'] == 'UNSAVED B' and s1_result['afterRetry'] == 'Saved A' and ver_b and ver_b['fullName'] == 'UNSAVED B':
                log_pass("Persistent dirty state correctly flushed edit to Version B upon retry switch.")
            else:
                log_fail(f"S1 dirty retry switch failed: {s1_result}")
                failures += 1

            # ==============================================================
            # S2: Cross-Tab Partial Sync Preserves Multiple Dirty Fields
            # ==============================================================
            log_test("S2: Cross-Tab Partial Sync Preserves Multiple Dirty Fields")
            context = browser.new_context(locale="id-ID")
            page_a = context.new_page()
            page_a.goto(base_url, wait_until="networkidle")
            page_a.fill('#prof-name', 'Shared Candidate')
            page_a.wait_for_timeout(450)

            page_b = context.new_page()
            page_b.goto(base_url, wait_until="networkidle")
            page_b.evaluate("""() => {
                const email = document.getElementById('prof-email');
                email.focus();
                email.value = 'pending@example.invalid';
                email.dispatchEvent(new Event('input', { bubbles: true }));
                const title = document.getElementById('prof-title');
                title.focus();
                title.value = 'Pending Title';
                title.dispatchEvent(new Event('input', { bubbles: true }));
            }""")

            page_a.evaluate("""() => {
                const f = document.getElementById('summary-textarea');
                f.value = 'External Summary';
                f.dispatchEvent(new Event('input', { bubbles: true }));
                window.__atsFlushAutoSave();
            }""")
            page_b.wait_for_timeout(450)

            s2_data = page_b.evaluate("JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_draft_v1')).data")
            context.close()

            prof = s2_data.get('profile', {})
            if prof.get('email') == 'pending@example.invalid' and prof.get('jobTitle') == 'Pending Title' and s2_data.get('summary') == 'External Summary':
                log_pass("All multiple dirty fields preserved while non-conflicting external summary was merged.")
            else:
                log_fail(f"S2 multiple dirty fields sync bug: {prof}, summary={s2_data.get('summary')}")
                failures += 1

            # ==============================================================
            # S3: Repeatable Item Handlers Maintained After Partial Sync
            # ==============================================================
            log_test("S3: Repeatable Item Handlers Maintained After Partial Sync")
            context = browser.new_context(locale="id-ID")
            page_a = context.new_page()
            page_a.goto(base_url, wait_until="networkidle")
            page_a.click('#btn-starter-experienced')
            page_a.wait_for_timeout(450)

            page_b = context.new_page()
            page_b.goto(base_url, wait_until="networkidle")
            page_b.evaluate("""() => {
                const f = document.getElementById('prof-title');
                f.focus();
                f.value = 'Local Pending Title';
                f.dispatchEvent(new Event('input', { bubbles: true }));
            }""")

            page_a.evaluate("""() => {
                const f = document.getElementById('summary-textarea');
                f.value = 'External Changed Summary';
                f.dispatchEvent(new Event('input', { bubbles: true }));
                window.__atsFlushAutoSave();
            }""")
            page_b.wait_for_timeout(450)

            page_b.evaluate("""() => {
                const f = document.querySelector('.exp-desc');
                f.focus();
                f.value = 'Experience Edit After Sync';
                f.dispatchEvent(new Event('input', { bubbles: true }));
            }""")
            page_b.wait_for_timeout(450)

            s3_result = page_b.evaluate("""() => ({
                field: document.querySelector('.exp-desc').value,
                savedDescription: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_draft_v1')).data.experience[0].description
            })""")
            context.close()

            if s3_result['field'] == 'Experience Edit After Sync' and s3_result['savedDescription'] == 'Experience Edit After Sync':
                log_pass("Repeatable item event handler dynamically bound to state after partial array sync.")
            else:
                log_fail(f"S3 detached array handler bug: {s3_result}")
                failures += 1

            # ==============================================================
            # S4: Strict Data Type Validation in Restore Backup
            # ==============================================================
            log_test("S4: Strict Data Type Validation in Restore Backup")
            context, page = make_page()
            page.fill('#prof-name', 'Healthy Existing CV')
            page.wait_for_timeout(450)

            s4_result = page.evaluate("""async () => {
                const s = await import('/js/storage.js?v=0.2.0');
                const old = localStorage.getItem(s.VERSIONS_KEY);
                let error = null;
                let returned = null;
                try {
                    returned = s.restoreFullBackup({
                        type: s.FULL_BACKUP_TYPE,
                        schemaVersion: 2,
                        versions: [{ id: 'invalid', data: { profile: 42 } }]
                    });
                } catch (e) {
                    error = e.message;
                }
                return {
                    error,
                    returnedName: returned?.profile?.fullName,
                    oldCollectionPreserved: old === localStorage.getItem(s.VERSIONS_KEY)
                };
            }""")
            context.close()

            if s4_result['error'] and s4_result['oldCollectionPreserved']:
                log_pass(f"Malformed backup field type strictly rejected with '{s4_result['error']}' and storage preserved.")
            else:
                log_fail(f"S4 malformed backup acceptance bug: {s4_result}")
                failures += 1

            # ==============================================================
            # T1: Cross-Tab Version Switch Isolates Version Data & Pending Edits
            # ==============================================================
            log_test("T1: Cross-Tab Version Switch Isolates Version Data & Pending Edits")
            context = browser.new_context(locale="id-ID")
            page_a = context.new_page()
            page_a.goto(base_url, wait_until="networkidle")
            page_a.fill('#prof-name', 'Saved Candidate A')
            page_a.wait_for_timeout(450)
            page_a.click('#btn-open-versions-modal')
            page_a.fill('#input-new-version-name', 'Version B')
            page_a.click('#btn-create-empty-version')
            page_a.keyboard.press('Escape')
            page_a.fill('#prof-name', 'Saved Candidate B')
            page_a.wait_for_timeout(450)

            page_b = context.new_page()
            page_b.goto(base_url, wait_until="networkidle")
            page_a.click('#btn-open-versions-modal')
            page_b.evaluate("""() => {
                const f = document.getElementById('prof-name');
                f.focus();
                f.value = 'Pending Candidate B';
                f.dispatchEvent(new Event('input', { bubbles: true }));
            }""")
            page_a.evaluate("document.querySelector('.btn-switch-version').click()")
            page_b.wait_for_timeout(450)

            t1_result = page_b.evaluate("""() => ({
                active: localStorage.getItem('indonesian_ats_cv_builder_active_version_v1'),
                versions: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_versions_v1')).items.map(v => ({
                    id: v.id,
                    name: v.name,
                    fullName: v.data.profile.fullName
                })),
                visibleName: document.getElementById('prof-name').value,
                draftName: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_draft_v1')).data.profile.fullName
            })""")
            context.close()

            ver_b_t1 = next((v for v in t1_result['versions'] if v['name'] == 'Version B'), None)
            ver_a_t1 = next((v for v in t1_result['versions'] if 'Draft Utama' in v['name']), None)
            if (ver_b_t1 and ver_b_t1['fullName'] == 'Pending Candidate B' and
                ver_a_t1 and ver_a_t1['fullName'] == 'Saved Candidate A' and
                t1_result['draftName'] == 'Saved Candidate A' and
                t1_result['visibleName'] == 'Pending Candidate B'):
                log_pass("Version B pending edit saved and Version A draft preserved separately without collision.")
            else:
                log_fail(f"T1 version isolation failure: {t1_result}")
                failures += 1

            # ==============================================================
            # T2: Cross-Tab Partial Sync Merges Document Language With Pending Profile
            # ==============================================================
            log_test("T2: Cross-Tab Partial Sync Merges Document Language With Pending Profile")
            context = browser.new_context(locale="id-ID")
            page_a = context.new_page()
            page_a.goto(base_url, wait_until="networkidle")
            page_a.fill('#prof-name', 'Shared Candidate')
            page_a.wait_for_timeout(450)

            page_b = context.new_page()
            page_b.goto(base_url, wait_until="networkidle")
            page_b.evaluate("""() => {
                const f = document.getElementById('prof-name');
                f.focus();
                f.value = 'Local Pending Name';
                f.dispatchEvent(new Event('input', { bubbles: true }));
            }""")
            page_a.evaluate("""() => {
                const f = document.getElementById('select-preview-doc-language');
                f.value = 'en';
                f.dispatchEvent(new Event('change', { bubbles: true }));
                window.__atsFlushAutoSave();
            }""")
            page_b.wait_for_timeout(450)

            t2_result = page_b.evaluate("""() => ({
                savedName: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_draft_v1')).data.profile.fullName,
                savedLanguage: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_draft_v1')).data.documentLanguage
            })""")
            context.close()

            if t2_result['savedName'] == 'Local Pending Name' and t2_result['savedLanguage'] == 'en':
                log_pass("Remote document language 'en' merged and local pending name preserved in storage.")
            else:
                log_fail(f"T2 document language merge failure: {t2_result}")
                failures += 1

            # ==============================================================
            # T3: Single CV Import Handles Storage Failure With Dirty State & Recovers On Reload
            # ==============================================================
            log_test("T3: Single CV Import Failure Path & Dirty State Persistence")
            context, page = make_page()
            page.fill('#prof-name', 'Saved Existing CV')
            page.wait_for_timeout(450)
            page.evaluate("""() => {
                window.__testOriginalSetItem = Storage.prototype.setItem;
                Storage.prototype.setItem = function(k, v) {
                    if (k === 'indonesian_ats_cv_builder_draft_v1') throw new DOMException('quota test', 'QuotaExceededError');
                    return window.__testOriginalSetItem.call(this, k, v);
                };
            }""")

            import_payload = json.dumps({'profile': {'fullName': 'Imported Unsaved CV'}}).encode('utf-8')
            page.set_input_files('#input-import-json', {
                'name': 'single-cv.json',
                'mimeType': 'application/json',
                'buffer': import_payload
            })
            page.wait_for_timeout(450)

            t3_before = page.evaluate("""() => ({
                field: document.getElementById('prof-name').value,
                savedName: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_draft_v1')).data.profile.fullName,
                flushReturnsSuccess: window.__atsFlushAutoSave()
            })""")

            page.evaluate("() => { Storage.prototype.setItem = window.__testOriginalSetItem; }")
            page.reload(wait_until="networkidle")
            t3_after_reload = page.input_value('#prof-name')
            context.close()

            if (t3_before['field'] == 'Imported Unsaved CV' and
                t3_before['flushReturnsSuccess'] is False and
                t3_after_reload == 'Imported Unsaved CV'):
                log_pass("Single CV import failure kept dirty state and cleanly persisted upon recovery & reload.")
            else:
                log_fail(f"T3 import failure handling failed: before={t3_before}, after_reload={t3_after_reload}")
                failures += 1

            # ==============================================================
            # U1: Cross-Tab Version Isolation For Full Backup, Reset, and UI Labels
            # ==============================================================
            log_test("U1: Cross-Tab Version Isolation For Full Backup, Reset, and UI Labels")
            u1_context = browser.new_context(locale="id-ID", accept_downloads=True)
            u1_page_a = u1_context.new_page()
            u1_page_a.goto(base_url, wait_until="networkidle")
            u1_page_a.fill('#prof-name', 'Candidate A')
            u1_page_a.wait_for_timeout(450)
            u1_page_a.click('#btn-open-versions-modal')
            u1_page_a.fill('#input-new-version-name', 'Version B')
            u1_page_a.click('#btn-create-empty-version')
            u1_page_a.keyboard.press('Escape')
            u1_page_a.fill('#prof-name', 'Candidate B')
            u1_page_a.wait_for_timeout(450)

            # Tab B opens and loads Version B (which is currently active)
            u1_page_b = u1_context.new_page()
            u1_page_b.goto(base_url, wait_until="networkidle")

            # Tab A switches back to Version A
            u1_page_a.click('#btn-open-versions-modal')
            u1_page_a.evaluate("document.querySelector('.btn-switch-version').click()")
            u1_page_b.wait_for_timeout(100)

            # Verify Tab B pill shows Version B even though global active is Version A
            pill_label_b = u1_page_b.text_content('#active-version-label')

            # Tab B performs full backup
            with u1_page_b.expect_download() as download_info:
                u1_page_b.evaluate("document.getElementById('btn-export-full-backup').click()")
            download = download_info.value
            backup_temp_path = PROJECT_ROOT / "test-results" / "test-u1-backup.json"
            download.save_as(backup_temp_path)
            backup_data = json.loads(backup_temp_path.read_text(encoding='utf-8'))
            if backup_temp_path.exists():
                backup_temp_path.unlink()

            has_candidate_a = any(v.get('data', {}).get('profile', {}).get('fullName') == 'Candidate A' for v in backup_data.get('versions', []))
            has_candidate_b = any(v.get('data', {}).get('profile', {}).get('fullName') == 'Candidate B' for v in backup_data.get('versions', []))

            # Tab B performs reset via confirmation modal
            u1_page_b.evaluate("document.getElementById('btn-reset-cv').click()")
            u1_page_b.click('#btn-confirm-reset-action')
            u1_page_b.wait_for_timeout(100)

            u1_state = u1_page_b.evaluate("""() => ({
                editorName: document.getElementById('prof-name').value,
                label: document.getElementById('active-version-label').textContent,
                versions: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_versions_v1')).items.map(v => ({
                    id: v.id,
                    name: v.name,
                    fullName: v.data.profile.fullName
                }))
            })""")
            u1_context.close()

            version_b_item = next((v for v in u1_state['versions'] if v['name'] == 'Version B'), None)
            version_a_item = next((v for v in u1_state['versions'] if v['name'] == 'Draft Utama'), None)

            if ('Version B' in pill_label_b and
                has_candidate_a and has_candidate_b and
                u1_state['editorName'] == '' and
                version_b_item and version_b_item['fullName'] == '' and
                version_a_item and version_a_item['fullName'] == 'Candidate A'):
                log_pass("Backup preserved Candidate A & B; Reset cleared Version B while keeping Candidate A intact.")
            else:
                log_fail(f"U1 isolation failure: pill={pill_label_b}, has_a={has_candidate_a}, has_b={has_candidate_b}, state={u1_state}")
                failures += 1

            # ==============================================================
            # V1: Remote Version Deletion Handling, Save Error Reporting, and Safe Backup
            # ==============================================================
            log_test("V1: Remote Version Deletion Handling, Save Error Reporting, and Safe Backup")
            v1_context = browser.new_context(locale="id-ID", accept_downloads=True)
            v1_page_a = v1_context.new_page()
            v1_page_a.goto(base_url, wait_until="networkidle")
            v1_page_a.fill('#prof-name', 'Candidate A')
            v1_page_a.wait_for_timeout(450)
            v1_page_a.click('#btn-open-versions-modal')
            v1_page_a.fill('#input-new-version-name', 'Version B')
            v1_page_a.click('#btn-create-empty-version')
            v1_page_a.keyboard.press('Escape')
            v1_page_a.fill('#prof-name', 'Candidate B')
            v1_page_a.wait_for_timeout(450)

            v1_page_b = v1_context.new_page()
            v1_page_b.goto(base_url, wait_until="networkidle")
            b_id = v1_page_b.evaluate("localStorage.getItem('indonesian_ats_cv_builder_active_version_v1')")

            # Tab A switches back to Version A and deletes Version B
            v1_page_a.click('#btn-open-versions-modal')
            v1_page_a.evaluate("document.querySelector('.btn-switch-version').click()")
            v1_page_a.evaluate('(id) => document.querySelector(`.btn-delete-version[data-id="${id}"]`).click()', b_id)
            v1_page_b.wait_for_timeout(100)

            # Tab B types new edits into the now-deleted version
            v1_page_b.fill('#prof-name', 'Edit After Remote Delete')
            v1_page_b.wait_for_timeout(450)

            v1_state = v1_page_b.evaluate("""() => ({
                editorName: document.getElementById('prof-name').value,
                label: document.getElementById('active-version-label').textContent,
                saveStatus: document.getElementById('save-status-text').textContent,
                versions: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_versions_v1')).items.map(v => ({
                    id: v.id,
                    name: v.name,
                    fullName: v.data.profile.fullName
                })),
                draftName: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_draft_v1')).data.profile.fullName,
                errorBackupVisible: document.getElementById('btn-backup-on-error').style.display,
                flushSuccess: window.__atsFlushAutoSave()
            })""")

            # Tab B exports full backup
            with v1_page_b.expect_download() as download_info:
                v1_page_b.evaluate("document.getElementById('btn-export-full-backup').click()")
            download = download_info.value
            v1_backup_path = PROJECT_ROOT / "test-results" / "test-v1-backup.json"
            download.save_as(v1_backup_path)
            v1_backup = json.loads(v1_backup_path.read_text(encoding='utf-8'))
            if v1_backup_path.exists():
                v1_backup_path.unlink()

            v1_page_b.reload(wait_until="networkidle")
            editor_after_reload = v1_page_b.input_value('#prof-name')
            v1_context.close()

            has_backup_candidate_a = any(v.get('data', {}).get('profile', {}).get('fullName') == 'Candidate A' for v in v1_backup.get('versions', []))
            has_backup_orphan_edit = any(v.get('data', {}).get('profile', {}).get('fullName') == 'Edit After Remote Delete' for v in v1_backup.get('versions', []))

            if (v1_state['flushSuccess'] is False and
                v1_state['errorBackupVisible'] == 'inline-flex' and
                'Konflik' in v1_state['label'] and
                v1_state['draftName'] == 'Candidate A' and
                len(v1_state['versions']) == 1 and v1_state['versions'][0]['fullName'] == 'Candidate A' and
                has_backup_candidate_a and has_backup_orphan_edit and
                editor_after_reload == 'Candidate A'):
                log_pass("Remote deletion prevented silent overwrite; reported save error, preserved Candidate A, and captured orphan edit in backup.")
            else:
                log_fail(f"V1 remote delete handling failure: state={v1_state}, backup_a={has_backup_candidate_a}, backup_orphan={has_backup_orphan_edit}, reload={editor_after_reload}")
                failures += 1

            # ==============================================================
            # W1: Cross-Tab Inactive Version Edits Synchronization (VERSIONS_KEY)
            # ==============================================================
            log_test("W1: Cross-Tab Inactive Version Edits Synchronization (VERSIONS_KEY)")
            w1_context = browser.new_context(locale="id-ID")
            w1_page_a = w1_context.new_page()
            w1_page_a.goto(base_url, wait_until="networkidle")
            w1_page_a.fill('#prof-name', 'Candidate A')
            w1_page_a.wait_for_timeout(450)

            # Create Version B
            w1_page_a.click('#btn-open-versions-modal')
            w1_page_a.fill('#input-new-version-name', 'Version B')
            w1_page_a.click('#btn-create-empty-version')
            w1_page_a.keyboard.press('Escape')
            w1_page_a.fill('#prof-name', 'Candidate B')
            w1_page_a.wait_for_timeout(450)

            # Open Tab B on same context (also views Version B)
            w1_page_b = w1_context.new_page()
            w1_page_b.goto(base_url, wait_until="networkidle")

            # Open Tab C which switches active version back to Version A
            w1_page_c = w1_context.new_page()
            w1_page_c.goto(base_url, wait_until="networkidle")
            w1_page_c.click('#btn-open-versions-modal')
            w1_page_c.evaluate("document.querySelector('.btn-switch-version').click()")
            w1_page_c.keyboard.press('Escape')
            w1_page_a.wait_for_timeout(100)

            # Tab A edits Version B's email (inactive globally)
            w1_page_a.fill('#prof-email', 'updated-b@example.invalid')
            w1_page_a.wait_for_timeout(450)

            # Verify Tab B received the updated email via VERSIONS_KEY event
            tab_b_visible_email = w1_page_b.input_value('#prof-email')

            # Tab B edits Version B's job title and autosaves
            w1_page_b.fill('#prof-title', 'Second Tab Role')
            w1_page_b.wait_for_timeout(450)

            w1_result = w1_page_b.evaluate("""() => ({
                versions: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_versions_v1')).items.map(v => ({
                    id: v.id,
                    name: v.name,
                    fullName: v.data.profile.fullName,
                    email: v.data.profile.email,
                    title: v.data.profile.jobTitle
                })),
                draft: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_draft_v1')).data.profile
            })""")
            w1_context.close()

            ver_b = next((v for v in w1_result['versions'] if v['name'] == 'Version B'), None)
            ver_a = next((v for v in w1_result['versions'] if v['fullName'] == 'Candidate A'), None)

            if (tab_b_visible_email == 'updated-b@example.invalid' and
                ver_b is not None and
                ver_b.get('email') == 'updated-b@example.invalid' and
                ver_b.get('title') == 'Second Tab Role' and
                ver_b.get('fullName') == 'Candidate B' and
                ver_a is not None and
                w1_result['draft'].get('fullName') == 'Candidate A'):
                log_pass("Tab B received VERSIONS_KEY updates for inactive version; edits to distinct fields in Tab A and Tab B were mutually preserved.")
            else:
                log_fail(f"W1 failure: tab_b_visible_email={tab_b_visible_email}, ver_b={ver_b}, ver_a={ver_a}, draft={w1_result.get('draft')}")
                failures += 1

            # ==============================================================
            # X1: Cross-Tab Older Full Backup Restoration & Revision Stamping
            # ==============================================================
            log_test("X1: Cross-Tab Older Full Backup Restoration & Revision Stamping")
            x1_context = browser.new_context(locale="id-ID", accept_downloads=True)
            x1_page_a = x1_context.new_page()
            x1_page_a.goto(base_url, wait_until="networkidle")
            x1_page_a.fill('#prof-name', 'Candidate A')
            x1_page_a.wait_for_timeout(450)

            # Create Version B
            x1_page_a.click('#btn-open-versions-modal')
            x1_page_a.fill('#input-new-version-name', 'Version B')
            x1_page_a.click('#btn-create-empty-version')
            x1_page_a.keyboard.press('Escape')
            x1_page_a.fill('#prof-name', 'Backed Up Candidate B')
            x1_page_a.wait_for_timeout(450)

            # Open Tab B on same context (views Version B)
            x1_page_b = x1_context.new_page()
            x1_page_b.goto(base_url, wait_until="networkidle")

            # Tab A switches back to Version A and exports full backup
            x1_page_a.click('#btn-open-versions-modal')
            x1_page_a.evaluate("document.querySelector('.btn-switch-version').click()")
            x1_page_a.keyboard.press('Escape')
            x1_page_b.wait_for_timeout(100)

            with x1_page_a.expect_download() as dl_info:
                x1_page_a.evaluate("document.getElementById('btn-export-full-backup').click()")
            x1_backup_path = PROJECT_ROOT / "test-results" / "test-x1-backup.json"
            dl_info.value.save_as(x1_backup_path)

            # Tab B edits Version B's name and autosaves
            x1_page_b.fill('#prof-name', 'Changed After Backup B')
            x1_page_b.wait_for_timeout(450)

            # Tab A restores the older full backup
            x1_page_a.set_input_files('#input-import-json', str(x1_backup_path))
            x1_page_b.wait_for_timeout(150)
            if x1_backup_path.exists():
                x1_backup_path.unlink()

            # Verify Tab B received the restored version data
            tab_b_visible_name = x1_page_b.input_value('#prof-name')

            # Tab B edits job title and autosaves
            x1_page_b.fill('#prof-title', 'Role After Restore')
            x1_page_b.wait_for_timeout(450)

            x1_result = x1_page_b.evaluate("""() => ({
                versions: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_versions_v1')).items.map(v => ({
                    name: v.name,
                    fullName: v.data.profile.fullName,
                    title: v.data.profile.jobTitle
                })),
                draft: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_draft_v1')).data.profile
            })""")
            x1_context.close()

            x1_ver_b = next((v for v in x1_result['versions'] if v['name'] == 'Version B'), None)
            x1_ver_a = next((v for v in x1_result['versions'] if v['fullName'] == 'Candidate A'), None)

            if (tab_b_visible_name == 'Backed Up Candidate B' and
                x1_ver_b is not None and
                x1_ver_b.get('fullName') == 'Backed Up Candidate B' and
                x1_ver_b.get('title') == 'Role After Restore' and
                x1_ver_a is not None and
                x1_result['draft'].get('fullName') == 'Candidate A'):
                log_pass("Older full backup restore correctly applied across tabs; Tab B updated to restored data and preserved both restored name and subsequent title edit.")
            else:
                log_fail(f"X1 failure: tab_b_visible_name={tab_b_visible_name}, ver_b={x1_ver_b}, ver_a={x1_ver_a}")
                failures += 1

            # ==============================================================
            # Y1: Atomic Full Backup Rollback Cross-Tab Synchronization Under Failure
            # ==============================================================
            log_test("Y1: Atomic Full Backup Rollback Cross-Tab Synchronization Under Failure")
            y1_context = browser.new_context(locale="id-ID", accept_downloads=True)
            y1_page_a = y1_context.new_page()
            y1_page_a.goto(base_url, wait_until="networkidle")
            y1_page_a.fill('#prof-name', 'Candidate A')
            y1_page_a.wait_for_timeout(450)

            # Create Version B
            y1_page_a.click('#btn-open-versions-modal')
            y1_page_a.fill('#input-new-version-name', 'Version B')
            y1_page_a.click('#btn-create-empty-version')
            y1_page_a.keyboard.press('Escape')
            y1_page_a.fill('#prof-name', 'Backed Up Candidate B')
            y1_page_a.wait_for_timeout(450)

            # Open Tab B on same context (views Version B)
            y1_page_b = y1_context.new_page()
            y1_page_b.goto(base_url, wait_until="networkidle")

            # Tab A switches back to Version A and exports full backup
            y1_page_a.click('#btn-open-versions-modal')
            y1_page_a.evaluate("document.querySelector('.btn-switch-version').click()")
            y1_page_a.keyboard.press('Escape')
            y1_page_b.wait_for_timeout(100)

            with y1_page_a.expect_download() as dl_info:
                y1_page_a.evaluate("document.getElementById('btn-export-full-backup').click()")
            y1_backup_path = PROJECT_ROOT / "test-results" / "test-y1-backup.json"
            dl_info.value.save_as(y1_backup_path)

            # Tab B edits Version B's name to 'Changed After Backup B' and autosaves
            y1_page_b.fill('#prof-name', 'Changed After Backup B')
            y1_page_b.wait_for_timeout(450)

            # Setup error handling & quota error monkeypatch on Tab A for STORAGE_KEY write
            dialog_messages = []
            y1_page_a.on('dialog', lambda dialog: (dialog_messages.append(dialog.message), dialog.dismiss()))
            y1_page_a.evaluate("""() => {
                window.__y1OrigSetItem = Storage.prototype.setItem;
                Storage.prototype.setItem = function(k, v) {
                    if (k === 'indonesian_ats_cv_builder_draft_v1') {
                        throw new DOMException('simulated quota limit', 'QuotaExceededError');
                    }
                    return window.__y1OrigSetItem.call(this, k, v);
                };
            }""")

            # Tab A attempts to restore backup (should fail & trigger atomic rollback)
            y1_page_a.set_input_files('#input-import-json', str(y1_backup_path))
            y1_page_b.wait_for_timeout(200)

            # Restore original Storage.prototype.setItem
            y1_page_a.evaluate("() => { if (window.__y1OrigSetItem) Storage.prototype.setItem = window.__y1OrigSetItem; }")
            if y1_backup_path.exists():
                y1_backup_path.unlink()

            # Inspect Tab B: must have reverted to rolled-back state ('Changed After Backup B')
            y1_tab_b_reverted = y1_page_b.evaluate("""() => ({
                visibleName: document.getElementById('prof-name').value,
                storedName: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_versions_v1')).items.find(v => v.name === 'Version B').data.profile.fullName
            })""")

            # Tab B now edits title and autosaves to ensure normal operations resume without overwrite
            y1_page_b.fill('#prof-title', 'Role After Failed Restore')
            y1_page_b.wait_for_timeout(450)

            y1_result = y1_page_b.evaluate("""() => ({
                versions: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_versions_v1')).items.map(v => ({
                    name: v.name,
                    fullName: v.data.profile.fullName,
                    title: v.data.profile.jobTitle
                })),
                draft: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_draft_v1')).data.profile,
                saveStatus: document.getElementById('save-status-text').textContent
            })""")
            y1_context.close()

            y1_ver_b = next((v for v in y1_result['versions'] if v['name'] == 'Version B'), None)
            y1_ver_a = next((v for v in y1_result['versions'] if v['fullName'] == 'Candidate A'), None)

            if (len(dialog_messages) > 0 and
                y1_tab_b_reverted['visibleName'] == 'Changed After Backup B' and
                y1_tab_b_reverted['storedName'] == 'Changed After Backup B' and
                y1_ver_b is not None and
                y1_ver_b.get('fullName') == 'Changed After Backup B' and
                y1_ver_b.get('title') == 'Role After Failed Restore' and
                y1_ver_a is not None and
                y1_result['draft'].get('fullName') == 'Candidate A'):
                log_pass("Failed backup restore rolled back atomically across tabs; Tab B preserved local changes and subsequent edits cleanly saved.")
            else:
                log_fail(f"Y1 failure: dialogs={dialog_messages}, reverted={y1_tab_b_reverted}, ver_b={y1_ver_b}, ver_a={y1_ver_a}")
                failures += 1

            # ==============================================================
            # Z1: Strictly Monotonic Nested Rollback Revisions Under Same-Tick Storage Failure
            # ==============================================================
            log_test("Z1: Strictly Monotonic Nested Rollback Revisions Under Same-Tick Storage Failure")
            z1_context = browser.new_context(locale="id-ID", accept_downloads=True)
            z1_page_a = z1_context.new_page()
            z1_page_a.goto(base_url, wait_until="networkidle")
            z1_page_a.fill('#prof-name', 'Candidate A')
            z1_page_a.wait_for_timeout(450)

            # Create Version B
            z1_page_a.click('#btn-open-versions-modal')
            z1_page_a.fill('#input-new-version-name', 'Version B')
            z1_page_a.click('#btn-create-empty-version')
            z1_page_a.keyboard.press('Escape')
            z1_page_a.fill('#prof-name', 'Backed Up Candidate B')
            z1_page_a.wait_for_timeout(450)

            # Open Tab B on same context (views Version B)
            z1_page_b = z1_context.new_page()
            z1_page_b.goto(base_url, wait_until="networkidle")

            # Tab A switches back to Version A and exports full backup
            z1_page_a.click('#btn-open-versions-modal')
            z1_page_a.evaluate("document.querySelector('.btn-switch-version').click()")
            z1_page_a.keyboard.press('Escape')
            z1_page_b.wait_for_timeout(100)

            with z1_page_a.expect_download() as dl_info:
                z1_page_a.evaluate("document.getElementById('btn-export-full-backup').click()")
            z1_backup_path = PROJECT_ROOT / "test-results" / "test-z1-backup.json"
            dl_info.value.save_as(z1_backup_path)

            # Tab B edits Version B's name to 'Changed After Backup B' and autosaves
            z1_page_b.fill('#prof-name', 'Changed After Backup B')
            z1_page_b.wait_for_timeout(450)

            # Track storage events on Tab B
            z1_page_b.evaluate("""() => {
                window.__z1Events = [];
                window.addEventListener('storage', e => {
                    if (e.key !== 'indonesian_ats_cv_builder_versions_v1' || !e.newValue) return;
                    try {
                        const item = JSON.parse(e.newValue).items.find(v => v.name === 'Version B');
                        if (item) window.__z1Events.push({ name: item.data.profile.fullName, updatedAt: item.updatedAt });
                    } catch (_) {}
                });
            }""")

            # Setup error handling & quota error monkeypatch + frozen Date clock on Tab A
            z1_dialog_messages = []
            z1_page_a.on('dialog', lambda dialog: (z1_dialog_messages.append(dialog.message), dialog.dismiss()))
            z1_page_a.evaluate("""() => {
                window.__z1OrigSetItem = Storage.prototype.setItem;
                Storage.prototype.setItem = function(k, v) {
                    if (k === 'indonesian_ats_cv_builder_draft_v1') {
                        throw new DOMException('simulated quota limit', 'QuotaExceededError');
                    }
                    return window.__z1OrigSetItem.call(this, k, v);
                };
                const NativeDate = Date;
                window.__z1NativeDate = NativeDate;
                const tick = NativeDate.now();
                window.Date = class extends NativeDate {
                    constructor(...args) { super(...(args.length ? args : [tick])); }
                    static now() { return tick; }
                };
            }""")

            # Tab A attempts to restore backup (should fail & trigger nested atomic rollbacks in same tick)
            z1_page_a.set_input_files('#input-import-json', str(z1_backup_path))
            z1_page_b.wait_for_timeout(200)

            # Restore original Storage.prototype.setItem and Date clock
            z1_page_a.evaluate("""() => {
                if (window.__z1OrigSetItem) Storage.prototype.setItem = window.__z1OrigSetItem;
                if (window.__z1NativeDate) window.Date = window.__z1NativeDate;
            }""")
            if z1_backup_path.exists():
                z1_backup_path.unlink()

            # Retrieve event trace from Tab B
            z1_events = z1_page_b.evaluate("window.__z1Events")
            z1_tab_b_reverted = z1_page_b.evaluate("""() => ({
                visibleName: document.getElementById('prof-name').value,
                storedName: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_versions_v1')).items.find(v => v.name === 'Version B').data.profile.fullName
            })""")

            # Tab B edits title and autosaves
            z1_page_b.fill('#prof-title', 'Role After Same-Tick Restore Fail')
            z1_page_b.wait_for_timeout(450)

            z1_result = z1_page_b.evaluate("""() => ({
                versions: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_versions_v1')).items.map(v => ({
                    name: v.name,
                    fullName: v.data.profile.fullName,
                    title: v.data.profile.jobTitle
                })),
                draft: JSON.parse(localStorage.getItem('indonesian_ats_cv_builder_draft_v1')).data.profile,
                saveStatus: document.getElementById('save-status-text').textContent
            })""")
            z1_context.close()

            z1_ver_b = next((v for v in z1_result['versions'] if v['name'] == 'Version B'), None)
            z1_ver_a = next((v for v in z1_result['versions'] if v['fullName'] == 'Candidate A'), None)

            # Verify that outer rollback compensation has a strictly greater revision than inner rollback
            inner_rollback_event = next((e for e in reversed(z1_events[:-1]) if e.get('name') == 'Backed Up Candidate B'), None)
            outer_rollback_event = z1_events[-1] if z1_events else None

            z1_compensations_monotonic = (
                inner_rollback_event is not None and
                outer_rollback_event is not None and
                outer_rollback_event.get('name') == 'Changed After Backup B' and
                outer_rollback_event.get('updatedAt') > inner_rollback_event.get('updatedAt')
            )

            if (len(z1_dialog_messages) > 0 and
                z1_compensations_monotonic and
                z1_tab_b_reverted['visibleName'] == 'Changed After Backup B' and
                z1_tab_b_reverted['storedName'] == 'Changed After Backup B' and
                z1_ver_b is not None and
                z1_ver_b.get('fullName') == 'Changed After Backup B' and
                z1_ver_b.get('title') == 'Role After Same-Tick Restore Fail' and
                z1_ver_a is not None and
                z1_result['draft'].get('fullName') == 'Candidate A'):
                log_pass(f"Strictly monotonic revisions verified (outer rollback {outer_rollback_event['updatedAt']} > inner rollback {inner_rollback_event['updatedAt']}); outer rollback took precedence and preserved edits under frozen same-tick clock.")
            else:
                log_fail(f"Z1 failure: dialogs={z1_dialog_messages}, events={z1_events}, comp_mono={z1_compensations_monotonic}, reverted={z1_tab_b_reverted}, ver_b={z1_ver_b}")
                failures += 1

            browser.close()

    finally:
        server.shutdown()
        server.server_close()
        print("\n  [INFO] Isolated audit test server stopped cleanly.")

    print("\n" + "=" * 60)
    if failures == 0:
        print("  ALL AUDIT & REVIEW REGRESSION TESTS (F1–F6, R1–R7, S1–S4, T1–T3, U1, V1, W1, X1, Y1, Z1) PASSED! [OK]")
        print("=" * 60)
        return True
    else:
        print(f"  {failures} AUDIT REGRESSION TESTS FAILED! [FAIL]")
        print("=" * 60)
        return False

if __name__ == "__main__":
    success = run_all_audit_tests()
    sys.exit(0 if success else 1)
