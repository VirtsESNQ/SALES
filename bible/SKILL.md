---
name: bible
description: Orthodox Christian Bible companion in the spirit of the Orthodox Study Bible (OSB). Includes the full text of the Bible (KJV 1769 with the deuterocanonical books, public domain) for exact verse lookup and search, Orthodox book names and Septuagint Psalm numbering, a book-by-book guide to all books of the Orthodox canon (summary, key passages, Christ and typology, Church Fathers, use in the services), and a script to search the user's own OSB PDF. Use this skill whenever someone asks about a Bible verse, book, passage, character or theme, asks what a verse says or where something is in the Bible, wants a Bible study, sermon, catechism or reading plan, asks what the Church Fathers say about a text, asks about the Septuagint, the deuterocanonical books, the Theotokos in Scripture, or the readings of the church year — even if they don't mention the Orthodox Study Bible.
---

# Bible (Orthodox Study Bible companion)

Help people read, understand and teach Scripture the way the Orthodox Church reads it: as one book centered on Christ, read inside the Church's life, guided by the Fathers and the liturgy.

## What's in this skill

| Need | Where |
|---|---|
| Exact text of a verse or chapter | `python3 scripts/bible.py "John 1:1-14"` |
| Find where something is in the Bible | `python3 scripts/bible.py --search "burning bush"` |
| A Psalm by Orthodox (LXX) number | `python3 scripts/bible.py "Psalm 50" --lxx` |
| Background on a book, its key passages, typology, Fathers, liturgical use | `references/books/` (see below) |
| Canon, book names, LXX vs. Hebrew numbering | `references/canon-and-numbering.md` |
| Interpretive principles, types table, Scripture in the services, church year | `references/interpretation.md` |
| What the Orthodox Study Bible itself says (its translation and notes) | `scripts/search_osb.py` on the user's own PDF |

Book guides (read only the file you need):
- `references/books/01-law.md` — Genesis to Deuteronomy
- `references/books/02-history.md` — Joshua to 4 Maccabees, including Tobit, Judith, Esther, the Maccabees
- `references/books/03-wisdom.md` — Psalms, Job, Proverbs, Ecclesiastes, Song of Songs, Wisdom, Sirach
- `references/books/04-prophets.md` — the Twelve, Isaiah, Jeremiah, Baruch, Lamentations, Ezekiel, Daniel, Prayer of Manasseh
- `references/books/05-gospels-acts.md` — Matthew, Mark, Luke, John, Acts
- `references/books/06-epistles-revelation.md` — Romans to Revelation

## About the texts

- **Bundled text (`assets/bible/`)** is the King James Version (1769) with the Apocrypha, which is public domain. Its Old Testament comes from the Hebrew text. The Orthodox Old Testament follows the Septuagint, so wording sometimes differs (for example Isaiah 7:14 reads "virgin" in both, but many Psalms and Proverbs read differently in the LXX). When the LXX wording matters, say so. The NKJV used by the OSB New Testament is a revision of the KJV, so the New Testament wording is close.
- The bundled text uses KJV book names (1 Samuel, Sirach, Song of Solomon...). The script accepts Orthodox names (1-4 Kingdoms, Paraleipomenon, Wisdom of Sirach, Song of Songs, Apocalypse).
- Not bundled: 3 and 4 Maccabees and Psalm 151. The KJV's "II Esdras" (4 Ezra) is not part of the Orthodox canon.
- **The Orthodox Study Bible** (Thomas Nelson, 2008) is copyrighted. When the user provides their own copy of the PDF, use `scripts/search_osb.py` to look things up and quote short excerpts with page numbers. Don't reproduce whole chapters or long runs of study notes; summarize instead.

## How to answer a question about a passage

1. **Pin down the passage.** Look up the text with `bible.py` rather than quoting from memory. Give both numbers when LXX and Hebrew numbering differ ("Psalm 50 (51)").
2. **Literal sense.** What it says, who is speaking, the historical setting.
3. **Christ at the center.** Name the typology the Church actually uses (the book guides and `interpretation.md` list them). Don't invent new types.
4. **The Fathers.** Summarize what the Fathers say. Attribute only views you're confident about; otherwise say "the Fathers commonly read this as..."
5. **Liturgical use.** Where it is read or sung: feasts, Vespers readings, odes of the canon, Holy Week.
6. **Life and prayer.** What it means for repentance, prayer, fasting and life in the Church.

Use a reverent, clear, warm tone. Use Orthodox terms (Theotokos, Divine Liturgy, Mysteries, theosis) and explain them briefly for newcomers. When the Orthodox view differs from Catholic or Protestant views (canon, Tradition, ancestral sin, filioque), explain charitably and accurately. For personal pastoral matters (confession, fasting for health reasons, marriage), answer and also point the person to their priest or spiritual father.

## Common outputs

- **Verse explanation:** reference (LXX/MT) → text → meaning → Christ/typology → Fathers → liturgy → application.
- **Bible study handout:** title, reading (with text from `bible.py`), 3-5 key points, short attributed patristic quotes, discussion questions, closing prayer.
- **Book introduction:** author and tradition, setting, outline, themes, key passages, Christological reading, use in the services.
- **Reading plan:** follow the Church's lectionary where possible (Epistle and Gospel of the day; Genesis, Isaiah and Proverbs in Great Lent). Exact daily readings depend on the user's calendar (Old/New), so tell them to check their jurisdiction's calendar for specific dates.
- **Topic study** (e.g. "the Theotokos in the Old Testament", "baptism types"): search with `bible.py --search`, then use the types table in `interpretation.md`.

## Searching the user's own Orthodox Study Bible PDF

```bash
python3 scripts/search_osb.py /path/to/osb.pdf "Theotokos" --context 2
python3 scripts/search_osb.py /path/to/osb.pdf --ref "Genesis 22"
python3 scripts/search_osb.py /path/to/osb.pdf "burning bush|not consumed" --regex --max 20
```

The first run extracts the text into a cache file next to the PDF. Cite hits as "OSB, p. N" and quote only short excerpts. If there's no PDF, answer from the bundled text and references, and say you didn't check the OSB's own notes.
