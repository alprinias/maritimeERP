# CONTEXT.md — Maritime ERP Mockup
**For AI model continuation. Updated after Client UI phase 9 (On Preparation).**

---

## Project overview

A **single-page web application** mockup for a maritime manning agency ERP system. Pure static files — no build step, no backend. Hosted on GitHub Pages.

**Tech stack:**
- Vue 3 via CDN (`vue.global.js`) — Options API throughout
- Vue Router 4 via CDN — hash-based routing (`#/path`)
- Tailwind CSS via CDN — internal ERP views
- Vuetify 3 + Material Design Icons + Inter via CDN — Client UI only (Atlantis look)
- jsPDF + jspdf-autotable + JSZip via cdnjs — Client UI PDF export / ZIP download
- No npm, no bundler, no compilation

**Atlantis:** the stakeholders' real ERP (Vue + Vuetify + Material). The Client UI copies its look; reference screenshots are in `atlantis-ref/` (not committed).

---

## File structure

```
maritimeERP/
├── index.html              ← App shell + ALL x-templates + router bootstrap
├── assets/
│   ├── erp-base.css        ← Shared: scrollbar, .active-tab
│   ├── gantt.css           ← Gantt bars, RFA colours, reference lines
│   └── client-portal.css   ← Client UI (Atlantis) styles, all under .atl-*
├── data/
│   ├── utils.js            ← Date helpers (var TODAY, d, addM, daysB, isoDate, fmtShort, shortName)
│   ├── vessels.js          ← var allVessels (6 vessels, 4 clients, full rank/RFA data)
│   ├── seafarers.js        ← var allSeafarers, var seedRfeRows
│   ├── store.js            ← var erpStore (Vue.reactive shared state)
│   ├── crew.js             ← crewSeafarers, crewPastAssignments, crew-list helpers
│   ├── documents.js        ← generated seafarer documents + status helpers
│   ├── preparation.js      ← preparation checklist (document requirements + manual tasks)
│   └── clients.js          ← var allClientsData (4 clients, salaryRanges, docTypes, vesselIds)
├── views/
│   ├── RotationAll.js      ← Fleet Rotation Gantt view
│   ├── ClientsSetup.js     ← Admin → Clients Setup view
│   ├── RFAs.js             ← Operations → RFAs view (+ RfaCardComponent)
│   ├── ClientCommon.js     ← Client UI: AtlTable, SeafarerProfileDialog, DocumentViewerDialog, atlDate, documentPdf
│   ├── ClientPortal.js     ← Client UI shell (ClientPortal)
│   ├── ClientDashboard.js  ← Client UI → Dashboard (landing page)
│   ├── ClientCrewLists.js  ← Client UI → Crew Lists view
│   ├── ClientRotation.js   ← Client UI → Rotation Plan (Atlantis Gantt; crew plan on phones)
│   ├── ClientPreparation.js← Client UI → On Preparation + <preparation-dialog>, contractPdf()
│   └── ClientApprovals.js  ← Client UI → Pending Approvals + <approval-dialog>, cvPdf()
└── CONTEXT.md
```

**Line counts:** index.html 2868 · RFAs.js 485 · RotationAll.js 310 · ClientsSetup.js 273 · vessels.js 307 · clients.js 140 · seafarers.js 66 · utils.js 18

---

## Critical architecture rules

### Template pattern
All Vue component templates are `<script type="text/x-template" id="tpl-NAME">` tags embedded in `index.html`. View `.js` files are **pure JavaScript only** — no HTML tags. Each component references its template by id:
```js
const MyView = { template: '#tpl-my-view', data() {...}, ... }
```

### x-template ids in index.html (in order)
| id | Used by |
|---|---|
| `tpl-clients-setup` | `ClientsSetupView` |
| `tpl-rfa-card` | `RfaCardComponent` (local to RFAsView) |
| `tpl-rfas` | `RFAsView` |
| `tpl-client-portal` | `ClientPortal` (global component) |
| `tpl-client-dashboard` | `ClientDashboardView` |
| `tpl-atl-table` | `AtlTable` (global `atl-table`) |
| `tpl-seafarer-profile` | `SeafarerProfileDialog` (global) |
| `tpl-document-viewer` | `DocumentViewerDialog` (global `document-viewer`) |
| `tpl-client-crew-lists` | `ClientCrewListsView` |
| `tpl-client-approvals` | `ClientApprovalsView` |
| `tpl-approval-dialog` | `ApprovalDialog` (global `approval-dialog`) |
| `tpl-client-preparation` | `ClientPreparationView` |
| `tpl-preparation-dialog` | `PreparationDialog` (global `preparation-dialog`) |
| `tpl-client-rotation` | `ClientRotationView` |
| `tpl-rotation-all` | `RotationAllView` |

### Global variable scoping — CRITICAL
Data files use `var` (not `const`/`let`) at top level. An explicit bridge block in `index.html` pins them onto `window` after the data scripts load but before the view scripts:
```js
window.allVessels     = allVessels;
window.allClientsData = allClientsData;
window.allSeafarers   = allSeafarers;
window.seedRfeRows    = seedRfeRows;
window.TODAY          = TODAY;
```
**Never use `const` or `let` at the top level of a data `.js` file.** Never use Python to edit these files — all edits are done with str_replace tool directly.

