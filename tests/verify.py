"""
Automated Verification Suite for Indonesian ATS CV Builder webapp.
Verifies file existence, HTML structure, CSS print media rules, JS exports, and HTTP responses.
"""

import os
import re
import sys
import time
import socket
import threading
import urllib.request

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(PROJECT_DIR)
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

def log_pass(msg):
    print(f"  [PASS] {msg}")

def log_fail(msg):
    print(f"  [FAIL] {msg}")
    return False

def test_file_integrity():
    print("\n--- 1. Testing File Integrity & Deployment Artifacts ---")
    required_files = [
        "index.html",
        "server.py",
        "README.md",
        "requirements-dev.txt",
        "Dockerfile",
        "docker-compose.vps.yml",
        "deploy/default.conf",
        ".github/workflows/deploy.yml",
        "css/style.css",
        "css/cv-ats.css",
        "js/app.js",
        "js/data.js",
        "js/storage.js",
        "js/ats-checker.js",
        "js/i18n.js",
        "js/locales/id.js",
        "js/locales/en.js"
    ]
    all_ok = True
    for f in required_files:
        path = os.path.join(PROJECT_DIR, f)
        if os.path.isfile(path) and os.path.getsize(path) > 50:
            log_pass(f"{f} ({os.path.getsize(path)} bytes)")
        else:
            all_ok = log_fail(f"{f} is missing or too small!")
    return all_ok

def test_html_structure():
    print("\n--- 2. Testing HTML Structure & Accessibility ---")
    html_path = os.path.join(PROJECT_DIR, "index.html")
    with open(html_path, "r", encoding="utf-8") as fp:
        content = fp.read()

    all_ok = True
    checks = [
        ("lang=\"id\" (Bahasa Indonesia specified)", r'<html[^>]+lang=["\']id["\']'),
        ("Responsive viewport meta tag", r'<meta[^>]+viewport'),
        ("UTF-8 charset declaration", r'<meta[^>]+charset=["\']?UTF-8["\']?'),
        ("Title tag present", r'<title>.*ATS CV Builder.*</title>'),
        ("CSS link to style.css", r'href=["\']css/style.css["\']'),
        ("CSS link to cv-ats.css", r'href=["\']css/cv-ats.css["\']'),
        ("Live document preview container", r'id=["\']cv-live-document["\']'),
        ("Contact form inputs", r'id=["\']prof-name["\']'),
        ("Summary textarea", r'id=["\']summary-textarea["\']'),
        ("Experience repeatable list", r'id=["\']experience-repeatable-list["\']'),
        ("Education repeatable list", r'id=["\']education-repeatable-list["\']'),
        ("Skills inputs", r'id=["\']skills-technical["\']'),
        ("Print / Download PDF button", r'id=["\']btn-download-pdf["\']'),
        ("Plain text ATS copy button", r'id=["\']btn-copy-plain-text["\']'),
        ("Sample data modal trigger", r'id=["\']btn-open-sample-modal["\']'),
        ("Completeness checklist widget", r'id=["\']completeness-percent["\']'),
        ("Module script tag for app.js", r'<script[^>]+type=["\']module["\'][^>]+src=["\']js/app.js["\']')
    ]

    for label, pattern in checks:
        if re.search(pattern, content, re.IGNORECASE):
            log_pass(label)
        else:
            all_ok = log_fail(f"Pattern not found: {label}")
    return all_ok

def test_css_ats_standards():
    print("\n--- 3. Testing ATS CSS Rules & Print Media ---")
    css_path = os.path.join(PROJECT_DIR, "css", "cv-ats.css")
    with open(css_path, "r", encoding="utf-8") as fp:
        content = fp.read()

    all_ok = True
    checks = [
        ("@media print block", r'@media\s+print'),
        ("@page size A4 portrait", r'size:\s*A4\s*portrait'),
        ("Single-column width or page margin rules", r'margin:\s*15mm'),
        ("Page break protection (break-inside avoid)", r'break-inside:\s*avoid'),
        ("Heading page break protection (break-after avoid)", r'break-after:\s*avoid'),
        ("Empty section hide rule (:empty / is-empty)", r'\.cv-section:empty'),
        ("No print UI elements exclusion", r'\.no-print')
    ]

    for label, pattern in checks:
        if re.search(pattern, content, re.IGNORECASE):
            log_pass(label)
        else:
            all_ok = log_fail(f"Rule missing: {label}")
    return all_ok

