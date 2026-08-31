# LAURA — Handover State

**Last updated:** 2026-08-31 · **Branch:** `publish/official-main-2026-08-31`
**Audience:** Shashank (incoming), Sahar (outgoing owner)

This is the day-one map. Every row is reconciled against the code, not against a
meeting note. If a row says DONE it has a `file:line`. If it says BLOCKED it names
the decision and who owns it.

---

## Labels

| Label | Meaning |
|---|---|
| ✅ DONE | Implemented and verifiable in code |
| 🟡 PARTIAL | Started, incomplete — the row says what's missing |
| ⬜ TODO | No code exists |
| ⛔ BLOCKED | Needs a decision or external dependency (named in the row) |
| 👤 OWNER-ACTION | Not a coding task |
| ❓ DECISION-NEEDED | Question is open; see § Open decisions |

Commit messages start with the work-item ID(s) they touch, e.g. `[H2][B7] …`.

---

## Read this first — three things that will bite you

**1. Git history is not the record.** The commit history ended 2026-06-05 while the
code kept going. On 2026-08-31 the entire working tree — 302 files — was committed in
nine `[H1]` snapshot commits. `git blame` before that date is meaningless for dating
work. To date a migration, read its `Create Date:` docstring header, not git.

**2. `scripts/ingest_session_excels.py` — ⛔ DO NOT RUN.** It is non-functional and
will corrupt data if pointed at the live DB. Two defects verified in code:

- It never sets `source`, which is `nullable=False` (`backend/models/loa.py:377`). It
  only sets `source_file` (`scripts/ingest_session_excels.py:391`). Inserts fail the
  NOT-NULL constraint.
- `to_float()` (`scripts/ingest_session_excels.py:190`) strips commas
  unconditionally: `s.replace(",", "")`. That is a US-format parser applied to EMEA
  data. European `"1.234,56"` (€1 234,56) becomes `1.23456` — off by a factor of a
  thousand — and `"1,5"` becomes `15`. Silent, not an error.

Sahar also reports it writes a date into a VARCHAR column; I did not verify that one,
so treat it as reported-not-confirmed. **The working ETL is `etl_load_loas.py`** (repo
root). Which one survives is ❓ **C3**, below.

**3. `WORKFLOW_ORDER` is mirrored by hand, with no test.** The backend list
(`backend/api/loa.py:359-362`) and the frontend list
(`frontend/src/lib/workflow.ts:15-25`) must stay identical — every stage renderer in
the UI derives from the frontend copy. Nothing enforces it. Adding that test is **H7**.

---

## Live data snapshot (2026-08-31)

