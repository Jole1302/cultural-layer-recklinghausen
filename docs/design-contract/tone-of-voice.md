# Tone of Voice — Cultural Layer Recklinghausen

**Status:** DRAFT v0.2 — 3 anchors locked, copy adjusted
**Date:** 2026-05-04
**Source pivot:** DEC-001 (target = Kreis Recklinghausen, NOT Berlin)
**Replaces:** Berlin-Salon tone of `KultA v0.4` prototype (`/home/jakob/Downloads/KultA/`)

## Locked anchors (v0.2, 2026-05-04)

| Anchor | Decision |
|---|---|
| **Brand name** | `KultA` (carries over from prototype; tone-of-voice will localize the copy, name stays) |
| **Geographic handle** | `im Ruhrgebiet` as default. Concrete city names (Recklinghausen, Marl, Herten, Datteln, Castrop-Rauxel) where possible |
| **Anrede** | **Sie-Form everywhere.** No Du-branch for artist↔venue. Public, dashboards, emails, errors — all Sie. |

---

## What this document is

A **design contract** for written voice. Every label, button, eyebrow, error message, email, and microcopy in v1 must pass against this contract. Inputs to `/gsd-ui-phase 01` and beyond.

## What this document is NOT

- Not a brand book (no logo, no marketing positioning)
- Not visual design (palette + typography stay from `kulta-v0.4`: Merriweather + Inter + JetBrains Mono on paper-terracotta — see DEC-016)
- Not legal/UX writing (those are separate concerns: GDPR cookie banner copy, accessibility labels)

---

## 1. Voice principles

Seven rules. In conflict: rule 1 wins, then 2, etc.

### 1.1 Direkt vor blumig

Plain German over flowery prose. "Termin am 12. Juni, 19 Uhr, in der Zeche Recklinghausen" beats "Ein magischer Abend voller Klänge erwartet Sie am 12. Juni".

### 1.2 «Wir hier» nicht «ich, der Künstler»

Kollegial, plural, communal. The Ruhr-Lokalpatriot identity is **wir** — Bergmannskinder, Vesterländer, Pottianer. Avoid the lonely-genius first-person artist voice.

### 1.3 Bodenständig statt kuratiert

«Ausgewählt», «vorgeschlagen», «empfohlen» — not «kuratiert», «handverlesen», «exklusiv». The platform is a **bulletin board** with quality, not a **gallery curator**.

### 1.4 Unaufgeregt, mit Trockenhumor wo passend

Calm confidence. Ruhr humor is dry, self-deprecating, observational. Never frantic, never urgent (no "JETZT BUCHEN!"). If a joke lands, it lands flat — Ruhr-style.

### 1.5 Konkrete Stadt vor «Ruhrgebiet» — wenn möglich

«Ruhrgebiet» ist der Default-Bereichsname (locked). Aber wenn ein konkreter Ort genannt werden kann (Marl, Herten, Datteln, Castrop-Rauxel, Recklinghausen), tu das. «Im Ruhrgebiet» ist der breite Container; konkrete Städte sind die wertvolle Information. «In Deutschland» — fast nie.

### 1.6 Kostenlos, nicht «kostenlos!»

Free RSVP is the v1 wedge (DEC-022 rejects Stripe, REQ-out-of-scope-v1). Don't celebrate it like a marketing perk. State it neutrally: «Eintritt frei. Anmeldung erforderlich.» Once. Move on.

### 1.7 Glück auf — sparsam

The miner's greeting is real and active in Ruhr. Use it **once or twice in the whole product**, in earned moments (welcome email, ticket footer). Spamming it = pastiche.

---

## 2. Anti-tone — what we are NOT

Specific anti-references from the `KultA v0.4` prototype that **must not carry over**:

| KultA prototype phrase | Why it fails for Recklinghausen |
|---|---|
| «Gegen den Lärm. Für Kultur im Wohnzimmer.» | Berlin-Salon. We are not Wohnzimmer-Konzert; we are **Zechen, Lofts, Vestlandhalle, Lichthof**. |
| «22 Stühle, eine Geschichte, ein Abend.» | Bourgeois-intimist. Ruhr venues range from 15 to 200 Plätze; precious-counting is wrong. |
| «Keine Algorithmen» | Berlin tech-rebel posture. Our audience does not have a relationship with algorithms to rebel against. |
| «Intim. Analog. Echt.» | Bauhaus-minimalist tagline cliché. Ruhr trades in concrete nouns, not abstract adjectives. |
| «Berlin — Leipzig — Hamburg» | Wrong geography (DEC-001). |
| «Kuratiert von …» | Pretentious. Use «vorgeschlagen von …» or just «von …». |
| «85 % geht an Künstler» | Commerce framing. v1 is free; revenue split is irrelevant. |
| «exklusiv», «handverlesen», «premium» | Status-signaling vocabulary. Anti-Lokalpatriot. |