def test_javascript_modules():
    print("\n--- 4. Testing JavaScript Code Conventions & Exports ---")
    data_path = os.path.join(PROJECT_DIR, "js", "data.js")
    with open(data_path, "r", encoding="utf-8") as fp:
        data_code = fp.read()

    all_ok = True
    if "export const defaultEmptyCV" in data_code and "export const sampleDataExperienced" in data_code and "export const sampleDataFreshGrad" in data_code:
        log_pass("data.js exports defaultEmptyCV, sampleDataExperienced, and sampleDataFreshGrad")
    else:
        all_ok = log_fail("data.js is missing expected exports")

    # Check Indonesian realistic fictitious data
    if "Budi Pratama" in data_code and "Anisa Rahmawati" in data_code:
        log_pass("data.js contains realistic Indonesian sample data (Experienced & Fresh Grad)")
    else:
        all_ok = log_fail("data.js lacks expected Indonesian test data")

    # Check ats-checker.js
    checker_path = os.path.join(PROJECT_DIR, "js", "ats-checker.js")
    with open(checker_path, "r", encoding="utf-8") as fp:
        checker_code = fp.read()

    if "export function analyzeCVCompleteness" in checker_code and "export function isValidEmail" in checker_code:
        log_pass("ats-checker.js exports analyzeCVCompleteness and isValidEmail")
    else:
        all_ok = log_fail("ats-checker.js missing export functions")

    # Check storage.js
    storage_path = os.path.join(PROJECT_DIR, "js", "storage.js")
    with open(storage_path, "r", encoding="utf-8") as fp:
        storage_code = fp.read()

    if "saveCVToStorage" in storage_code and "loadCVFromStorage" in storage_code and "exportCVAsJSON" in storage_code:
        log_pass("storage.js exports persistence and JSON export/import functions")
    else:
        all_ok = log_fail("storage.js missing storage functions")

    return all_ok

def test_server_http():
    print("\n--- 5. Testing Local Server HTTP Responses ---")
    import server

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        test_port = s.getsockname()[1]

    server_thread = threading.Thread(
        target=server.run_server,
        args=(test_port,),
        daemon=True
    )
    server_thread.start()
    time.sleep(0.5)

    base_url = f"http://127.0.0.1:{test_port}"
    endpoints = [
        ("/", 200, "text/html"),
        ("/css/style.css", 200, "text/css"),
        ("/css/cv-ats.css", 200, "text/css"),
        ("/js/app.js", 200, "application/javascript"),
        ("/js/data.js", 200, "application/javascript"),
        ("/js/storage.js", 200, "application/javascript"),
        ("/js/ats-checker.js", 200, "application/javascript"),
        ("/js/i18n.js", 200, "application/javascript"),
        ("/README.md", 200, None)
    ]

    all_ok = True
    for path, expected_status, expected_mime in endpoints:
        url = base_url + path
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=3) as resp:
                status = resp.getcode()
                ct = resp.headers.get("Content-Type", "")
                if status == expected_status:
                    if expected_mime and expected_mime not in ct:
                        all_ok = log_fail(f"{path} MIME mismatch: expected {expected_mime}, got {ct}")
                    else:
                        log_pass(f"GET {path} -> HTTP {status} ({ct})")
                else:
                    all_ok = log_fail(f"GET {path} returned HTTP {status}, expected {expected_status}")
        except Exception as e:
            all_ok = log_fail(f"GET {path} failed: {e}")

    return all_ok

def run_all_tests():
    print("==================================================")
    print("   ATS CV BUILDER INDONESIA - TEST VERIFICATION   ")
    print("==================================================")
    r1 = test_file_integrity()
    r2 = test_html_structure()
    r3 = test_css_ats_standards()
    r4 = test_javascript_modules()
    r5 = test_server_http()

    print("\n==================================================")
    if r1 and r2 and r3 and r4 and r5:
        print("  ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! [OK]")
        print("==================================================")
        return 0
    else:
        print("  SOME VERIFICATION CHECKS FAILED! [FAIL]")
        print("==================================================")
        return 1

if __name__ == "__main__":
    sys.exit(run_all_tests())
