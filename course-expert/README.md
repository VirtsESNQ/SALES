# course-expert: Wissenssystem & Claude Skill zum Vertriebskurs von Patrick Helm

Dieses Verzeichnis macht aus dem vollständigen Kurstranskript (`Sales_Originial_PH_transcript.txt`, ca. 36 Stunden, 23 Module) ein **originalgetreues Expertensystem** und einen **Claude Skill**. Es ist keine Zusammenfassung: Skripte, Formulierungen, Regeln, Fälle, Widersprüche und Zeitstempel sind erhalten.

## Struktur
```
course-expert/
├── SKILL.md                    ← Einstieg für Claude: Rolle, Regeln, Retrieval-Index, Antwortmodi
├── README.md                   ← diese Datei
├── knowledge/
│   ├── course-map.md           ← 23 Module mit Zeitraum, Sprecher, Themen, Lernreihenfolge
│   ├── core-concepts.md        ← 30 Kernkonzepte (K01–K30)
│   ├── frameworks.md           ← 41 Frameworks/Modelle (F01–F41)
│   ├── strategies.md           ← 19 übergeordnete Strategien (ST01–ST19)
│   ├── decision-rules.md       ← 63 WENN/DANN/WEIL/AUSNAHME/QUELLE-Regeln (R01–R63)
│   ├── processes.md            ← 8 Ablaufpläne (P01–P08)
│   ├── playbook.md             ← Situation → Sofortmaßnahme
│   └── advanced-concepts.md    ← DISG · Transaktionsanalyse · Manipulation & Ethik
├── language/
│   ├── scripts.md              ← wörtliche Skripte nach Situation (S1–S15)
│   ├── phrase-library.md       ← Bausteine, Streichelphrasen, 6 Gegenfrage-Muster, Theorie vs. Praxis
│   ├── language-patterns.md    ← 28 Satzbaupläne (LP01–LP28)
│   ├── objection-handling.md   ← Einwand-Bibliothek (E1–E8)
│   └── tone-of-voice.md        ← Tonalität, Pausen, Wortwahl, Patricks Stil
├── examples/
│   ├── examples.md             ← Original → Kursanwendung → Adaption
│   ├── case-studies.md         ← 27 Fallstudien (C01–C27)
│   └── analogies.md            ← 78 Analogien & Geschichten (A01–A78)
└── reference/
    ├── mistakes-and-warnings.md       ← DON'Ts, Ethik- und Rechtsflags
    ├── contradictions-and-evolution.md← 32 Widersprüche/Entwicklungen (W1–W32)
    ├── glossary.md
    ├── faq.md
    └── source-map.md                  ← Thema → Zeitstempel
```

## Konventionen
- **Kennzeichnung:** `[EXPLIZIT]` (Kurs) · `[INFERENZ]` (Ableitung) · `[EXTERN]` (Fremdwissen) · `[unklar im Transkript]`
- **Gewichtung:** Tier 1–4, HIGH LEVERAGE, Konfidenz hoch/mittel/niedrig
- **Skripte:** ORIGINAL · KURSBASIERTE ANWENDUNG · ADAPTION
- **Zeitstempel:** `[HH:MM:SS]` = Beginn des Transkript-Absatzes. „ca.“ bzw. „Abschnitt X–Y“ = Bereichsangabe. Es gibt keine erfundenen Zeitstempel.
- **Ethik:** ⚠️ markiert Kursstellen mit Täuschungs- oder Rechtsrisiko. Der Skill erklärt sie, empfiehlt sie aber nicht (siehe `SKILL.md` Regel 6).

## Nutzung als Claude Skill
1. Den Ordner `course-expert/` als Skill-Verzeichnis einbinden (z. B. in `~/.claude/skills/` oder `.claude/skills/` eines Projekts).
2. `SKILL.md` ist der Einstiegspunkt. Die Frontmatter `name`/`description` steuern, wann der Skill geladen wird.
3. Beispielanfragen:
   - „Erklär mir die 5 Rahmenbedingungen.“ → Explain
   - „Gib mir das Gatekeeper-Skript wörtlich.“ → Script
   - „Bau mir einen Pitch für meine Steuerkanzlei.“ → Apply (mit ADAPTION)
   - „Spiel einen roten GF, ich rufe kalt an.“ → Roleplay
   - „Wo sagt Patrick, dass der Opener overused ist?“ → Retrieve
   - „Meine Kunden sagen immer ‚schicken Sie mir ein Angebot‘.“ → Troubleshoot

## Quelle & Grenzen
- **Hauptsprecher:** Patrick Helm. **Ausnahmen:** das Content-Modul (Sprecher „Tim“) und die Bewerbungs-Calls (Pascal Schreiber).
- **Transkript:** Es entstand automatisch, Hörfehler sind möglich und markiert. Es endet bei 36:12:42 mitten im Social-DM-Kurs.
- **Nicht enthalten:** Worksheets, Workbooks, PDFs und der vollständige Tonalitäts-Masterclass-Mitschnitt.
- **Rechtliches** (UWG, DSGVO, Widerruf): nur Wiedergabe der Kursaussagen mit Prüfhinweis, keine Rechtsberatung.
