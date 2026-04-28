# Cultural Layer Recklinghausen — v1 Design Spec

**Date:** 2026-04-28
**Status:** APPROVED — ready for implementation plan
**Author:** Jakob + Claude (brainstorming session, 935f8c9b)
**Methodology:** superpowers:brainstorming protocol
**Reference:** Berlin PRD v3.0 (`.planning/imports/2026-04-28-cultural-layer-prd-v3.0-berlin.md`) — context only, NOT scope source.

---

## 1. Problem & target market

**Category:** event/culture marketplace для камерных нишевых мероприятий.

**Target:** Kreis Recklinghausen / Ruhrgebiet (5–7 городов в одном Kreis: Recklinghausen, Marl, Herten, Datteln, Castrop-Rauxel и соседние).

**Strategic context:** Berlin-style de-aggregation (как в исходном PRD) **не работает** в Recklinghausen. Регион не страдает от переизбытка событий — у него **дефицит**. Артисты не могут собрать аудиторию даже бесплатно, площадки не знают, что нужны. Главный риск — cold-start, не комиссии посредников.

**v1 — supply-creation marketplace**: симметричный bilateral matchmaking (любая сторона инициирует, обе должны подтвердить). Curator-функцию (бутстрап первых событий) выполняет владелец платформы вне продукта. Berlin придёт после product-market fit в Ruhr.

---

## 2. Personas (4 роли)

### Public / Visitor
- Городской житель Ruhr 25–40, культурно «голодный».
- Видит ТОЛЬКО уже согласованные (PUBLISHED) events.
- RSVP бесплатный → получает QR-билет.
- В Ruhr-режиме это часто Lokalpatriot, поддерживающий локальную сцену, не Берлин-style hipster.

### Artist (semi-pro 22–45)
- Музыкант, чтец, перформер, художник; semi-pro уровень.
- Может **(а)** опубликовать `event_proposal` («у меня вышла книга, ищу площадку 17 мая, capacity 50»), либо **(б)** откликнуться на `venue_listing`.
- Не платит за публикацию, не платит комиссию (v1 free).

### Venue Owner (30–55)
- Лофт, студия, Zeche, галерея, мастерская — небольшое нетрадиционное пространство.
- Может **(а)** опубликовать `venue_listing` (capacity, доступные даты), либо **(б)** пригласить artist на их `event_proposal` на конкретную дату в свой пространство.
- В Ruhr — часто куратор бывшего индустриального объекта.

### Admin
- Владелец платформы (single account v1, account создаётся через ENV-переменные).
- Backoffice-инструмент: модерация артистов и площадок, отмена событий, audit log, bootstrap-flow для seed events.
- Не отдельная пользовательская роль с marketing-страницами.

---

## 3. Bilateral lifecycle (state machine)

```
                    ┌─ PUBLIC FEED ─┐
                    │ (Public sees) │
                    └───────▲───────┘
                            │
                       PUBLISHED ◄── auto, when (artistAck && venueAck)
                            ▲
                            │
                    ┌───────┴───────┐
                    │  event (DRAFT │
                    │  / PROPOSED)  │
                    └─▲─────────▲───┘
                      │         │
            invite from│         │request from
               venue   │         │   artist
                       │         │
              ┌────────┴───┐ ┌──┴────────────┐
              │event_proposal│ │venue_listing │
              │(by Artist)   │ │(by Venue)    │
              └──────────────┘ └──────────────┘

CANCELLED — любая сторона отменяет до или после PUBLISHED (с email-рассылкой RSVP-ed гостям)
COMPLETED — автоматически 24h после events.startAt (cron / Vercel scheduled function)
SUSPENDED — admin блокирует пользователя, его events с status='proposed' замораживаются, 'published' — admin решает cancel или leave
```

### Ключевые потоки

**Поток A: Artist-initiated**
1. Artist подаёт `event_proposal` (title, description, preferredDates[], capacityWanted, posterBlob)
2. Venue Owner просматривает каталог proposals на `/venue/proposals`
3. Venue invitates artist на конкретную дату → создаётся `events` row с `venueAck=true, artistAck=false, status='proposed'` + `event_messages.create('venue invited')`
4. Artist получает email + видит invite на `/artist/proposals/[id]`
5. Artist подтверждает или контр-предлагает (через `event_messages`)
6. При accept: `artistAck=true` + check `venueAck=true` → status переходит в `published`, `publishedAt=now()`, public feed обновляется

