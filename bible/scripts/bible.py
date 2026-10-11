#!/usr/bin/env python3
"""Look up and search the bundled public-domain Bible (KJV 1769 with the
deuterocanonical books) using Orthodox book names and Septuagint numbering.

Usage:
  bible.py "John 1:1-14"            a passage
  bible.py "1 Kingdoms 17"          Orthodox names work (= 1 Samuel 17)
  bible.py "Psalm 50" --lxx         LXX psalm number, converted to the KJV number
  bible.py --search "burning bush"  search every book (add --book Exodus to narrow)
  bible.py --books                  list the books
"""
import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BIBLE = os.path.join(HERE, "..", "assets", "bible")

# alias (lowercase, no dots/spaces) -> book name used in the files
ALIASES = {
    "gen": "Genesis", "genesis": "Genesis", "ex": "Exodus", "exod": "Exodus", "exodus": "Exodus",
    "lev": "Leviticus", "leviticus": "Leviticus", "num": "Numbers", "numbers": "Numbers",
    "deut": "Deuteronomy", "deuteronomy": "Deuteronomy", "josh": "Joshua", "joshua": "Joshua",
    "judg": "Judges", "judges": "Judges", "ruth": "Ruth",
    "1sam": "I Samuel", "1samuel": "I Samuel", "1kingdoms": "I Samuel", "1kgdms": "I Samuel", "1reigns": "I Samuel",
    "2sam": "II Samuel", "2samuel": "II Samuel", "2kingdoms": "II Samuel", "2kgdms": "II Samuel", "2reigns": "II Samuel",
    "1kgs": "I Kings", "1kings": "I Kings", "3kingdoms": "I Kings", "3kgdms": "I Kings", "3reigns": "I Kings",
    "2kgs": "II Kings", "2kings": "II Kings", "4kingdoms": "II Kings", "4kgdms": "II Kings", "4reigns": "II Kings",
    "1chr": "I Chronicles", "1chron": "I Chronicles", "1chronicles": "I Chronicles", "1paraleipomenon": "I Chronicles",
    "2chr": "II Chronicles", "2chron": "II Chronicles", "2chronicles": "II Chronicles", "2paraleipomenon": "II Chronicles",
    "ezra": "Ezra", "2ezra": "Ezra", "2esdras": "Ezra", "neh": "Nehemiah", "nehemiah": "Nehemiah",
    "1ezra": "I Esdras", "1esdras": "I Esdras", "3esdras": "II Esdras", "4ezra": "II Esdras", "4esdras": "II Esdras",
    "esth": "Esther", "esther": "Esther", "addesth": "Additions to Esther", "additionstoesther": "Additions to Esther",
    "job": "Job", "ps": "Psalms", "psa": "Psalms", "psalm": "Psalms", "psalms": "Psalms",
    "prov": "Proverbs", "proverbs": "Proverbs", "eccl": "Ecclesiastes", "eccles": "Ecclesiastes", "ecclesiastes": "Ecclesiastes",
    "song": "Song of Solomon", "songofsongs": "Song of Solomon", "songofsolomon": "Song of Solomon", "canticles": "Song of Solomon",
    "isa": "Isaiah", "isaiah": "Isaiah", "jer": "Jeremiah", "jeremiah": "Jeremiah",
    "lam": "Lamentations", "lamentations": "Lamentations", "ezek": "Ezekiel", "ezekiel": "Ezekiel",
    "dan": "Daniel", "daniel": "Daniel", "hos": "Hosea", "hosea": "Hosea", "joel": "Joel", "amos": "Amos",
    "obad": "Obadiah", "obadiah": "Obadiah", "jonah": "Jonah", "mic": "Micah", "micah": "Micah",
    "nah": "Nahum", "nahum": "Nahum", "hab": "Habakkuk", "habakkuk": "Habakkuk",
    "zeph": "Zephaniah", "zephaniah": "Zephaniah", "hag": "Haggai", "haggai": "Haggai",
    "zech": "Zechariah", "zechariah": "Zechariah", "mal": "Malachi", "malachi": "Malachi",
    "tob": "Tobit", "tobit": "Tobit", "jdt": "Judith", "judith": "Judith",
    "wis": "Wisdom", "wisdom": "Wisdom", "wisdomofsolomon": "Wisdom",
    "sir": "Sirach", "sirach": "Sirach", "wisdomofsirach": "Sirach", "ecclus": "Sirach", "ecclesiasticus": "Sirach",
    "bar": "Baruch", "baruch": "Baruch", "epistleofjeremiah": "Baruch", "letterofjeremiah": "Baruch",
    "prayerofazariah": "Prayer of Azariah", "songofthethree": "Prayer of Azariah", "songofthethreeyoungmen": "Prayer of Azariah",
    "sus": "Susanna", "susanna": "Susanna", "bel": "Bel and the Dragon", "belandthedragon": "Bel and the Dragon",
    "prman": "Prayer of Manasses", "prayerofmanasseh": "Prayer of Manasses", "prayerofmanasses": "Prayer of Manasses", "manasseh": "Prayer of Manasses",
    "1macc": "I Maccabees", "1maccabees": "I Maccabees", "2macc": "II Maccabees", "2maccabees": "II Maccabees",
    "matt": "Matthew", "mt": "Matthew", "matthew": "Matthew", "mk": "Mark", "mark": "Mark",
    "lk": "Luke", "luke": "Luke", "jn": "John", "john": "John", "acts": "Acts",
    "rom": "Romans", "romans": "Romans", "1cor": "I Corinthians", "1corinthians": "I Corinthians",
    "2cor": "II Corinthians", "2corinthians": "II Corinthians", "gal": "Galatians", "galatians": "Galatians",
    "eph": "Ephesians", "ephesians": "Ephesians", "phil": "Philippians", "philippians": "Philippians",
    "col": "Colossians", "colossians": "Colossians", "1thess": "I Thessalonians", "1thessalonians": "I Thessalonians",
    "2thess": "II Thessalonians", "2thessalonians": "II Thessalonians", "1tim": "I Timothy", "1timothy": "I Timothy",
    "2tim": "II Timothy", "2timothy": "II Timothy", "titus": "Titus", "phlm": "Philemon", "philemon": "Philemon",
    "heb": "Hebrews", "hebrews": "Hebrews", "jas": "James", "james": "James",
    "1pet": "I Peter", "1peter": "I Peter", "2pet": "II Peter", "2peter": "II Peter",
    "1jn": "I John", "1john": "I John", "2jn": "II John", "2john": "II John", "3jn": "III John", "3john": "III John",
    "jude": "Jude", "rev": "Revelation of John", "revelation": "Revelation of John", "apocalypse": "Revelation of John",
}
MISSING = {"3macc", "3maccabees", "4macc", "4maccabees", "psalm151", "ps151"}