| Metric | Value |
|---|---|
| Total LOAs | **2,757** |
| — `historical_import` | 2,657 |
| — `demo_seed` | 75 |
| — `laura_created` | 25 |
| With embeddings | **2,712** (45 missing → invisible to Laura's `deep_search`) |
| Alembic head | `merge_activity_synonyms` (single head; DB `current` == head) |

`loas.cycle_id` is NULL on the large majority of rows **by design** — a CHECK
constraint (`ck_loa_live_has_cycle`) forbids demo/historical rows from carrying a
cycle. That is not a backlog item.

---

## Group A — Aug-26 final checkin

| ID | Item | Label | Evidence | Owner |
|---|---|---|---|---|
| A1 | Remove 'Test' checkbox from cycle creation | ✅ DONE | Removed at `frontend/src/app/admin/page.tsx:1087`; `is_test` column, banner, delete guard and pytest fixtures all still read it. See ❓ side-effect below | — |
| A2 | Cluster/area filter for emergency-cycle submitters | ✅ DONE | Area dropdown in `PeoplePicker` (`admin/page.tsx:699-745`), options derived from `role_scope_value` on cluster-scoped roles. `all`-scope admins stay visible under any area — `peopleShortfall` refuses a cycle without one | — |
| A3 | Reorder LOA form: per-brand/activity before PPT info | ⬜ TODO · ❓ | Sections 1-8 at `app/loa/new/page.tsx:801-1062`; PPT info is §7 (line 1002); `LoaLineRows` renders *after* §8 (line 1070-1079). **Conflicts with D3** — see § Open decisions | Blocked on D3 |
| A4 | Per-field validation errors on submission | ✅ DONE | `validate()` `app/loa/new/page.tsx:582-622` + `scrollToFirstError`; server errors mapped per-field at 694-698; summary banner 745-747; ~20 fields carry `error=`/`fieldKey=` | — |
| A5 | Tooltips on workflow stage numbers | ✅ DONE | `StageStepper.tsx:122-133` — builds `tip`, sets `title`, `aria-label`, `aria-current="step"` | — |
| A6 | Fix budget-sheet layout in split-screen | ⛔ BLOCKED | `ExcelRowPanel.tsx` renders ~25 fields as one horizontally-scrolling row of fixed-width cells; the five quarter cells sit last. Several valid fixes — needs Sahar to say what's wrong | Sahar |
| A7 | Hand over to Shashank, then integrate Laura Intelligence | 👤 OWNER-ACTION | The integration is **already built** — see Group A7 note below | Sahar |
| A8 | Send tracker screenshot to Harshita | 👤 OWNER-ACTION | — | Sahar |

**A7 — "Laura Intelligence" is the RAG subsystem, and it is already wired into the UI.**
`LauraProvider` + `LauraChat` mount globally (`app/layout.tsx:29-37`); `LauraPill` sits in
the AppShell topbar. Backend: `engines/rag.py`, routes at `api/chat.py:230` (alerts), `:284`
(LOA-scoped), `:401` (global). Embeddings are populated. The only unverified runtime
dependency is whether `ANTHROPIC_API_KEY` is set — reading `.env` is blocked, so confirm
manually. There is no integration left to build; A7 is the handover itself.

---

## Group B — Aug-21 items

| ID | Item | Label | Evidence |
|---|---|---|---|
| B1 | Shared slide-title helper `Activity: Brand` | ✅ DONE | `compute_display_title` `backend/engines/loa_display.py:47`, format at line 90. Call sites: `ppt.py:471,489`, `loa.py:597`, `templates.py:68`; frontend consumes `display_title` at 10 sites. ⚠️ Dead `_slide_title_LEGACY` at `ppt.py:491` — removed by H8 |
| B2 | Overview slide per activity type + Frames ordering | 🟡 PARTIAL | `generateDeck` `frontend/src/types/review.ts:423-598`. One overview per **category** (line 476-543), correctly pushed before the activity dividers. **No per-activity-type overview slide exists** — activities get only a `section_divider` (566-580), so the ordering half is vacuous. ❓ B2 below |
| B3 | Filters (quarter, brand, activity) on marketer LOA list | ⬜ TODO | Marketers get `RoleLOAList` (`app/loas/page.tsx:45`) which has **only free-text search** (`RoleLOAList.tsx:84-86`). Quarter filter exists only on the admin tracker (`TrackerPage.tsx:874`). Brand and activity-type filters exist **nowhere** |
| B4 | EMEA comment handling (accept → edit or send back) | ✅ DONE | `edit_myself` / `return_to_marketer` at `backend/api/loa.py:1254-1290`; UI `draft/ApprovalPanel.tsx:107,332,339`; marketer notified via `notify_n8n("loa_rejected", …)` at 1271 and 1300 |
| B5 | Reject requires a comment | ✅ DONE | 422 on empty reason `loa.py:1236-1237`; `reason_required_on_reject` `api/review.py:80-82` |
| B6 | Comments panel: full-height, scrollable, add-comment at top | ✅ DONE | Full-height + scroll `CommentsRail.tsx:135`; composer moved to the top by **H5** |
| B7 | Scroll indicator on scrollable areas | ✅ DONE | Overflow-aware indicator added by **H6**, replacing the always-on static string |
| B8 | Ask Laura UI on current design | ✅ DONE | `components/laura/LauraChat.tsx:1-20` — two modes, scope-split sidebar, champagne / DM Sans / Cormorant, light-dark aware |
| B9 | Overview photo upload + Lens-overview photo bug | ✅ DONE | Upload slots `overview_1..4` `CategoryOverviewSlide.tsx:187,238,246`, endpoint `api/review.py:775`. **Bug fixed and documented** at `LensOverviewSlide.tsx:22-33`: both lens templates seeded `default-1…`, so the overview slide's column 1 and the investment slide's column A were the same stored photo |
| B10 | Reviewer parity: 3 groups, comment-only, sub-gate advancement | ✅ DONE | `api/review_stage.py:44-87` — `STAGE_STATUS`, `STAGE_DONE_FLAGS`, `_stage_is_open` replaced a sequential prerequisite that made the Global Brand queue permanently empty. Advancement at `:317-319`. Marketer read-only per `SplitScreenReview.tsx:15-18` |

---

## Group C — Data foundation

| ID | Item | Label | Evidence |
|---|---|---|---|
| C1 | Read-only audit deliverable | ✅ DONE · ⚠️ | `docs/LAURA_database_audit_2026-08-25.xlsx` (84 KB). **Not in the repo** — the `*.xlsx` gitignore rule (which exists to keep EL client data out of git) excludes it. **Transfer it to Shashank out-of-band.** |
| C2 | Schema changes since the audit | 🟡 **NOT "none"** | Six migrations carry `Create Date: 2026-08-26`, one day after the audit. Four additive. **Two are irreversible data backfills** — see below |
| C3 | The re-ingest question | ⛔ BLOCKED | Untouched, as intended. Both ETL paths still present; no reload performed. ❓ C3 below |

### C2 — the two backfills already applied

Both have a deliberate no-op `downgrade()`. Neither can be rolled back.

| Migration | What it did |
|---|---|
| `alembic/versions/normalise_currency_eur.py` | `UPDATE loas SET currency='EUR'` across ~612 rows (EURO 274, Eur 168, € 139, Euro 30, eur 1). Deliberately left 19 genuinely non-euro rows alone (14 CHF, 4 GBP, 1 corrupt `19000`) and added no CHECK constraint, because one would fail against them |
| `alembic/versions/merge_activity_synonyms.py` | `UPDATE` on `loas` **and** `loa_line`, merging COOP_ADV→COOP_ADVERTISING, OTHER_ADV→OTHER_ADVERTISING, CATALOGUES→CATALOGUES_BROCHURES, MEDICAL→MEDICAL_AFFAIRS (~280 rows). Docstring cites *"Audit question 4, answered by Sahar on 2026-08-26"* — authorised, not rogue. 144 rows still on Title Case labels were left for a separate migration |

> ⚠️ **The audit spreadsheet is now stale in its `currency` and `activity_type` tabs.**
> It describes the pre-backfill distribution. Re-measure before quoting either figure.

The four additive ones — `cycle_emergency_reason`, `multi_loa_lines`,
`reference_data_tables`, `reject_flow_v2` — are `add_column` / `create_table` /
`create_index` only.

---

## Group D — Decisions

| ID | Item | Label | What the code does today |
|---|---|---|---|
| D1 | Which approval chain is canonical | ⛔ BLOCKED · ❓ | The code enforces a **9-status / 8-gate** chain. Authoritative: `backend/api/loa.py:359-362`. Mirrored in `frontend/src/lib/workflow.ts:15-25` and consumed by all four UI stage renderers. **Neither the Aug-21 4-stage nor the org-page "Corporate-final" definition is what runs** |
| D2 | "CMO deck shows only fully-approved LOAs" | ⛔ BLOCKED · ❓ | Not implemented as worded. `api/review.py:299-312` filters on *all three local-alignment stage rows approved* — **gate 1 of 8** — not `LOA.status == 'approved'` |
| D3 | Multi-brand / multi-row + multi-page PPT overflow | 🟡 **NOT "not started"** | Substantially built: `alembic/versions/multi_loa_lines.py`, `components/loa/LoaLineRows.tsx`, `isMulti`/`isMultiBrand`/`isMultiAct` through the form, `loa_type` branches in `loa_display.py:67-76` and `ppt.py:475-487`, multi-page PPT via `slidePageCount` + `_render_title(page_no=…)` (`ppt.py:518-522, 990, 1009`) |

---

## Group H — Handover prep (this pass)

| ID | Item | Label | Evidence |
|---|---|---|---|
| H1 | Secret-safe commit of the tree | ✅ DONE | 302 files in nine `[H1]` chunk commits; 2 build artifacts gitignored; working tree clean; nothing pushed |
| H2 | Correct `LAURA_AI_ARCHITECTURE.md` | ✅ DONE | Commit `274e90d` — hybrid RAG documented, three "missing" pieces marked shipped |
| H3 | This document | ✅ DONE | `HANDOVER_STATE.md` |
| H4 | A2 cluster filter | ✅ DONE | `app/admin/page.tsx` — see the A2 row |
| H5 | B6 composer to top of rail | ✅ DONE | `components/comments/CommentsRail.tsx` |
| H6 | B7 overflow-aware scroll indicator | ✅ DONE | `components/ui/ScrollHint.tsx` + `ExcelRowPanel.tsx` |
| H7 | `WORKFLOW_ORDER` parity test | ✅ DONE | `backend/tests/test_workflow_order_parity.py` |
| H8 | Delete dead `_slide_title_LEGACY` | ✅ DONE | `backend/engines/ppt.py` |

---

## Open decisions — nothing proceeds on these until answered

| ID | Question | Decider |
|---|---|---|
| **D1** | Which approval chain is canonical? The code runs 9-status / 8-gate; the Aug-21 note says 4-stage; the org page says Corporate-final. Blocks any stage-sequence work | Client / Sahar |
| **D2** | "Only fully-approved LOAs in the deck" — does that mean a **new final/export deck**? It cannot mean the *review* deck: CMO review is gate 5, a prerequisite of approval, so that deck would always be empty. There is no export deck today (only `cycles.py:428 /export/excel`) | Sahar |
| **C3** | Re-ingest from source Excel, or keep the in-place cleanup already applied (C2)? Note the two backfills are irreversible, so a re-ingest supersedes rather than reverts them. Harshita owns the data-foundation layer | Sahar + Harshita |
| **D3** | Multi-brand is largely built — what is actually considered missing? Scoping this unblocks A3 | Sahar |
| **B2** | Do you want a real per-activity-type overview slide, or was the category overview the ask? | Sahar |
| **A6** | What specifically is wrong with the split-screen budget layout? | Sahar |
| **A1** | With the Test checkbox gone, every new cycle is `is_test=false`, and `api/cycles.py:476` refuses to delete any non-test cycle holding LOAs. Admins lost the throwaway-cycle escape hatch. Restore it as an admin-only affordance? | Sahar |

---

## Known-but-accepted, so nobody re-reports them

- **Admin console has 15 latent defects** surfaced by `/code-review` on
  `app/admin/page.tsx` — none demo-blocking. Sharpest: unguarded `matrix.statuses.map`
  can white-screen the whole console (line 605); seven load requests fail silently
  (line 1320); overdue cycles render as `-3 days remaining` (line 151).
- **Local dev credentials are in git history** — `alembic.ini:63` carries a localhost
  Postgres password, and `laura2026` is the POC password *deliberately displayed* on the
  login screen (`app/login/page.tsx:213`). Rotate before any non-local deployment.
  👤 OWNER-ACTION.
- **`migration_state.txt` is stale** — it lists 17 migrations and an old head. There are
  36. Trust `alembic heads`, not that file.