**Поток B: Venue-initiated** (зеркальный)
1. Venue Owner подаёт `venue_listing` (availableDates[], capacity, photos)
2. Artist просматривает каталог на `/artist/venues`
3. Artist requests конкретную дату → создаётся `events` row с `artistAck=true, venueAck=false`
4. Venue Owner получает email, на `/venue/listings/[id]` видит request
5. Venue accepts → `venueAck=true` → published

**Поток C: Bootstrap (admin only, ENV-flag enabled)**
- Admin создаёт `events` напрямую с обоими ack'ами, минуя proposals/listings
- Используется в первые 4–8 недель для seed-контента
- Audit log помечает: `bootstrapped: true`

---

## 4. v1 IN scope

| Категория | Включено |
|---|---|
| Auth | Email + magic link (Resend), 15min TTL, single-use токен |
| Roles | public / artist / venue / admin (admin создаётся ENV) |
| Marketplace | bilateral proposal/listing, mutual ACK, state machine |
| Public feed | хронологический, без фильтров, magazine-стиль |
| RSVP | free, QR-билет (`tickets.qrHash` UNIQUE) |
| Check-in | `/venue/scan` камера + zxing, real-time guest list (polling 5s) |
| Dashboards | Artist + Venue + Admin со счётчиками, календарь у Venue |
| Email | invite/request received, counterparty confirmed, new RSVP, 24h reminder |
| Profile uploads | Vercel Blob (poster, portfolio, venue photos), public-read URLs |
| Audit log | каждое state-change |
| Quality | 80% test coverage critical paths, WCAG AA, Sentry, Lighthouse ≥90 |

## 5. v1 OUT scope (parking lot)