def norm(name):
    name = name.lower().replace(".", "").replace(" ", "")
    for roman, num in (("iii", "3"), ("ii", "2"), ("iv", "4"), ("i", "1")):
        if name.startswith(roman) and len(name) > len(roman) and not name[len(roman)].isdigit():
            cand = num + name[len(roman):]
            if cand in ALIASES or cand in MISSING:
                return cand
    for pre in ("first", "second", "third", "fourth"):
        if name.startswith(pre):
            return str(("first", "second", "third", "fourth").index(pre) + 1) + name[len(pre):]
    return name


def load(book):
    for fn in sorted(os.listdir(BIBLE)):
        if fn.endswith(".txt") and fn[3:-4].replace("_", " ") == book:
            verses = []
            with open(os.path.join(BIBLE, fn), encoding="utf-8") as f:
                for line in f:
                    m = re.match(r"(\d+):(\d+) (.*)", line)
                    if m:
                        verses.append((int(m[1]), int(m[2]), m[3]))
            return verses
    sys.exit(f"Book file not found for {book}")


def lxx_to_kjv_psalm(ch, v1, v2):
    """Map an LXX psalm (and optional verse range) to KJV/Hebrew numbering.
    Returns list of (chapter, v_from, v_to). Superscription offsets are not adjusted."""
    INF = 999
    if v1 and not v2:
        v2 = v1
    def rng(c, a=None, b=None, off=0):
        a = v1 if v1 else (a or 1)
        b = v2 if v2 else INF
        return [(c, a + off, b + off if b != INF else INF)]
    if ch <= 8 or ch >= 148:
        return rng(ch)
    if ch == 9:
        return [(9, 1, INF), (10, 1, INF)] if not v1 else (
            [(9, v1, v2 or INF)] if v1 <= 21 else [(10, v1 - 21, (v2 - 21) if v2 else INF)])
    if 10 <= ch <= 112 or 116 <= ch <= 145:
        return rng(ch + 1)
    if ch == 113:
        return [(114, 1, INF), (115, 1, INF)] if not v1 else (
            [(114, v1, v2 or INF)] if v1 <= 8 else [(115, v1 - 8, (v2 - 8) if v2 else INF)])
    if ch == 114:
        return rng(116)
    if ch == 115:
        return rng(116, off=9)
    if ch == 146:
        return rng(147)
    if ch == 147:
        return rng(147, off=11)
    if ch == 151:
        sys.exit("Psalm 151 is not in the bundled KJV text.")
    return rng(ch)


