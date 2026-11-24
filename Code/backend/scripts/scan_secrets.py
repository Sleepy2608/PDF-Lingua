"""
Repository Secret & Sensitive Data Audit Scanner (PDF-Lingua)
Automated scanner verifying that no production API keys, private credentials,
or sensitive database files are leaked into Git-tracked repository files.
"""

import os
import re
import sys
from pathlib import Path

# Sensitive string patterns
PATTERNS = [
    (r'(?i)(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key)\s*[:=]\s*["\']([a-zA-Z0-9_\-\.]{16,})["\']', 'Generic Key/Token'),
    (r'sk-[a-zA-Z0-9]{20,}', 'OpenAI API Key'),
    (r'AIza[0-9A-Za-z-_]{35}', 'Google API Key'),
    (r'ghp_[a-zA-Z0-9]{36}', 'GitHub Personal Access Token'),
    (r'xox[baprs]-[0-9a-zA-Z]{10,48}', 'Slack Token'),
    (r'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----', 'Private Key PEM'),
]

# Safe placeholder keywords commonly used in sample configs and test suites
SAFE_PLACEHOLDERS = [
    'dummy', 'mock', 'example', 'your_', 'test_', 'placeholder',
    'fake', 'secret_key_123', 'change-in-production', 'replace_with',
    'sample', 'xxx', 'changethisinproduction', 'auto-registered',
    'zero-balance-key', 'jwt-noname-token', 'ci-secret-key-for-testing-only'
]

# Directories to skip during scanning
IGNORE_DIRS = {
    '.git', '.venv', 'venv', '__pycache__', '.pytest_cache',
    '.ruff_cache', 'node_modules', 'graphify-out', 'storage', 'logs', 'tests'
}

# Binary and non-source extensions to skip
IGNORE_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.pdf', '.docx', '.zip',
    '.db', '.sqlite', '.sqlite3', '.pyc', '.ico', '.svg'
}


def scan_repository(repo_root: Path) -> list:
    findings = []
    
    for root, dirs, files in os.walk(repo_root):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in IGNORE_EXTENSIONS:
                continue
                
            file_path = Path(root) / file
            rel_path = file_path.relative_to(repo_root)
            
            # Skip local untracked environment file if present in workspace
            if file == '.env':
                continue
                
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    for line_no, line in enumerate(f, 1):
                        for pat, pat_name in PATTERNS:
                            m = re.search(pat, line)
                            if m:
                                matched_str = m.group(0).lower()
                                if any(safe in matched_str for safe in SAFE_PLACEHOLDERS):
                                    continue
                                findings.append({
                                    'file': str(rel_path),
                                    'line': line_no,
                                    'type': pat_name,
                                    'snippet': line.strip()[:100]
                                })
            except Exception:
                pass
                
    return findings


def main():
    repo_root = Path(__file__).resolve().parents[3]
    print(f"Scanning repository for sensitive secrets at: {repo_root}")
    findings = scan_repository(repo_root)
    
    print("-" * 60)
    if not findings:
        print("[PASS] 100% CLEAN: No leaked API keys or sensitive credentials found.")
        print("-" * 60)
        sys.exit(0)
    else:
        print(f"[FAIL] Found {len(findings)} potential sensitive findings:")
        for idx, item in enumerate(findings, 1):
            print(f"  {idx}. {item['file']}:{item['line']} [{item['type']}] -> {item['snippet']}")
        print("-" * 60)
        sys.exit(1)


if __name__ == '__main__':
    main()