---

## 3. Lexicon

### 3.1 Use freely

- **Abend** — preferred over «Event», «Veranstaltung» (the latter is OK in admin/legal contexts)
- **Ruhrgebiet** — default geographic handle (locked v0.2)
- **Pott**, **Ruhrpott** — affectionate self-name. Goes well in casual moments. Equivalent register to «Ruhrgebiet» but warmer; alternate sparingly.
- **Vest**, **Vestisches Land** — historical name for Kreis Recklinghausen. Available as **secondary local color** when context is clearly Recklinghausen-internal (admin views, local-events callouts). Not a default.
- **Halle**, **Loft**, **Atelier**, **Zeche**, **Gasometer**, **Lichthof**, **Hinterhof**, **Werkstatt** — concrete venue types.
- **Künstler:in** — gender-fair (`:` Doppelpunkt), not Künstler*in (asterisk reads worse in Ruhr).
- **Gastgeber:in** — for venues. Not «Veranstalter» (too corporate), not «Host» (too anglo).
- **Bezirk**, **Stadtteil**, **Ortsteil** — when sub-city precision matters.
- **Anmelden / Platz reservieren / Reservierung** — for RSVP. Not «Tickets kaufen», not «Buchen», not «Sichern».
- **Programm** — the feed. Magazine-feel. Better than «Events», «Feed», «Veranstaltungen».
- **Reihe**, **Abendreihe** — if multiple events recur (out of scope v1, but reserve the word).
- **Glück auf** — once or twice total in the product.

### 3.2 Use with care

- **Kultur** — in the brand name. Don't repeat in every paragraph.
- **Kuratiert** — banned at h1/eyebrow level. May appear in admin moderation logs only.
- **Authentisch** — overused; prefer concrete nouns («im Lichthof», «in der ehemaligen Wäscherei»).
- **Lokal** — fine, but better to name the city.

### 3.3 Avoid

- **Wohnzimmer-Konzert**, **Salon**, **Stube** — Berlin-import imagery
- **Premium**, **exklusiv**, **handverlesen**, **erlesen** — status signaling
- **Magisch**, **unvergesslich**, **einzigartig** — hyperbole
- **Tickets**, **buchen**, **kaufen** (in the RSVP context)
- **Algorithmus** — irrelevant to audience
- **Echt!**, **wirklich!**, **endlich!** — exclamation marks generally; max one per page surface
- **Du-Form** in admin/system messages (Sie-Form for confirmations and legal; Du-Form acceptable in artist-to-artist invites only — to be settled in §6)

### 3.4 Sie-Form — locked

**All surfaces use Sie-Form.** No exceptions: public, dashboards, artist-to-venue invites, admin, system messages, errors, emails. Consistency over peer-feel.

This means: «Klicken Sie», «Ihr Termin», «Sie haben eingeladen», never «Klicke», «dein Termin», «du hast eingeladen».

---

## 4. Geographic anchors

Real, named places we should be ready to mention. Drawn from PROJECT.md scope (Kreis Recklinghausen + neighbours).

### 4.1 Cities we serve

Recklinghausen · Marl · Herten · Datteln · Castrop-Rauxel · Oer-Erkenschwick · Waltrop · Dorsten · Haltern am See

### 4.2 Industrial / cultural anchors (non-exhaustive, as plausible venue archetypes)

- **Zeche Recklinghausen** (Vestisches Zentrum) — closed colliery, used for events
- **Festspielhaus Recklinghausen** — Ruhrfestspiele (anchor cultural institution since 1947)
- **Vestlandhalle** — Recklinghausen multipurpose hall
- **Zeche Ewald**, Herten — landmark site, post-industrial conversion
- **Theater Marl**, **Glaskasten Marl** — established venues
- **Lichthof Marl** — industrial-modernist landmark
- **Kulturetage Datteln** — small-format venue
- **Brauerei-Höfe**, **alte Wäschereien**, **Hinterhöfe** — vernacular «non-traditional venues»
- **Halde Hoheward** (Herten) — Ruhr-postindustrial landmark, Förderturm-and-sky cultural identity

These names are **anchors for tone**, not a curated list of partners. Use them in copy where plausible. **Do not invent** venues that don't exist.

### 4.3 Historical / identity reference points

- Last Zeche of Ruhr (Prosper-Haniel) closed 2018 — Strukturwandel narrative
- Steigerlied / «Glück auf» — miner heritage, still alive in everyday speech
- Ruhrfestspiele Recklinghausen — federal-level cultural anchor since 1947
- Ruhrgebiet 2010 — European Capital of Culture — collective cultural-pride memory

