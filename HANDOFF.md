# Session Handoff — 2026-04-28

> **Для новой сессии:** прочти этот файл целиком, затем выполни «next action» внизу. Memory загружается автоматически из `~/.claude/projects/-home-jakob-projects-saas/memory/MEMORY.md` — там более детальный контекст.

---

## Где мы сейчас

Brainstorming-фаза (`superpowers:brainstorming`) **завершена**. Сейчас в `superpowers:writing-plans`, на терминальном шаге выбора пути дальше. Пользователь выбрал **GSD-pipeline**.

**Следующее физическое действие:** вызвать `/gsd-ingest-docs` чтобы он распознал готовый spec в `docs/superpowers/specs/...` и поднял `.planning/` структуру с ROADMAP.md.

## Что зафиксировано

### Проект
- **Cultural Layer Recklinghausen v1** — bilateral event marketplace для Kreis Recklinghausen / Ruhrgebiet.
- Греенфилд в `/home/jakob/projects/saas/`. Git initialized, 1 коммит: `9d4ca93`.
- Berlin Cultural Layer v3.0 PRD импортирован как **референс**, не как spec. Лежит в `.planning/imports/2026-04-28-cultural-layer-prd-v3.0-berlin.md`.

### Spec
- Путь: `docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md` (435 строк, утверждён пользователем).
- Содержит: 4 роли, bilateral state machine, data model на 10 таблиц, stack-lock, 25 routes, cold-start strategy, quality bar, edges/risks, decisions log на 12 пунктов.
- Variant **B — Marketplace + Check-in** (~150–200h v1).
- Tech stack locked: Next.js 16 + Drizzle + Neon + Better Auth + Resend + Vercel Blob. **Без** Firebase/Cloudinary/Stripe-в-v1.

### Фазовая декомпозиция (для `/gsd-ingest-docs` или manual ROADMAP.md)
| # | Phase | ~h |
|---|---|---|
| 0 | Skeleton & Infra | 20–25 |
| 1 | Auth + Profiles | 30–35 |
| 2 | Marketplace State Machine | 30–40 |
| 3 | Role Dashboards (Artist + Venue) | 30–40 |
| 4 | Public Feed + RSVP + QR | 20–25 |
| 5 | Venue Scan + Check-in | 15–20 |
| 6 | Email + Notifications | 10–15 |
| 7 | Admin + Cold-start Bootstrap | 15–20 |

### Установленные инструменты в этой сессии
- `pro-cli v2.2.0` (npm i -g) — для UI/UX Pro Max при необходимости (не использовали ещё).
- Graphify через `uv tool install` — **не нашёлся на PyPI**, видео врёт про точное имя пакета. Можно искать на GitHub отдельно либо отложить.

### NotebookLM
- Notebook: `f035edb9-ff0a-4879-b1b4-305621047cef` («SaaS Project: Workflow + Skills Audit (2026-04-28)»).
- Источник: видео «Top 5 Claude Code Skills…» (`fbf0e44f`).
- Note: «SaaS Workflow Recommendations» (`1ba8ec0a`).

### Ключевые решения (из brainstorming Q&A)
| # | Решение |
|---|---|
| Target | Recklinghausen v1, Berlin потом |
| Codebase | Greenfield |
| Wedge | Variant B (Marketplace + Check-in) |
| Geo | Kreis-wide единый фид (нет фильтра по городу) |
| Artist gate | Post-hoc admin модерация |
| Lang | Только DE |
| Capacity | Hard cap (нет waitlist) |
| Auth | Email + magic link |
| DB/ORM | Postgres / Drizzle |
| Files | Vercel Blob |
| Real-time | Polling + SWR |

## Что ещё **не** сделано

1. `/gsd-ingest-docs` не запущен. Это первое действие новой сессии.
2. Phase 0 (Skeleton) ещё не существует — пустой репо.
3. Vercel CLI **устарел** (50.44 → 52.0). Рекомендация при init: `pnpm add -g vercel@latest`.
4. `vercel link` ещё не сделан — будет в Phase 0.
5. Vercel Marketplace integration для Neon не подключена — будет в Phase 0 через `vercel:marketplace` skill.

## Открытые вопросы из spec (для решения позже)

1. Notification preferences UX (по умолчанию: только глобальный opt-out)
2. Event poster aspect ratio (рекомендовано 4:5)
3. Address geocoding (вручную v1)
4. GDPR cookie banner (yes, с дня 1)
5. Sitemap.xml (basic, авто из PUBLISHED events)

---

## Resume команда для новой сессии

Открой новую сессию в `/home/jakob/projects/saas/` и напиши:

```
Прочти HANDOFF.md и продолжи. Запусти /gsd-ingest-docs на наш spec, потом готовь Phase 0.
```

Memory подгрузится автоматически (есть `MEMORY.md` index). Spec лежит в `docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md`.

## Полезные пути

- Spec: `docs/superpowers/specs/2026-04-28-recklinghausen-event-platform-design.md`
- Berlin PRD reference: `.planning/imports/2026-04-28-cultural-layer-prd-v3.0-berlin.md`
- Memory index: `~/.claude/projects/-home-jakob-projects-saas/memory/MEMORY.md`
- Workflow для SaaS-проектов в общем: `~/.claude/projects/-home-jakob-projects-saas/memory/workflow_saas.md`
- Audit инструментов из видео: `~/.claude/projects/-home-jakob-projects-saas/memory/video_skills_audit_2026-04-28.md`

## Git state

```
Branch: master (default)
Last commit: 9d4ca93 — docs: brainstorming spec for Cultural Layer Recklinghausen v1
Untracked: HANDOFF.md (этот файл) — нужно закоммитить
```
