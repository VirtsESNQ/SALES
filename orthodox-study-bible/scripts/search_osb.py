#!/usr/bin/env python3
"""Search a local copy of the Orthodox Study Bible PDF.

The first run extracts the text page by page into a cache file next to the PDF
(<pdf>.osb_cache.txt) so later searches are fast.

Usage:
  search_osb.py PDF "text"                 plain, case-insensitive search
  search_osb.py PDF "a|b" --regex          regular expression search
  search_osb.py PDF --ref "Genesis 22"     find a chapter heading / reference
  options: --context N (lines around each hit, default 1), --max N (default 30)
"""
import argparse
import os
import re
import shutil
import subprocess
import sys

PAGE_BREAK = "\f"


def extract_pages(pdf):
    cache = pdf + ".osb_cache.txt"
    if os.path.exists(cache) and os.path.getmtime(cache) >= os.path.getmtime(pdf):
        with open(cache, encoding="utf-8") as f:
            return f.read().split(PAGE_BREAK)

    print("Extracting text from PDF (first run only)...", file=sys.stderr)
    if shutil.which("pdftotext"):
        text = subprocess.run(
            ["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True, check=True
        ).stdout
        pages = text.split(PAGE_BREAK)
    else:
        try:
            from pypdf import PdfReader
        except ImportError:
            sys.exit("Need pdftotext (poppler-utils) or the pypdf package: pip install pypdf")
        pages = [p.extract_text() or "" for p in PdfReader(pdf).pages]

    try:
        with open(cache, "w", encoding="utf-8") as f:
            f.write(PAGE_BREAK.join(pages))
    except OSError:
        pass  # read-only location: just skip caching
    return pages


def ref_pattern(ref):
    # "Genesis 22" or "Gen 22:1" -> book name followed by the chapter number
    m = re.match(r"\s*((?:[1-4]\s*)?[A-Za-z][A-Za-z .]*?)\s+(\d+)(?::(\d+))?\s*$", ref)
    if not m:
        return re.escape(ref)
    book, chap, verse = m.groups()
    book = r"\s*".join(re.escape(w) for w in book.split())
    tail = rf"\s*[:.]\s*{verse}\b" if verse else r"\b"
    return rf"\b{book}\w*\.?\s+{chap}{tail}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf")
    ap.add_argument("query", nargs="?")
    ap.add_argument("--ref", help='scripture reference, e.g. "Psalm 50" or "John 1:14"')
    ap.add_argument("--regex", action="store_true")
    ap.add_argument("--context", type=int, default=1)
    ap.add_argument("--max", type=int, default=30)
    a = ap.parse_args()

    if not (a.query or a.ref):
        ap.error("give a search text or --ref")
    if not os.path.exists(a.pdf):
        sys.exit(f"PDF not found: {a.pdf}")

    if a.ref:
        pattern = ref_pattern(a.ref)
    elif a.regex:
        pattern = a.query
    else:
        pattern = re.escape(a.query)
    rx = re.compile(pattern, re.IGNORECASE)

    hits = 0
    for pno, page in enumerate(extract_pages(a.pdf), start=1):
        lines = page.splitlines()
        for i, line in enumerate(lines):
            if rx.search(line):
                lo, hi = max(0, i - a.context), min(len(lines), i + a.context + 1)
                snippet = "\n    ".join(l.strip() for l in lines[lo:hi] if l.strip())
                print(f"[p. {pno}]\n    {snippet}\n")
                hits += 1
                if hits >= a.max:
                    print(f"(stopped at {a.max} hits; use --max to see more)")
                    return
    if hits == 0:
        print("No matches. Try a shorter phrase, a different spelling, or --regex.")


if __name__ == "__main__":
    main()
