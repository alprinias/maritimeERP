# CONTEXT.md — Maritime ERP Mockup
**For AI model continuation. Updated after completing the RFAs view (Replacement, Embarkation, Sign-Off, Extension, Promotion tabs).**

---

## Project overview

A **single-page web application** mockup for a maritime manning agency ERP system. Pure static files — no build step, no backend. Hosted on GitHub Pages.

**Tech stack:**
- Vue 3 via CDN (`vue.global.js`) — Options API throughout
- Vue Router 4 via CDN — hash-based routing (`#/path`)
- Tailwind CSS via CDN
- No npm, no bundler, no compilation

---

## File structure

```
maritimeERP/
├── index.html              ← App shell + ALL x-templates + router bootstrap
├── assets/
│   ├── erp-base.css        ← Shared: scrollbar, .active-tab
│   └── gantt.css           ← Gantt bars, RFA colours, reference lines
├── data/
│   ├── utils.js            ← Date helpers (var TODAY, d, addM, daysB, isoDate, fmtShort, shortName)
│   ├── vessels.js          ← var allVessels (6 vessels, 4 clients, full rank/RFA data)
│   ├── seafarers.js        ← var allSeafarers, var seedRfeRows
│   └── clients.js          ← var allClientsData (4 clients, salaryRanges, docTypes, vesselIds)
├── views/
│   ├── RotationAll.js      ← Fleet Rotation Gantt view
│   ├── ClientsSetup.js     ← Admin → Clients Setup view
│   └── RFAs.js             ← Operations → RFAs view (+ RfaCardComponent)
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
CDN: Vue → VueRouter → Tailwind
assets/erp-base.css + gantt.css
x-template blocks (tpl-clients-setup, tpl-rfa-card, tpl-rfas, tpl-rotation-all)
data/utils.js → data/vessels.js → data/seafarers.js
[inline: window.* bridge + data/clients.js]
views/ClientsSetup.js → views/RFAs.js → views/RotationAll.js
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

**Next logical views:**
- **Recruitment → Candidates** — full seafarer profiles, documents, certificates, availability
- **Recruitment → Pipeline** — ties into the RFE two-pane candidate flow already built in RFAs
- **Home dashboard** — summary cards: open RFEs, upcoming sign-offs, vessels at risk

---

## GitHub Pages deployment
- Repo on GitHub (public), Pages enabled from `main` branch root `/`
- Live URL: `https://USERNAME.github.io/REPO-NAME/`
- Deploy: edit → commit → push → auto-deploys in ~30s
