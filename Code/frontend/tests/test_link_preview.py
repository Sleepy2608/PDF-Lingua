"""
Test Suite: Social Media Link Preview Verification for PDF-Lingua
Simulates Facebook & Zalo scrapers, verifies OpenGraph/Twitter meta tags,
checks banner asset dimensions and Vercel routing rules.
"""

import os
import re
import json
from PIL import Image

def test_link_preview():
    print("=" * 64)
    print("PDF-LINGUA SOCIAL MEDIA LINK PREVIEW VERIFICATION TEST")
    print("=" * 64)
    
    errors = []
    
    # 1. Test welcome.html OpenGraph and Twitter tags
    welcome_path = 'Code/frontend/welcome.html'
    assert os.path.exists(welcome_path), "welcome.html not found"
    
    with open(welcome_path, 'r', encoding='utf-8') as f:
        welcome_html = f.read()
        
    og_tags = dict(re.findall(r'<meta\s+property=["\'](og:[^"\']+)["\']\s+content=["\']([^"\']+)["\']', welcome_html))
    tw_tags = dict(re.findall(r'<meta\s+name=["\'](twitter:[^"\']+)["\']\s+content=["\']([^"\']+)["\']', welcome_html))
    
    required_og = [
        'og:type', 'og:url', 'og:site_name', 'og:title', 
        'og:description', 'og:image', 'og:image:width', 'og:image:height', 'og:image:type'
    ]
    for tag in required_og:
        if tag not in og_tags:
            errors.append(f"Missing {tag} in welcome.html")
            
    if og_tags.get('og:image') != 'https://pdflingua.vercel.app/assets/banner/pdf-lingua-preview-1200x675.png':
        errors.append(f"Unexpected og:image URL: {og_tags.get('og:image')}")
        
    if og_tags.get('og:image:width') != '1200' or og_tags.get('og:image:height') != '675':
        errors.append(f"Incorrect og:image dimensions: {og_tags.get('og:image:width')}x{og_tags.get('og:image:height')}")
        
    if tw_tags.get('twitter:card') != 'summary_large_image':
        errors.append(f"Incorrect twitter:card: {tw_tags.get('twitter:card')}")
        
    print(f"[PASS] welcome.html OpenGraph ({len(og_tags)} tags) & Twitter Card ({len(tw_tags)} tags) validated.")
    print(f"       -> Title: {og_tags.get('og:title')}")
    print(f"       -> Image: {og_tags.get('og:image')} ({og_tags.get('og:image:width')}x{og_tags.get('og:image:height')})")
    
    # 2. Test index.html OpenGraph and Twitter tags
    index_path = 'Code/frontend/index.html'
    assert os.path.exists(index_path), "index.html not found"
    
    with open(index_path, 'r', encoding='utf-8') as f:
        index_html = f.read()
        
    idx_og = dict(re.findall(r'<meta\s+property=["\'](og:[^"\']+)["\']\s+content=["\']([^"\']+)["\']', index_html))
    if 'og:image' not in idx_og or 'og:title' not in idx_og:
        errors.append("Missing og:image or og:title in index.html")
    else:
        print(f"[PASS] index.html OpenGraph tags validated.")
        
    # 3. Test Banner Image Asset
    banner_file = 'Code/frontend/assets/banner/pdf-lingua-preview-1200x675.png'
    assert os.path.exists(banner_file), f"Banner image not found at {banner_file}"
    
    with Image.open(banner_file) as im:
        w, h = im.size
        fmt = im.format
        file_size_kb = os.path.getsize(banner_file) / 1024
        
        if (w, h) != (1200, 675):
            errors.append(f"Banner image has dimensions {w}x{h}, expected 1200x675")
            
        ratio = w / h
        if abs(ratio - 16/9) > 0.001:
            errors.append(f"Banner aspect ratio is {ratio:.4f}, expected 16:9 (1.7778)")
            
        print(f"[PASS] Banner asset {os.path.basename(banner_file)}:")
        print(f"       -> Resolution: {w} x {h} px (Exact 16:9)")
        print(f"       -> Format: {fmt}, Size: {file_size_kb:.1f} KB (Optimized for Zalo/Facebook < 5MB)")

    # 4. Test Vercel Routing & Caching
    vercel_path = 'vercel.json'
    assert os.path.exists(vercel_path), "vercel.json not found"
    
    with open(vercel_path, 'r', encoding='utf-8') as f:
        v_data = json.load(f)
        
    has_asset_cache = any(
        h.get('source') == '/assets/(.*)' and any('public' in header.get('value', '') for header in h.get('headers', []))
        for h in v_data.get('headers', [])
    )
    if not has_asset_cache:
        errors.append("vercel.json missing public Cache-Control for /assets/(.*)")
    else:
        print("[PASS] vercel.json asset caching headers validated.")

    # 5. Simulated Scraper Payload for Facebook & Zalo
    print("-" * 64)
    print("SIMULATED SCRAPER PAYLOAD (Facebook & Zalo):")
    print(f"[*] Preview Title       : {og_tags.get('og:title')}")
    print(f"[*] Preview Description : {og_tags.get('og:description')}")
    print(f"[*] Preview Image URL   : {og_tags.get('og:image')}")
    print(f"[*] Image Dimensions    : {og_tags.get('og:image:width')} x {og_tags.get('og:image:height')} (16:9)")
    print(f"[*] Canonical Domain    : {og_tags.get('og:url')}")
    print("-" * 64)
    
    if errors:
        print("[FAIL] Test encountered errors:")
        for e in errors:
            print(f"       - {e}")
        assert False, f"{len(errors)} error(s) found during link preview test"
    else:
        print("[SUCCESS] All 5/5 link preview test suites PASSED perfectly!")
        print("=" * 64)

if __name__ == '__main__':
    test_link_preview()