### Script load order in index.html
```
CDN: Vue → VueRouter → Vuetify (css #vuetify-css, mdi, Inter, js) → jsPDF/autotable/JSZip → Tailwind
assets/erp-base.css + gantt.css + client-portal.css
x-template blocks (see table above)
data/utils.js → data/vessels.js → data/seafarers.js → data/store.js → data/crew.js → data/documents.js → data/preparation.js
[inline: window.* bridge + data/clients.js]
views/ClientsSetup.js → views/RFAs.js → views/RotationAll.js → views/ClientCommon.js → views/ClientPortal.js → views/ClientCrewLists.js → views/ClientRotation.js → views/ClientApprovals.js → views/ClientDashboard.js → views/ClientPreparation.js
[inline: makeStub() + router + createVuetify() + createApp() + app.component(client-portal, atl-table, …) + mount]
[inline: makeStub() + stub views + router + createApp().mount()]
```

### str_replace safety rule
When inserting a new method before an existing one using str_replace, the `old_str` must include the **full function signature line** of the existing method (e.g. `buildSignoffRows() {`), not just a comment or closing brace. Otherwise the function header gets swallowed and causes `rows is not defined` runtime errors. Always verify with `node -e "new Function(src)()"` after every edit.

### Vue template constraints (runtime compiler)
- No inner `v-if` inside a `v-if/v-else-if` chain — use `v-show` for sub-conditions
- `v-for` + `v-if` on same element: wrap with `<template v-for>`
- String apostrophes in JS data files: use double quotes for strings containing apostrophes (e.g. `"Lloyd's Register"`)

---

## App shell (index.html)

### Layout
```
Top bar (48px): hamburger | MARITIMEERP | user info
├── Sidebar (w-52 collapsible) | Content area (flex-1)
```

### Sidebar sections (openSections reactive: admin=true, recruitment=false, operations=true)
```
⚙ Admin
    Users              → /admin/users        (stub)
    Clients Setup      → /admin/clients      (BUILT)
    Settings           → /admin/settings     (stub)
👥 Recruitment
    Candidates         → /recruitment/candidates  (stub)
    Pipeline           → /recruitment/pipeline    (stub)
🚢 Operations
    Rotation Plan      → /operations/rotation     (BUILT)
    RFAs               → /operations/rfas         (BUILT)
```

### Routes
```js
{ path: '/',                       component: HomeView },                    // stub
{ path: '/admin/users',            component: AdminUsersView },              // stub
{ path: '/admin/settings',         component: AdminSettingsView },           // stub
{ path: '/admin/clients',          component: ClientsSetupView },            // BUILT
{ path: '/recruitment/candidates', component: RecruitmentCandidatesView },   // stub
{ path: '/recruitment/pipeline',   component: RecruitmentPipelineView },     // stub
{ path: '/operations/rotation',    component: RotationAllView },             // BUILT
{ path: '/operations/rfas',        component: RFAsView },                    // BUILT
```

### Root Vue app (setup())
```js
const sidebarOpen  = ref(true);
const openSections = reactive({ admin: true, recruitment: false, operations: true });
function toggleSection(key) { openSections[key] = !openSections[key]; }
```

---

## Data layer

### utils.js globals
```js
var TODAY = new Date();
d(s), addM(dt,n), daysB(a,b), isoDate(dt), fmtShort(s), shortName(full)
```

### vessels.js — `var allVessels` (6 vessels)
| id | Name | Type | Client |
|---|---|---|---|
| v1 | MV Sea Star | Oil Tanker | Global Shipping Ltd |
| v2 | MV Atlantic Pride | Bulk Carrier | Global Shipping Ltd |
| v3 | Oceanic Express | Container | Blue Water Corp |
| v4 | Alpha Prime | Chemical Tanker | Alpha Tankers |
| v5 | Alpha Horizon | Oil Tanker | Alpha Tankers |
| v6 | Pacific Trader | RoRo | Pacific Logistics |

**Full vessel object shape:**
```js
{
    id, client, name, type, flag,
    imo, built, gt, engineType, enginePower,
    classificationSociety, piClub, hullInsurer, hullValue,
    vesselRanks: null | [...],      // user-saved manning/salary overrides
    vesselContract: null | [...],   // user-saved contract definition rows
    ranks: [                        // array of rank row objects
        {
            rank, isRating?,
            onboard: { name, shortName, embark, signoff, contract },
            rfa: null | { rfaNo, type('Extend'|'Replace'|'Promote'), status,
                          rfaStart, rfaEnd, newRank?, proposed:[], confirmedSeafarer },
            rfs:     null | { rfaNo, dateCreated, signoffDate, port, status },
            rfr_rfe: null | { rfaNo, dateCreated, embarkDate,  port, status },
        }
    ]
}
```

**RFR pairs (rows with BOTH rfs AND rfr_rfe):**
- v1 Captain: RFS-4001 + RFE-4001 (status:'active' → OnSearch)
- v2 Chief Engineer: RFS-4002 + RFE-4002 (status:'preparation' → OnPreparation)

**Standalone RFS only (no rfr_rfe):**
- v2 Second Officer: RFS-3001
- v3 Ordinary Seaman: RFS-3002 (status:'preparation')
- v4 Second Officer: RFS-3003