---

## 5. Component-by-component rewrites

Below: the KultA prototype's Berlin copy and a Recklinghausen-tone replacement draft. Mark up freely.

### 5.1 Hero (landing `/`)

**Before (KultA):**
> ~~Gegen~~ den Lärm.
> Für *Kultur*
> im Wohnzimmer.
>
> KultA verbindet Gäste mit unabhängigen Künstlern und ungewöhnlichen Orten. Keine Arena. Keine Algorithmen. Nur 22 Stühle, eine Geschichte, ein Abend.

**After draft (v0.2):**
> Programm
> aus dem *Ruhrgebiet*.
>
> Konzerte, Lesungen und Performances in Lofts, Zechen und Hinterhöfen — von Künstler:innen, die hier wohnen, in Räumen, die hier stehen. Eintritt frei, Anmeldung mit einem Klick.

Notes:
- Strikethrough decoration from KultA removed (anti-pose)
- «Wohnzimmer» → «Lofts, Zechen, Hinterhöfen» (concrete, plural, regional)
- «22 Stühle, eine Geschichte» → just facts
- «Eintritt frei» said once, neutrally
- «aus dem Ruhrgebiet» (locked geo-handle)

### 5.2 Eyebrow / edition marker

**Before (KultA):**
> Berlin · Ausgabe 04 · Frühling 2026

**After draft (v0.2):**
> Ruhrgebiet · Programm Mai 2026
*— oder, falls «Ausgabe»-Fanzine-Framing gewünscht —*
> Ruhrgebiet · Ausgabe 01 · Mai 2026

Pick one in iteration. The «Ausgabe» framing is magazine-strong but only earned if real new editions ship monthly. (See §6 q1 — open.)

### 5.3 Marquee / ticker (landing band)

**Before (KultA):**
> 22 Stühle · Keine Algorithmen · Nur Live · Berlin — Leipzig — Hamburg · Intim. Analog. Echt.

**After draft (v0.2):**
> Marl · Herten · Datteln · Castrop-Rauxel · Recklinghausen · ✺ · Eintritt frei · Anmeldung mit einem Klick · Aus dem Ruhrgebiet · ✺

Notes:
- City list replaces Berlin-Leipzig-Hamburg (DEC-001) — concrete cities are the high-value information per §1.5
- «Aus dem Ruhrgebiet» = locked geo-handle as the broad container
- Drops abstract adjectives in favor of concrete service facts
- Keeps the `✺` separator from KultA — magazine-typography native, tone-agnostic

### 5.4 Manifest § 02 (the three-point pledge)

**Before (KultA):**
> 01. Kein Saal ist zu klein. Ein Wohnzimmer mit neun Stühlen ist eine Bühne.
> 02. Keine Wiederholung. Jeder Abend existiert einmal. Keine Aufnahmen, kein Livestream.
> 03. Faire Teilung. 85 % geht an Künstler und Gastgeber.

**After draft (v0.2):**
> 01. **Hier vor dort.** Wer im Ruhrgebiet spielt, spielt für Menschen aus dem Ruhrgebiet. Kein Berlin-Bonus.
> 02. **Bestätigt von beiden Seiten.** Ein Abend kommt erst auf das Programm, wenn Künstler:in und Gastgeber:in zugesagt haben.
> 03. **Eintritt frei.** Wir nehmen keine Gebühr, keine Provision. Wer kommen will, meldet sich an. Wer nicht kommt, gibt den Platz wieder frei.

Notes:
- §01 replaces «Saal-too-small» (Berlin-intimist) with **regional-pride** (DEC-001 alignment); «Ruhrgebiet» per locked geo-handle
- §02 names the **bilateral marketplace** mechanic (REQ-bilateral-marketplace-state-machine) — turns a backend invariant into a public-facing trust signal
- §03 replaces 85/15 split with «free, no commission» (DEC-022, REQ-out-of-scope-v1)

### 5.5 RSVP confirmation (post-RSVP screen)

**Before (KultA):**
> Bis *bald*.
> Das Ticket liegt in Ihrer Brieftasche. Am Abend der Veranstaltung zeigen Sie den QR-Code am Eingang. Eine Bestätigung wurde an Ihre E-Mail gesendet.

**After draft:**
> Platz reserviert.
> Ihr Code für den Einlass liegt unter «Meine Termine». An der Tür einmal scannen — fertig. Eine Bestätigung kommt gleich per Mail.
>
> *Glück auf.*