def parse_ref(ref):
    m = re.match(r"\s*(.+?)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?(?:\s*-\s*(\d+))?\s*$", ref)
    if not m:
        sys.exit(f'Could not read the reference "{ref}". Try e.g. "John 3:16" or "Psalm 50".')
    key = norm(m[1])
    if key in MISSING:
        sys.exit("3-4 Maccabees and Psalm 151 are not in the bundled KJV text; answer from knowledge and say so.")
    if key not in ALIASES:
        sys.exit(f'Unknown book "{m[1]}". Run with --books to see the list.')
    return ALIASES[key], int(m[2]), int(m[3]) if m[3] else None, int(m[4]) if m[4] else None, int(m[5]) if m[5] else None


def show(book, ref, lxx):
    book, ch, v1, v2, ch2 = parse_ref(ref)
    verses = load(book)
    if book == "Psalms" and lxx:
        spans = lxx_to_kjv_psalm(ch, v1, v2)
        print(f"(LXX Psalm {ch} = KJV/Hebrew Psalm {', '.join(str(s[0]) for s in spans)})")
    elif ch2:
        spans = [(c, 1, 999) for c in range(ch, ch2 + 1)]
    else:
        spans = [(ch, v1 or 1, v2 or (v1 or 999))]
    out = [f"{c}:{v} {t}" for c, v, t in verses for (sc, a, b) in spans if c == sc and a <= v <= b]
    if not out:
        sys.exit(f"No verses found for {ref} in {book}.")
    print(f"== {book} ==")
    print("\n".join(out))


def search(query, book_filter, limit, regex):
    rx = re.compile(query if regex else re.escape(query), re.IGNORECASE)
    target = ALIASES.get(norm(book_filter)) if book_filter else None
    hits = 0
    for fn in sorted(os.listdir(BIBLE)):
        if not fn.endswith(".txt"):
            continue
        book = fn[3:-4].replace("_", " ")
        if target and book != target:
            continue
        for c, v, t in load(book):
            if rx.search(t):
                print(f"{book} {c}:{v}  {t}")
                hits += 1
                if hits >= limit:
                    print(f"(stopped at {limit}; use --max for more)")
                    return
    if not hits:
        print("No matches (remember the KJV wording, e.g. 'shew', 'saith').")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ref", nargs="?")
    ap.add_argument("--lxx", action="store_true", help="treat a Psalm number as Septuagint numbering")
    ap.add_argument("--search")
    ap.add_argument("--book")
    ap.add_argument("--regex", action="store_true")
    ap.add_argument("--max", type=int, default=40)
    ap.add_argument("--books", action="store_true")
    a = ap.parse_args()
    if a.books:
        print(open(os.path.join(BIBLE, "INDEX.tsv"), encoding="utf-8").read())
    elif a.search:
        search(a.search, a.book, a.max, a.regex)
    elif a.ref:
        show(None, a.ref, a.lxx)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