**RFA types on `rfa` field:**
- v3 Captain: RFX-1074 type:'Extend' status:'active'
- v3 Bosun: RFP-1090 type:'Promote' status:'active'

**vesselRanks override shape** (stored only for ranks with ≥1 value):
```js
vesselRanks: [{ rank, manning, salaryMin, salaryMax, currency }]
```

**vesselContract shape** (MV Atlantic Pride v2 pre-filled from PNO IMEC IBF CBA 2026):
```js
vesselContract: [{ rank, cba, hoursOfWork, otRate, basicSalary, guaranteedOt,
                   fixedOt, leavePay, leaveSubsistence, allowance, suppWages }]
```
Contract Total = sum of: otRate + basicSalary + guaranteedOt + fixedOt + leavePay + leaveSubsistence + allowance + suppWages (all 2dp).

### seafarers.js
```js
var allSeafarers  // 13 seafarers: { id, name, rank, age, bmi, availDate, cesStcw,
                  //                 cesEnglish, nationality, category, services[] }
var seedRfeRows   // 3 RFEs: RFE-2011 (C/O, v1, active=OnSearch)
                  //         RFE-2019 (Captain, v2, active=OnSearch)
                  //         RFE-2024 (2nd Eng, v4, preparation=OnPreparation)
```

Seafarer categories → RFAs group mapping:
- `'Client Ex-Crew'` → **Dedicated** (green)
- `'Other Ex-Crew'`  → **Ex-Crew** (blue)
- `'New Candidates'` → **New** (amber)

Services array: `[{ count, months, label('At Rank'|'As Officer'|'Other'), rank }]`

### clients.js — `var allClientsData` (4 clients)
```js
{
    id, name, alias, address, contactEmail, contactPhone, isActive,
    vesselIds: ['v1','v2'],
    salaryRanges: [{ rank, min, max, currency }],   // 11 ranks
    docTypes: [{ id, name, required: { 'Captain': true, ... } }]  // 8 seed doc types
}
```
Clients: c1 Global Shipping Ltd, c2 Blue Water Corp, c3 Alpha Tankers, c4 Pacific Logistics (inactive).

---

## View: RotationAll (`/operations/rotation`)
**Template:** `tpl-rotation-all` · **Component:** `RotationAllView`

Gantt-style fleet rotation planner. The most complex view (~1000 lines of template).

### Gantt bar zones (62px rank row)
```
top:3%  h:22%  z:4  → RFS/RFR sign-off (TOP)
top:28% h:44%  z:2  → Onboard service bar (MIDDLE)
top:76% h:22%  z:3  → RFE/RFR embark/RFX/RFP (BOTTOM)
```

### RF type colours
RFS=rose, RFR=amber, RFE=sky, RFP=purple, RFX=teal.
Status textures: active=solid, approval=diagonal stripes, preparation=dot grid, completed=desaturated.

### Key state
`viewMonths, dayWidth:3.0, rankColWidth:240, ganttStartStr, includeRatings, filterClient/Vessel/Rank/RfType, ctxMenu, modal, rfaModal, rfeRows (reactive copy of seedRfeRows), allSeafarers`

### Modals
1. **Action modal** — Embark(RFE) / Extend(RFX) / Replace(RFR) / Sign Off(RFS) / Promote(RFP)
2. **RFA detail modal** — single-pane for RFX/RFP/RFS/RFR; two-pane (960px) for active RFE with candidate pool, Compare, Proposal email
3. **Context menu** — right-click on onboard bar

### Replace (RFR) creates 3 things simultaneously:
`row.rfs`, `row.rfr_rfe`, and a new entry pushed to `rfeRows`.

### Standalone RFE: `openRfaModal(rfe, 'rfe', null, vessel)` — row is null; always fall back to `rfaModal.data.rank`.

---

## View: ClientsSetup (`/admin/clients`)
**Template:** `tpl-clients-setup` · **Component:** `ClientsSetupView`

### Client-level tabs: Details | Vessels | Salary Ranges | Documents

**Details tab** — editable 2-col card (name, alias, address, email, phone, isActive). Edit/Save/Cancel inline.