Notes:
- «Ticket» → «Code für den Einlass» (free, not commerce)
- «Brieftasche» → «Meine Termine» (clearer route name; need to align with IA doc)
- «Glück auf» earned here as one of the two allowed instances — it's a real moment of human warmth

### 5.6 Empty / cold-start state (when <2 published events)

This is a **cold-start landing variant** mandated by REQ-public-feed («waitlist CTA when <2 PUBLISHED»).

**Draft (v0.2):**
> Noch leise im Ruhrgebiet.
>
> Im Moment ist kein Abend angekündigt. Wir benachrichtigen Sie, sobald die nächste Lesung, das nächste Konzert oder die nächste Performance live geht.
>
> [Eintragen — wir schreiben einmal, wenn etwas kommt.]
>
> Wenn Sie selbst einen Abend gestalten oder einen Raum öffnen wollen: [Mitmachen →]

Notes:
- Honest about cold-start — does not pretend platform is busy
- «Noch leise» plays Ruhr-laconic
- Two paths: passive (waitlist) and active (sign up as artist/venue)

### 5.7 Magic-link email (Better Auth template)

**Before (KultA):**
> Klicke hier, um dich anzumelden: [link]
> Der Link ist 15 Minuten gültig und kann nur einmal verwendet werden.

**After draft (v0.2, Sie-Form):**
> Hallo,
>
> Sie haben sich gerade bei KultA angemeldet.
> Klicken Sie auf den Link, um den Vorgang abzuschließen:
>
> [link]
>
> Der Link gilt 15 Minuten und kann nur einmal verwendet werden.
>
> Wenn Sie das nicht waren, ignorieren Sie diese Mail.
>
> Glück auf.
> — KultA

Notes:
- Sie-Form per §3.4 default
- «Glück auf» as sign-off — second of the two allowed instances

### 5.8 Error states (404, 500)

**Draft 404:**
> Hier ist nichts.
> Vielleicht eine alte URL, vielleicht ein Tippfehler. [Zum Programm zurück →]

**Draft 500:**
> Das hat nicht geklappt.
> Wir schauen es uns an. Versuchen Sie es in einer Minute noch einmal. — [Zum Programm zurück]

Notes:
- Direct, calm. No «Oops!», no «Hoppla!», no humor at the user's expense
- Both lead the user back to a known place

---

## 6. Open questions (to settle in iteration)

Resolved in v0.2:
- ~~Sie/Du~~ → Sie everywhere (§3.4 locked)
- ~~Geo-handle~~ → «im Ruhrgebiet» (locked)
- ~~Brand name~~ → `KultA` (locked)

Still open:

1. **«Ausgabe» / fanzine-edition framing** vs plain «Programm Monat XYZ». Stronger if real editions ship monthly; weaker if they don't.
2. **«Glück auf» frequency** — currently 2 instances product-wide (welcome email + RSVP confirmation footer). Comfortable, or too much / too little?
3. **«Künstler:in»** with Doppelpunkt vs **«Künstler\*in»** with Asterisk vs **«Künstlerinnen und Künstler»** unfolded. Currently Doppelpunkt. Audience-acceptable?
4. **Long form name in copy** — when an h1 says «KultA» alone, is that enough, or do we want a tagline-line beneath it (e.g. «KultA — Programm aus dem Ruhrgebiet»)? Affects landing hero, email signatures, footer.
5. **Anchor venues** (§4.2) — do you have specific Recklinghausen-area venues already in mind that should be listed there as plausible-archetypes? Particularly for cold-start seeding.

---

## 7. Reference comparators (study, don't copy)

**To study for tone:**
- **revierMagazin** (revier-magazin.de) — Ruhr regional culture mag, the closest existing voice
- **WAZ Recklinghausen** local section — formal-direct, no fluff
- **Ruhrbarone** blog — opinionated Ruhr commentary, sometimes too punchy for our use

**To NOT sound like:**
- **Berliner Zeitung Kultur** — too cool, too Berlin-centric
- **Monopol** — too gallery-curator pretentious
- **Nido / Brand Eins** — too national-cosmopolitan

---

## 8. Iteration protocol

This is a draft. Mark it up. Specifically:

1. Strike through anything that misses. Add what's missing.
2. Answer §6 open questions inline.
3. Add anchor venues to §4 if you have specific ones in mind.
4. Replace any draft text in §5 with your version — even rough notes work.

After your pass, I rewrite as v0.2 and we settle. Then `information-architecture.md` follows the same draft → iterate cycle.

---

*Draft v0.2 — Claude, 2026-05-04. v0.1 → v0.2: locked KultA + im Ruhrgebiet + Sie-Form. Replaces Berlin-Salon tone of KultA v0.4 prototype per DEC-001.*