- Stripe / paid tickets / payouts / commission split
- Push-notifications (web-push API)
- Offline-PWA scenarios (только install-shell)
- Genre/жанры/search filters (5 событий — не нужно)
- Artist↔Venue chat (используем event_messages — minimal)
- Reviews / rating
- Recurring events (по серии)
- Multi-tenant city profiles (Berlin = после PMF в Ruhr)
- SSE/websockets — polling достаточно
- Phone-based auth
- OAuth (Google/Apple)
- Multiple admins
- Subdomain per город (recklinghausen.x.de) — Kreis-wide единый фид
- Артист pre-approval gate (post-hoc модерация admin'ом)
- Capacity overbook / waitlist (hard cap)
- DE+EN i18n (только DE v1)

---

## 6. Data model (Drizzle entities)

```ts
// Не финальный SQL, а эскиз schema. drizzle-kit migrations будут точные.

users {
  id: uuid PK
  email: text UNIQUE NOT NULL
  role: enum('public', 'artist', 'venue', 'admin') NOT NULL
  status: enum('active', 'suspended', 'email_invalid') NOT NULL DEFAULT 'active'
  createdAt: timestamptz NOT NULL DEFAULT now()
}

artist_profiles {
  userId: uuid PK FK→users.id ON DELETE CASCADE
  displayName: text NOT NULL
  bio: text
  instagramUrl: text
  websiteUrl: text
  portfolioBlobs: jsonb  // [{url, alt, order}]
}

venue_profiles {
  userId: uuid PK FK→users.id ON DELETE CASCADE
  name: text NOT NULL
  addressStreet: text
  addressCity: text          // Recklinghausen, Marl, ...
  addressPostal: text
  geoLat: numeric, geoLon: numeric
  capacity: int NOT NULL
  photoBlobs: jsonb          // [{url, alt}]
  description: text
}

event_proposals {
  id: uuid PK
  artistId: uuid FK→users.id NOT NULL
  title: text NOT NULL
  description: text
  preferredDates: date[]
  capacityWanted: int
  posterBlob: text          // single Blob URL
  status: enum('open','withdrawn','closed') NOT NULL DEFAULT 'open'
  createdAt: timestamptz, updatedAt: timestamptz
}

venue_listings {
  id: uuid PK
  venueId: uuid FK→users.id NOT NULL
  title: text NOT NULL
  description: text
  availableDates: date[]
  status: enum('open','withdrawn','closed') NOT NULL DEFAULT 'open'
  createdAt, updatedAt
}

events {
  id: uuid PK
  artistId: uuid FK→users.id NOT NULL
  venueId: uuid FK→users.id NOT NULL
  sourceProposalId: uuid? FK→event_proposals.id
  sourceListingId: uuid? FK→venue_listings.id
  title: text NOT NULL
  description: text
  startAt: timestamptz NOT NULL
  capacity: int NOT NULL CHECK (capacity > 0)
  posterBlob: text
  status: enum('proposed','published','cancelled','completed') NOT NULL DEFAULT 'proposed'
  artistAck: bool NOT NULL DEFAULT false
  venueAck: bool NOT NULL DEFAULT false
  publishedAt: timestamptz?
  cancelledAt: timestamptz?, cancelledReason: text?
  bootstrapped: bool NOT NULL DEFAULT false
  createdAt, updatedAt

  CHECK ((status='published') = (artistAck AND venueAck))
}

event_messages {
  id: uuid PK
  eventId: uuid FK→events.id ON DELETE CASCADE
  senderUserId: uuid FK→users.id
  body: text NOT NULL
  createdAt: timestamptz
}

tickets {
  id: uuid PK
  eventId: uuid FK→events.id ON DELETE RESTRICT
  userId: uuid FK→users.id ON DELETE RESTRICT
  qrHash: text UNIQUE NOT NULL  // crypto-random, ~22 chars base64url
  status: enum('active','used','cancelled') NOT NULL DEFAULT 'active'
  issuedAt: timestamptz NOT NULL DEFAULT now()
  usedAt: timestamptz?

  UNIQUE (eventId, userId)  // один RSVP на одного пользователя на event
}

audit_log {
  id: uuid PK
  actorUserId: uuid? FK→users.id  // null = system
  action: text NOT NULL  // 'event.publish', 'user.suspend', 'ticket.redeem', ...
  target: text NOT NULL  // 'event:42', 'user:7', ...
  meta: jsonb            // free-form context
  createdAt: timestamptz NOT NULL DEFAULT now()
}

magic_link_tokens {
  id: uuid PK
  email: text NOT NULL
  tokenHash: text UNIQUE NOT NULL  // HMAC, не plain
  expiresAt: timestamptz NOT NULL  // now() + 15min
  consumedAt: timestamptz?
}
```

### Индексы (день 1)
- `events`: `(status, startAt)` для public feed; `(artistId, status)`, `(venueId, status)` для дашбордов
- `event_proposals(status, createdAt DESC)` — каталог для venue
- `venue_listings(status, createdAt DESC)` — каталог для artist
- `tickets(eventId, status)`, `tickets(userId, status)`
- `audit_log(target, createdAt DESC)`

---

## 7. Tech stack (locked)

| Layer | Tool | Reason |
|---|---|---|
| Framework | Next.js 16 App Router + React 19 | Server Components, Cache Components, Vercel-native |
| DB | Postgres → Vercel Marketplace → **Neon** | Serverless, branchable preview deployments |
| ORM | **Drizzle** + drizzle-kit | Type-safe, миграции в git |
| Auth | **Better Auth** (email + magic link) | Lightweight, full control, no Firebase lock-in |
| Email | **Resend** | bulk-templates, отличный DX |
| Files | **Vercel Blob** (public read, signed upload URL) | Native, дешевле Cloudinary |
| Validation | **Zod** | shared frontend↔API |
| UI | **Tailwind 4 + shadcn/ui** база, magazine-CSS поверх | Быстрый старт + кастомизация |
| QR | `qrcode` (gen) + `@zxing/browser` (scan) | Чистые JS-библиотеки |
| Real-time | Polling + **SWR** 5–10s | SSE-overengineering для v1 |
| Tests | **Vitest** + **Playwright** + Postgres testcontainers | Pyramid с дня 1 |
| Errors | **Sentry** с дня 1 | alerts в Telegram/email |
| CI/CD | **GitHub Actions → Vercel** | preview per PR, manual gate в prod |
| Hosting | **Vercel Functions** (Fluid Compute, Node.js 24) | Default 300s timeout |

**Не используем:** Firebase, Cloudinary, Stripe (v1), web-push, microservices, Edge runtime, Turbo monorepo.

---

## 8. Screens (~25 routes)

### Public (anonymous + role=public)
| Route | Purpose |
|---|---|
| `/` | Landing — hero + ближайшие 4–6 events; если <2 events → waitlist-CTA |
| `/events` | Полный фид (chronological, без filters) |
| `/events/[slug]` | Детали + RSVP CTA |
| `/artists/[slug]` | Профиль артиста (bio, portfolio, прошедшие events) |
| `/venues/[slug]` | Профиль площадки (фото, прошедшие events) |
| `/login` | Email magic link request |
| `/auth/verify?token=...` | Magic link landing → session |
| `/me` | Свои RSVPs + QR-билеты |

### Artist (auth + role=artist)
| Route | Purpose |
|---|---|
| `/artist` | Dashboard: 4 счётчика (proposals/drafts/published/completed) + invitations |
| `/artist/proposals` | Список своих event_proposals |
| `/artist/proposals/new` | 2-step wizard: details → dates+capacity+poster |
| `/artist/proposals/[id]` | Детали + invitations |
| `/artist/venues` | Каталог venue_listings → request |
| `/artist/events` | Drafts/Published/Completed |
| `/artist/profile` | Edit bio + portfolio |

### Venue (auth + role=venue)
| Route | Purpose |
|---|---|
| `/venue` | Dashboard + сегодня |
| `/venue/listings` | Свои listings |
| `/venue/listings/new` | Create listing |
| `/venue/proposals` | Каталог event_proposals → invite |
| `/venue/events` | Drafts/Published/Completed |
| `/venue/calendar` | Месячный календарь |
| `/venue/scan` | **QR-сканер с камерой** |
| `/venue/events/[id]/manage` | Real-time guest list (polling 5s) |
| `/venue/profile` | Photos + capacity + amenities |

### Admin (role=admin)
| Route | Purpose |
|---|---|
| `/admin` | Сводка |
| `/admin/users` | Suspend/activate |
| `/admin/events` | Cancel published events |
| `/admin/events/new` | Bootstrap-create event (ENV-флаг enabled только в первые 8 недель) |
| `/admin/audit` | Audit log |

---

## 9. Cold-start strategy (Recklinghausen-specific, критично)

**Принцип:** Без go-to-market дисциплины платформа выглядит мёртвой. Это не функция, это операционка.

**Тактики:**
1. **Никакого public launch с 0 events.** Минимум 2 PUBLISHED events в любой момент, иначе вместо feed показываем waitlist + "Ihr werdet benachrichtigt, wenn das nächste Event live geht".
2. **Curator руками (Jakob)** офлайн онбордит первые 2–3 venues + 5 artists через звонок/визит, затем загружает их через `/admin/users` admin-create flow. Платформа после этого автоматически шлёт reminders, дата, QR'ы.
3. **Якорная партнёрка**: 1 Zeche или культурный центр в Kreis даёт площадку «бесплатно» в обмен на «мы привезём артиста и аудиторию». Якорь = первый PUBLISHED event.
4. **Seed posts** в Instagram «ruhr_art» / WhatsApp-группах локальных, флаеры с QR-кодом → `/events`.
5. **Метрика alive**: ≥1 RSVP'ed event в неделю — иначе пауза, не дальнейший рост.

**В коде:** `/admin/events/new` (bootstrap-flow) создаёт event с обоими ack'ами и `bootstrapped=true`, минуя proposal/listing. Activated через `ENV.ENABLE_BOOTSTRAP=true`. Disabled после 8 недель или после 10 PUBLISHED events.

---

## 10. Quality bar (с дня 1, не «потом»)

- **Тесты:** 80% coverage на critical paths — auth, ticket gen/redeem, QR validate, state transitions, RSVP flow.
- **Lighthouse Mobile ≥ 90** на `/`, `/events`, `/events/[slug]`, `/venue/scan`.
- **WCAG 2.1 AA с дня 1**: contrast ≥4.5:1, focus indicators 2px, ARIA labels, keyboard nav. Magazine-эстетика накатывается поверх a11y-первичного слоя.
- **Sentry с первого деплоя** — alerts по P1 в Telegram/email.
- **p95 page load <2s** через Cache Components + edge caching.
- **Rate limiting**: `/api/auth/magic-link` 10/min/IP, `/api/tickets/redeem` 50/min/venue.
- **Audit log** на каждое state-change и admin-действие.
- **CI gate**: typecheck + lint + Vitest unit + Playwright e2e — все зелёные до merge в `main`.
- **Secrets**: только в Vercel ENV, никогда в git, separate dev/preview/prod.

---

## 11. Edge cases & error handling

| Сценарий | Решение |
|---|---|
| Двойной ACK race | `SELECT FOR UPDATE` на events row, last-write-wins, оба audit_log entries |
| Capacity overflow | INSERT INTO tickets через transaction с COUNT, отказ если >capacity |
| QR replay attack | `tickets.qrHash UNIQUE` + `status='used'` check, попытка повтора → жёлтый «Bereits eingecheckt um HH:MM» |
| Event cancelled с RSVPs | Bulk email + `tickets.status='cancelled'` |
| Magic link replay | Single-use token, 15min TTL, post-use инвалидация (consumedAt) |
| Email bounce | Resend webhook → user.status='email_invalid' → блок отправок |
| iOS Safari camera quirks | Fallback: manual ticket-code typing на `/venue/scan` |
| User удалил artist account | events с этим artistId не удаляются, `artist_profiles` каскадно, в UI показываем «Artist removed» |
| Spam через email signup | rate limit + email confirmation required для proposal creation |

---

## 12. Risks (документированы)

| # | Риск | Mitigation |
|---|---|---|
| 1 | Cold-start fail — пустая платформа | Section 9 — не запускать без 2 PUBLISHED events |
| 2 | Артисты/venues уйдут в WhatsApp | event_messages должно быть быстрее переключения в WA |
| 3 | iOS Safari + camera в PWA капризно | Раннее тестирование на iPhone, fallback typing |
| 4 | Magic link в spam → user думает «не работает» | Pre-warm Resend domain, instructions, resend через 30s |
| 5 | Single admin = SPOF | Post-v1: multi-admin с promotion из ENV |
| 6 | WCAG ↔ magazine-эстетика конфликт | a11y-первичная вёрстка, magazine как layer |
| 7 | Vercel Blob лимит на bulk uploads артиста | Per-user file count limit, signed URL TTL |
| 8 | Bootstrap-flag забыли отключить | Cron-task проверяет `ENABLE_BOOTSTRAP` через 8 недель и алертит |

---

## 13. Decisions log (зафиксировано в brainstorming)

| Вопрос | Решение | Рассуждение |
|---|---|---|
| Target market v1 | Recklinghausen, Berlin потом | Cold-start = главное препятствие, продукт другой |
| Codebase strategy | Greenfield в /projects/saas/ | PRD = referenc, не legacy. Чистый стек |
| Wedge | Marketplace + Check-in (Variant B) | Полный lifecycle, но без Stripe/push |
| Geo filter | Kreis-wide единый фид | 5 events/мес — фильтр избыточен |
| Artist verification | Post-hoc admin модерация | Низкий барьер входа |
| UI language | Только DE | Локальные Lokalpatrioten Ruhr |
| Capacity policy | Hard cap | Нет waitlist v1 |
| Auth | Email + magic link | Без phone, без OAuth |
| DB | Postgres → Neon | Не Firestore |
| ORM | Drizzle | Не Prisma |
| Files | Vercel Blob | Не Cloudinary |
| Real-time | Polling | Не SSE |

---

## 14. Open questions / out of v1 scope

Не блокеры spec, но всплывут при implementation:

1. **Notification preferences UX** — может пользователь отключить отдельные типы email? (v1 — нет, только глобальный opt-out через footer link)
2. **Event poster image proportions** — фиксированный aspect ratio (4:5)? (recommended: yes, magazine-look требует)
3. **Venue address validation** — geocoding через Google Maps API или вручную? (v1 — вручную, пользователь сам вводит lat/lon если хочет)
4. **GDPR cookie banner** — нужен с дня 1? (yes, NFR из Berlin PRD пере- носится)
5. **Sitemap / SEO** — генерим автоматически из PUBLISHED events? (yes, базовый sitemap.xml)

---

## 15. Next step

После одобрения этого spec — invoke `superpowers:writing-plans` skill для создания implementation plan. **НЕ** invoke frontend-design / mcp-builder / другие.

Implementation plan будет:
- Декомпозиция в фазы для GSD-workflow (`/gsd-new-project` ↔ this spec, потом `/gsd-spec-phase` → `/gsd-discuss-phase` → `/gsd-plan-phase` → `/gsd-execute-phase` per фаза)
- Атомарные таски для каждой фазы (auth, marketplace state machine, dashboards, scan, admin, и т.д.)
- Goal-backward verification per фаза
- Quality gates после каждой фазы (test/security/UI/eval review)

**Estimated total v1 effort:** 150–200 hours.