**Vessels tab** — vessel dropdown (filtered to client's vesselIds). When selected, shows two sub-tabs:

- **Details sub-tab** — 11-field card: IMO, built, GT, flag, type, classification society, engine type/power, P&I club, hull insurer, hull value. All editable.

- **Ranks & Manning sub-tab** — table: rank × (Manning count, Min, Max, Currency). Vessel values override client defaults. Empty vessel cells show client rate greyed as placeholder. Saves to `vessel.vesselRanks` (only rows with ≥1 value stored).

- **Contract Definition sub-tab** — full-width table: rank × (CBA dropdown, Hours of Work integer, OT Rate>103h, Basic Salary, Guaranteed OT, Fixed OT, Leave Pay, Leave Subsistence, Allowance, Supplementary Wages, **Total** read-only). CBA options: PNO IBF / PNO ITF / Cyprus / Italy / ICMB. All monetary fields 2dp. Total = sum of all starred fields. Saves to `vessel.vesselContract`.

**Salary Ranges tab** — table: rank × (min, max, currency). Editable. 11 ranks.

**Documents tab** — rank-vs-document matrix. Document types as sticky-left rows, ranks as vertical-header columns. Custom blue checkbox at each intersection. Features: add new doc type (inline input), rename (pencil icon on hover), delete (× on hover). Data: `doc.required = { 'Captain': true, ... }`.

### Key state (ClientsSetupView.data())
```js
selectedClientId, activeTab('details'|'vessels'|'salary'|'documents'),
editing, editForm, editSalary,
selectedVesselId, vesselTab('vdetails'|'vranks'|'vcontract'),
vesselEditing, vesselEditForm,
vesselRanksEditing, editVesselRanks,
contractEditing, editContractRows,
addingDocType, newDocTypeName, editingDocName, editDocNameVal
```

### Key computed
`selectedClient, clientVessels, selectedVessel, rankOrder(11 ranks), vesselRankRows, contractRows, clientDocTypes, docRankOrder`

### Key methods
`startEdit/cancelEdit/saveEdit, startVesselEdit/saveVesselEdit, startVesselRanksEdit/saveVesselRanks, startContractEdit/saveContract, contractRowTotal(row), fmtDec(n), clientRateFor(rank,'min'|'max'), clientCurrencyFor(rank), addDocType, confirmAddDocType, removeDocType(id), toggleDocRequirement(doc,rank), isRequired(doc,rank), startEditDocName(doc), saveDocName(doc)`

---

## View: RFAs (`/operations/rfas`)
**Templates:** `tpl-rfa-card` (component) + `tpl-rfas` (view) · **Files:** `views/RFAs.js`

### Registered local component: `rfa-card` (`RfaCardComponent`)
Shared summary card used as list items in Sign-Off, Extension, Promotion left panes.
**Props:** `rfa` (object), `selected` (boolean). **Emits:** `select`.
**Always shows:** RFA number badge (colour by prefix), status badge, client·vessel, rank, deadline with overdue/soon flags.
**Conditionally shows:** `rfa.seafarer` when present (RFS/RFX/RFP only).
**Computed:** `typeBadgeClass, statusClass, isOverdue, isDueSoon, deadlineClass`

### Filter bar (top, all tabs)
Client dropdown → Vessel dropdown (filtered to client) → Rank dropdown → Deadline date (upper bound). Reset button clears all. All filters apply across tabs.

### Five tabs

#### Replacement tab (`replacement`) — BUILT
- **Left pane:** list of RFR cards. Each shows: RFR number badge (amber), OnSearch/OnPreparation status, client·vessel, rank, signing-off seafarer name (↑ rose), replacement status (↓ violet).
- **Right pane — top (RFS):** rose header (RFS number, seafarer name, sign-off date+port), RFS task list (independent checkboxes+costs), rose progress bar.
- **Right pane — bottom (RFE):**
  - OnSearch: violet header + candidate search UI (Dedicated/Ex-Crew/New groups, Ask for Acceptance, Compare ≥2, Send for Approval ≥1 accepted). Candidates from `allSeafarers` filtered by rank.
  - OnPreparation: amber header + RFE task list + amber progress bar.
- **Data source:** `allVessels` rows where both `row.rfs` AND `row.rfr_rfe` are set.
- **RFR row shape:** `{ rfaNo(display), rfsNo, rfeNo, client, vesselId, vesselName, vesselType, rank, seafarer(signing-off), signoffDate, signoffPort, deadline(embarkDate), embarkPort, status, rfeStatus('OnSearch'|'OnPreparation'), rfsTasks[], rfeTasks[], rfeCandidates[] }`

#### Embarkation tab (`embarkation`) — BUILT
- **Left pane:** segmented radio filter (All/On Search/On Preparation) + count. RFE cards with OnSearch(violet)/OnPreparation(amber) badge.
- **Right pane — OnSearch:** sky header (RFE number, rank, vessel, deadline, contract), Compare+Send for Approval buttons, three candidate groups (Dedicated/Ex-Crew/New). Each candidate card: name, nationality, age, availability, Total Services/On Rank/As Officer stat boxes, Ask for Acceptance → Accepted/Refused radio flow.
- **Right pane — OnPreparation:** amber header + RFE task list (8 deployment tasks) + progress bar.
- **Data source:** `seedRfeRows`. `rfeStatus` derived: `status==='active'` → OnSearch, else → OnPreparation.
- **Candidate state:** `candidateState[rfaNo]` — built lazily on first selection. Persists across list navigation.

#### Sign-Off tab (`signoff`) — BUILT
- Two-pane. Left: `rfa-card` list. Right: rose header + task list + progress bar.
- **Data source:** `allVessels` rows with `row.rfs` set (but no `row.rfr_rfe`).
- **Row shape:** `{ rfaNo, client, vesselId, vesselName, vesselType, rank, seafarer, deadline(signoffDate), port, status, tasks[] }`

#### Extension tab (`extension`) — BUILT
- Two-pane. Left: `rfa-card` list. Right: teal header + task list + progress bar.
- **Data source:** `allVessels` rows with `row.rfa.type === 'Extend'`.

#### Promotion tab (`promotion`) — BUILT
- Two-pane. Left: `rfa-card` list. Right: purple header + task list + progress bar.
- **Data source:** `allVessels` rows with `row.rfa.type === 'Promote'`.

### Default task lists (DEFAULT_TASKS in RFAs.js)
| Type | Count | Key tasks |
|---|---|---|
| `rfs` | 7 | notify, travel, port agent, docs, wages, medical, crew list |
| `rfx` | 6 | consent, cert validity, medical, amend contract, MLC, rotation |
| `rfp` | 6 | eligibility, CoC, contract, flag state, crew list, salary |
| `rfe` | 8 | confirm acceptance, certs, medical, travel, port agent, joining instructions, contract, crew list |

`makeTasks(type)` returns a fresh copy with `{ id, name, cost, done:false }`.

### Key state (RFAsView.data())
```js
activeTab('replacement'|'embarkation'|'signoff'|'extension'|'promotion'),
filterClient, filterVessel, filterRank, filterDeadline,
selectedRfa: null,
rfeStatusFilter: ''|'OnSearch'|'OnPreparation',
todayStr: isoDate(TODAY),
compareOpen: false,
candidateState: {},          // keyed by rfaNo, built lazily for OnSearch RFEs
allRows: { signoff, extension, promotion, embarkation, replacement }  // built in created()
```

### Key computed (RFAsView)
`tabs, allClientNames, filteredVesselOptions, rankOptions, filteredRfeRows(embarkation+rfeStatusFilter), activeCandidates, candidateGroups, totalCandidatesForRfe, checkedCandidates, acceptedCandidates, rfrCheckedCandidates, rfrAcceptedCandidates, rfrCandidateGroups, completedTaskCount, totalCost, progressPct, progressColor, progressBarClass`

### Key methods (RFAsView)
`filteredRows(tabId), selectRfa(rfa), buildCandidatesForRfe(rfe), totalTrips(c), totalMonths(c), serviceAt(c,label), rfrSectionCost(tasks), rfrSectionPct(tasks), resetFilters, buildReplacementRows, buildSignoffRows, buildExtensionRows, buildEmbarkationRows, buildPromotionRows`

---

## Shared state (`data/store.js`)
`erpStore = Vue.reactive({ clientUi:{clientId, profileId}, rfeRows, rfaRows })`
- `rfeRows` — Rotation Plan's RFE rows (was a per-visit copy of seedRfeRows).
- `rfaRows` — RFAs view rows per tab. Built on first visit; on later visits rows are rebuilt from allVessels and existing row objects are reused by `rfaNo`, so task / candidate / approval state survives navigation.
- `clientUi.clientId` — client the Client UI is "viewing as" (portal top-bar dropdown, active clients only).
- `clientUi.profileId` — seafarer whose profile modal is open in the portal (null = closed).

### Principal approvals (shared by RFAs view and Client UI) — `views/RFAs.js`
- `ensureRfaRows()` builds / merges `erpStore.rfaRows` (also called by the client portal on creation), so the portal and the RFAs view share the same row and candidate objects.
- Seed requests awaiting the principal: `rfr_rfe` / seedRfeRows entries with `status:'approval'` and `proposed:[seafarer ids]` → those candidates get `acceptance:'onApproval'` (RFE-4001 v1 Master ×3, RFE-2011 v1 C/O ×2, RFE-3051 v3 C/O ×2, RFE-3044 v5 C/E ×1). Status 'approval' maps to rfeStatus OnSearch.
- `pendingCandidates(row)`, `principalApprove(row, id)` (→ OnPreparation, confirmedSeafarer, RFE tasks), `principalRejectAll(row, reason)` (candidates `approvalChoice:'rejected'`, stays OnSearch). Each decision is appended to `row.approvalHistory` ({ date, action, reason?, candidates }).
- The internal RFAs view no longer approves: candidates On Approval show read-only "Awaiting / Approved by / Rejected by principal".

### Seed dates are re-anchored to today
Seed data in vessels.js / seafarers.js is authored as of `DATA_AUTHORED_ON = '2026-05-20'` (utils.js). store.js calls `shiftSeedDates([allVessels, allSeafarers, seedRfeRows], seedMonthShift())`, moving every YYYY-MM-DD string forward by whole months on load. Write new seed dates relative to 2026-05-20.

### Naming conventions (Atlantis)
- Ranks: `Master` (not Captain), `Able Seaman` (not AB Deck). Displayed UPPERCASE in the Client UI.
- Seafarer records carry `name` (FIRST LAST, used by internal views) plus `lastName` / `firstName`. Client UI shows `fullNameLF()` = "SURNAME, FIRST"; Gantt labels `barLabel()` = "SURNAME F.".

---

## Client UI (mockup of the separate client portal — Atlantis look)
`/client/*` routes render `<client-portal>` full screen instead of the ERP shell (`isClientUi` in the root app). The Vuetify stylesheet `<link id="vuetify-css">` is enabled only while the portal is shown — its reset and utility classes (`bg-white`, `rounded-xl`, …) clash with Tailwind. Internal sidebar section "Client UI" just links into the portal; the portal's logout icon returns to the ERP.

**Portal shell:** white app bar (hamburger, Atlantis page tab, "Viewing as (mockup)" client select, user block, exit), temporary navigation drawer (client name group, menu, crossworld wordmark). Read-only except RFE approval (Phase 6). Internal controls (+ EMBARK, RFC ISSUED…) are hidden from clients.

| Route | View | State |
|---|---|---|
| `/client` | → `/client/dashboard` (landing page) | |
| `/client/dashboard` | ClientDashboardView | BUILT |
| `/client/crew-lists` | ClientCrewListsView | BUILT |
| `/client/rotation` | ClientRotationView | BUILT |
| `/client/approvals` | ClientApprovalsView | BUILT |
| `/client/preparation` | ClientPreparationView | BUILT |

Deep links: Crew Lists reads `?list=onboard|ashore|approved|changes` and `?vessel=`; Rotation Plan reads `?vessel=`.

**Dashboard** (landing page) — greeting (client, date, vessel count); 6 KPI tiles, each linking to its detail: crew on board (/positions), ashore (dedicated pool, `ashoreDedicated()`), pending approvals (with next due), crew changes in the next 30 days, overdue sign-offs, expired / expiring (≤ 90 d) documents of the crew on board (scrolls to the list); Fleet table per vessel (crew on board / positions, next crew change, changes ≤ 30 d, pending approvals, document chips, crew-list and rotation shortcuts); "Awaiting your approval" list with Review (opens the approval dialog); "Crew changes · next 30 days"; "Documents needing attention" (first 8, Show all). Status always icon + label (dataviz rule: never colour alone); values in text colour.

**AtlTable (`atl-table`)** — Atlantis table: toolbar (refresh, `#toolbar-left` slot e.g. FILTERS, COLUMNS visibility menu with SHOW ALL / HIDE ALL and fixed columns, Export PDF, PRESETS look-only), sortable headers, optional checkbox selection (`v-model:selected`), section header rows (`sections` + row `_section`), `#row-actions` slot, footer "Rows · 1 to N of M · Page x - y". Columns: `{ key, title, fixed?, type?: 'link'|'chip', format?, cls?, chip? }`; rows need `_key`, may carry `<key>_sort` and `<key>_link === false`. Export PDF = all rows, visible columns, jsPDF + autotable.

**Crew Lists** — tabs + filter box, then atl-table. Fixed columns Full Name (opens profile modal), Rank, Age; optional columns per list in `CREW_LIST_COLUMNS` (`def: true` = visible by default).
1. *On Board* — vessel + date (≤ today) via `crewOnDate`.
2. *Ashore* — seafarers with `dedicatedClientOf(id) === client` whose last tour is completed; last vessel / sign-off / availability.
3. *Approved for Embarkation* — `crewEvents` embark events with stage `preparation` and a name, in period; est. date, port, relieving.
4. *Crew Changes* — period; section "Completed" (past tour sign-ons/offs ≤ today) and "Planned" (`crewEvents`).
FILTERS menu: Rank, Nationality.

**Rotation Plan** — Atlantis Gantt, read-only. Filters: Vessel, Rank, WINDOW 6/12/18 mo, From (default 1st of month 3 months back) + reset, RESET; RF TYPE toggle ALL / ANY RF / RFR / RFS / RFP / RFX / RFE: SEARCH · APPROVAL · PREPARATION · READY (filters rows); legend Today / +2mo horizon. Timeline positions are percentages of the window (`pct()`); full-height lines use `lineLeft()` = calc over `--atl-rank-col`. `clientGanttRows(vessel)` builds one row per position (rank order, counter "pos/total" when a rank has several positions, grey when `safeManning === false`) plus a "NEW" row per standalone RFE. Bar kinds / classes `.atl-bar--*`: past (grey hatched), running (blue; ends at the promotion date for a promoted seafarer), rfs (maroon, last ≤45 days before sign-off), rfx (gold, contract end → extended date), rfp (orange) + diamond and dashed arrow to the target rank's position, relief stages search / approval (hatched, approval with purple underline) / preparation (light green) / ready (dark green). Relief bars show the request number until approved, then the seafarer. Hover card (`atl-gantt-tip`) per bar in Atlantis style. Relief bars backed by an RFA row (`findApprovalItem(ref)`) are clickable and open the approval dialog; nothing opens for running / past services.

**Pending Approvals** — one list (atl-table; "Waiting for approval" by default, or "All requests" with a join-date period; vessel filter; columns Request (opens dialog) / Vessel / Rank fixed + join date, approval due (= join − 14 days), days left, candidates, relieving, status, approved seafarer, last decision). No Gantt tab — users open the Rotation Plan page for that. Drawer menu / bottom navigation show a purple badge with the pending count.

**Approval dialog (`approval-dialog`)** — opened by setting `erpStore.clientUi.approvalRef` (RFE number); hosted in the portal. Atlantis layout: header grid (RFE number + Pool Search / Principal Approval chips, rank, Due / Join Date with days left, client, vessel – type – port; CANCEL hidden), purple "Principal Approval (n)" section with REJECT ALL and decision-history menu, candidate cards (name → profile modal, "Dedicated to X" chip, age, available, Approve radio, CV icon → `cvPdf()` in the document viewer, services strip Total / At Rank / As Officer). Approve = radio + confirmation bar → `principalApprove`; Reject all = reason required → `principalRejectAll` (request returns to candidate search). Decided requests show the outcome and history; a snackbar (`erpStore.clientUi.toast`) confirms.

**Profile modal (`seafarer-profile-dialog`)** — opened by setting `erpStore.clientUi.profileId`. Atlantis header (name, rank, age, services, vessel-type chip, "Dedicated to X - On Board / On Vacation"), side menu; only **Documents** has content (atl-table with selection → ZIP via JSZip, per-row view / download); other tabs are placeholders. **Document viewer (`document-viewer`)** — blue-bar "View Document" dialog, read-only fields + PDF preview (`documentPdf()` mock scan) with download.

**Hidden from clients:** wages/contract, task costs, candidate category (Dedicated/Ex-Crew/New), CES scores, BMI. Replacement candidates are named only after approval (stage preparation).

### Crew data (`data/crew.js`)
- `onboard.seafarerId` in vessels.js links each current crew member to `allSeafarers` (candidate pool) or `crewSeafarers` (ids 1001+ on board, 1101+ former, 1201+ approved reliefs). crewSeafarers are NOT RFE candidates.
- A vessel's `ranks` rows are **positions**; a rank may have several (v1 has two Able Seaman). `rankPos(vessel,row)` = 1-based position among same-rank rows. Never key rows by rank alone. `safeManning:false` marks supernumerary positions (v1 Deck Cadet).
- `crewReliefSeed` (with optional `pos`) → `crewPastAssignments` (`pos` included): two-person rotation per position (relief tour ending on current embark, current holder's previous tour before it).
- Relief stages: search | approval | preparation | ready (legacy rfa status `deployment` → ready). `isApprovedStage()` = preparation or ready (candidate approved, named).
- Live stage of an RFE row: `rfeLiveStage(row)` = preparation when OnPreparation, approval while candidates `onApproval` are undecided, else search. Before the rows exist `rfeSeedStage(status)`.
- `standaloneRfes(vessel)` — standalone RFEs (erpStore.rfeRows not linked to a replacement) with live stage / name; used by `crewEvents` and the client Gantt.
- `crewSignoffDate(row)` = rfr_rfe.embarkDate › rfs.signoffDate › onboard.signoff.
- `crewRelief(vessel,row)` — from rfr_rfe (live state from `erpStore.rfaRows.replacement`, else `rfr_rfe.confirmedSeafarer`) or legacy `rfa` Replace (`confirmedSeafarer`, named only when stage preparation). stage: search | approval | preparation.
- `crewOnDate(vessel, iso)` → rows kind past | current | planned | unknown. `crewEvents(vessel)` → change events (standalone RFEs use `seedRfeRows[].confirmedSeafarer`).
- Person helpers: `fullNameLF`, `barLabel`, `seafarerAge`, `crewPort(vesselId, key)` (deterministic port), `seafarerTours`, `lastTourOf`, `dedicatedClientOf` (client of last tour's vessel), `availabilityOf`.

### Documents (`data/documents.js`)
`seafarerDocuments(id)` generates a deterministic, cached list per seafarer using Atlantis categories (Travel Doc, STCW, Flag Req., Medical) with Country / Issued By (e.g. DFA MANILA, MARINA, BOQ for Filipinos) and expiry relative to TODAY. `docStatus(doc)` → valid | expiring (≤90d) | expired | permanent. `docSummary(id)`, `findDocument(id, nameStart)`.

---

## CSS architecture

### gantt.css classes
`.gantt-bar, .bar-onboard(#5b7fbd), .bar-future-service(#93b8d8), .bar-signoff-early, .bar-signoff-late, .rfa-top, .rfa-bottom, .rfa-rfs/rfr/rfe/rfp/rfx, .rfa-active/approval/preparation/completed, .bar-label, .today-line(green #16a34a), .rfa-horizon-line(amber #d97706), .rank-row(62px), .rfe-row(50px)`

### Styling conventions
- Sub-nav: `bg-white border-b flex px-8 shadow-sm shrink-0` with `.active-tab` button
- Filter bars: `bg-white border-b px-6 py-3 flex items-center gap-4 shrink-0 flex-wrap`
- Section labels: `text-[9px] font-black uppercase text-gray-400 tracking-widest`
- Info cards: `bg-white rounded-xl border border-gray-200 px-6 py-5`
- Slate table header: `bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest`
- Primary button: `bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-bold`
- Client-level tab active: `border-blue-600 text-blue-600`
- Vessel sub-tab active: `border-slate-700 text-slate-800` (darker, visually nested)
- RFAs tab active: type-coloured (amber=replacement, sky=embarkation, rose=signoff, teal=extension, purple=promotion)

---

## Adding a new view — pattern

1. Add `<script type="text/x-template" id="tpl-my-view">` in `index.html` before the RotationAll template comment.
2. Create `views/MyView.js` (pure JS): `const MyView = { template: '#tpl-my-view', ... }`
3. Add `<script src="views/MyView.js"></script>` after the window bridge block.
4. Add route to the router array.
5. Add sidebar link.
6. For new data: `data/mydata.js` with `var myData = [...]`, add script src before bridge, add `window.myData = myData` to bridge.

---

## What is NOT yet built (stub views)

- `/admin/users` — user management
- `/admin/settings` — system settings
- `/recruitment/candidates` — seafarer database / profiles (data partially in `allSeafarers`)
- `/recruitment/pipeline` — RFC → shortlist → proposal → confirmation workflow
- `/` (home) — dashboard

### On Preparation (phase 9)
Requests whose preparation is under way: approved embarkations (replacement rows `rfeStatus:'OnPreparation'` → `rfeTasks`, standalone RFE rows → `tasks`) and sign-off / extension / promotion rows with `status:'preparation'` (→ `tasks`). Atlantis reference: `atlantis-ref/OnPreparation.png` (red areas = excluded for clients).
- **Checklist** (`data/preparation.js`): *Document requirements* per kind (`PREP_DOC_RULES`: rfe — passport, seaman's book, USA visa, own CoC/COP, basic training, PSCRB, PEME, D&A; rfx — passport, seaman's book, CoC, PEME; rfp — CoC/COP of the new rank (`cocNameForRank`), PEME; rfs — none), fulfilled when the seafarer's document is valid until `prepNeedUntil` (end of service / extended date) or the row has `prepRenewed`; *Manual tasks* = the row's task list grouped by `group` (DOCUMENTS / GENERAL / TRAVEL — see `DEFAULT_TASKS` in RFAs.js). Shared with the internal RFAs view, so tasks ticked there show for the client. `prepProgress()`, `prepIsComplete()`.
- **Ready** stage of an embarkation = checklist complete (`rfeLiveStage`); dark green on the Gantt.
- Seed: `prepDone: [task ids] | true` and `renewed: true` on rfs / rfr_rfe / rfa / seedRfeRows (e.g. RFE-4061 Reyes ready; RFE-4083, RFE-4002, RFS-4002/4061/4083, RFX-2031 on v1/v2; RFS-3002, RFX-1074, RFP-1090 on v3; RFE-2024 on v4).
- **Page** `/client/preparation` (menu "On Preparation", info badge with the count): type segment (All / Embarkation / Sign-off / Extension / Promotion), vessel filter, atl-table (Request link, Vessel, Rank, type chip, seafarer, date, due = date − 14 d, days left, progress n / N, open documents, status On Preparation / Ready).
- **Dialog** `<preparation-dialog>` (store `clientUi.prepRef`): Atlantis header (request + On Preparation / Ready chip, rank + seafarer link, due / date, client, vessel – type – port) + PRINT CONTRACT (`contractPdf()`, not for sign-offs); "Preparation Checklist" with progress chip; Document Requirements by category (✓ / ✗ missing / clock expiring, note, eye → document viewer); Manual Tasks by group with read-only checkboxes. **Excluded for clients:** Edit Contract/Allotments, Cancel, costs and all totals.
- Opened from the list, from green (preparation / ready) relief bars and from RFS / RFX / RFP bars of requests in preparation on the Rotation Plan (`barTarget()` → 'prep' | 'approval'), from "Checklist" buttons on the phone crew plan, and from the approval dialog after approving.

### Phones and tablets (phase 8)
- Global mixin (index.html bootstrap): `isPhone` = width < 600, or a phone held sideways (height < 500 and width < 1000), from `this.$vuetify.display` (reactive, follows rotation); `isTouch` = `(hover: none)`. Templates switch layouts with `isPhone`; tablets (600–1280) keep the desktop layout with media-query fixes.
- `.atl-page` height uses `--v-layout-top` / `--v-layout-bottom` (app bar, bottom navigation).
- **Portal (phone):** compact app bar with account menu (viewing-as, user, exit); `v-bottom-navigation` with Dashboard · Crew · Rotation · Approvals (badge).
- **AtlTable (phone):** cards — title = first link column, subtitle = other fixed columns (`cardPrefix` e.g. "Age "), body = visible optional columns as label / value; "Show more" (20 at a time) instead of paging; COLUMNS and Export PDF as icon buttons; PRESETS hidden. Applies to Crew Lists, Pending Approvals and profile Documents.
- **Crew Lists (phone):** short tab labels, filter summary line, all filters in a bottom sheet.
- **Dashboard (phone):** tiles 2 per row, fleet and documents as cards.
- **Rotation Plan (phone):** crew plan (`phoneGroups`): vessel chips, RF type chips, rank; one card per position with current holder (since / until / days left), RFS/RFX/RFP chips, next relief stage (Review button for Principal Approval), previous tour; tap → bottom sheet with every bar's card. **Tablets** keep the Gantt: shorter month labels (JUL '26 or JUL), rank column 200 px below 1024, RF type toggles scroll; on touch a tap shows the bar card in a bottom sheet (Review candidates).
- **Approval dialog (phone):** fullscreen, stacked header and candidate cards, sticky bottom bar Reject all / Confirm approval. Tablet (< 960): 2-column header.
- **Profile (phone):** fullscreen, tabs instead of the side menu (icons-only side menu below 960). **Document viewer (phone):** fullscreen, fields + "Open PDF" (native viewer) / Download instead of the iframe preview.

**Client UI:** all planned phases built (portal, Crew Lists, profile + documents, Rotation Plan, Pending Approvals, Dashboard). Open items: profile tabs other than Documents are placeholders; PRESETS is look-only; dashboard figures to be customised with stakeholders.

**Next logical views:**
- **Recruitment → Candidates** — full seafarer profiles, documents, certificates, availability
- **Recruitment → Pipeline** — ties into the RFE two-pane candidate flow already built in RFAs
- **Home dashboard** — summary cards: open RFEs, upcoming sign-offs, vessels at risk

---

## GitHub Pages deployment
- Repo on GitHub (public), Pages enabled from `main` branch root `/`
- Live URL: `https://USERNAME.github.io/REPO-NAME/`
- Deploy: edit → commit → push → auto-deploys in ~30s
