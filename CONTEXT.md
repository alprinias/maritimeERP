# CONTEXT.md — Maritime ERP Mockup
**For AI model continuation. Last updated after publishing to GitHub Pages.**

---

## Project overview

A **single-page web application** mockup for a maritime manning agency ERP system. No build step, no framework CLI, no backend. Pure static files: Vue 3 + Vue Router 4 + Tailwind CSS, all loaded via CDN. Hosted on GitHub Pages.

**Tech stack:**
- Vue 3 via CDN (`vue.global.js`) — `createApp`, Options API throughout
- Vue Router 4 via CDN (`vue-router.global.js`) — hash-based routing (`#/path`)
- Tailwind CSS via CDN (`cdn.tailwindcss.com`)
- No build step, no `npm`, no bundler

---

## File structure

```
maritimeERP/
├── index.html              ← App shell: sidebar nav, top bar, router-view, ALL x-templates, bootstrap
├── assets/
│   ├── erp-base.css        ← Shared: scrollbar, active-tab, tooltip
│   └── gantt.css           ← Gantt-specific: bar zones, RFA colours, status textures, reference lines
├── data/
│   ├── utils.js            ← Date helpers: TODAY, d(), addM(), daysB(), isoDate(), fmtShort(), shortName()
│   ├── vessels.js          ← var allVessels — 6 vessels, 4 clients, full rank rows + RFA data
│   ├── seafarers.js        ← var allSeafarers, var seedRfeRows
│   └── clients.js          ← var allClientsData — 4 clients with salaryRanges, docTypes, vesselIds
└── views/
    ├── RotationAll.js      ← Fleet Rotation view component (pure JS, no HTML tags)
    └── ClientsSetup.js     ← Admin → Clients Setup view component (pure JS, no HTML tags)
```

**Total size:** ~2,700 lines across all files.

---

## Critical architecture rules

### Template pattern
Vue component templates are NOT inline strings. They use `<script type="text/x-template" id="tpl-NAME">` tags embedded directly in `index.html`. Each view `.js` file references its template by id:
```js
const RotationAllView = { template: '#tpl-rotation-all', data() {...}, ... }
```
**Templates must live in `index.html`, not in `.js` files.** A `.js` file is loaded as JavaScript — the browser never parses HTML tags inside it.

### Global variable scoping
All data files use `var` (not `const`) so variables are hoisted onto `window`. Additionally, `index.html` has an explicit bridge block between the data `<script src>` tags and view `<script src>` tags:
```js
window.allVessels     = allVessels;
window.allClientsData = allClientsData;
window.allSeafarers   = allSeafarers;
window.seedRfeRows    = seedRfeRows;
window.TODAY          = TODAY;
```
**Never use `const` or `let` at the top level of a data `.js` file.** They do not attach to `window` and will be invisible to other script files.

### Script load order in index.html
```
CDN scripts (Vue, VueRouter, Tailwind)
↓
assets/ CSS files
↓
x-template blocks (inside index.html)
↓
data/utils.js
data/vessels.js
data/seafarers.js
[inline script: window.* bridge]
data/clients.js
views/ClientsSetup.js
views/RotationAll.js
[inline script: stub views]
[inline script: router + createApp + mount]
```

### Vue template rules (runtime compiler constraints)
- No inner `v-if` inside a `v-if/v-else-if` chain — use `v-show` for conditional visibility inside a branch
- Tailwind bracket classes like `text-[11px]` are fine in HTML attributes but would break JS template literals — another reason to keep templates in x-template tags, not strings
- `v-for` + `v-if` on the same element: always use `<template v-for>` wrapper instead

### String literals in data files
Use double quotes for any string containing an apostrophe (e.g. `"Lloyd's Register"` not `'Lloyd\'s Register'`). Escaped apostrophes in single-quoted JS strings cause `SyntaxError` in some contexts.

---

## App shell (index.html)

### Layout
```
┌─────────────────────────────────────────────────────────┐
│ Top bar (48px): hamburger | MARITIMEERP logo | user info│
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │  <router-view>  (content area)               │
│ (w-52 or │                                              │
│  w-0)    │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### Sidebar
Collapsible via hamburger (toggles `sidebarOpen` ref). Three expandable sections with chevron, state in `openSections` reactive object (admin, recruitment, operations). Admin and Operations open by default.

**Sidebar menu structure:**
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
```

### Root Vue app setup()
```js
const app = createApp({
    setup() {
        const sidebarOpen = ref(true);
        const openSections = reactive({ admin: true, recruitment: false, operations: true });
        function toggleSection(key) { openSections[key] = !openSections[key]; }
        return { sidebarOpen, openSections, toggleSection };
    }
});
app.use(router).mount('#app');
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
```

Stub views are generated by `makeStub(label)` helper defined inline in `index.html`.

---

## Data layer

### utils.js
```js
var TODAY = new Date();
function d(s)        { return new Date(s); }
function addM(dt, n) { ... }   // add n months to a Date
function daysB(a, b) { ... }   // days between two Dates
function isoDate(dt) { ... }   // → 'YYYY-MM-DD' string
function fmtShort(s) { ... }   // → 'Jan 5' style
function shortName(full) { ... } // 'JUAN DELA CRUZ' → 'J. Dela Cruz'
```

### vessels.js — `var allVessels`
Array of 6 vessel objects. Each vessel:
```js
{
    id: 'v1',                        // 'v1'–'v6'
    client: 'Global Shipping Ltd',   // must match allClientsData client names
    name: 'MV Sea Star',
    type: 'Oil Tanker',
    flag: 'Panama',
    imo: '9412831', built: 2011, gt: 29800,
    engineType: 'MAN B&W 6S60MC-C', enginePower: '12 960 kW',
    classificationSociety: 'Bureau Veritas',
    piClub: 'UK P&I Club',
    hullInsurer: "Lloyd's of London",
    hullValue: 'USD 18,500,000',
    vesselRanks: null,               // null until user saves overrides; then array (see below)
    ranks: [                         // array of rank row objects (see below)
        { rank, isRating?, onboard, rfa, rfs, rfr_rfe }
    ]
}
```

**Rank row shape:**
```js
{
    rank: 'Captain',
    isRating: true,          // optional; if true = ratings (AB, OS, Oiler) excluded by default
    onboard: { name, shortName, embark, signoff, contract },
    rfa: null | {
        rfaNo, type('Extend'|'Replace'|'Promote'), status,
        rfaStart, rfaEnd, newRank?, proposed:[], confirmedSeafarer
    },
    rfs: null | { rfaNo, dateCreated, signoffDate, port, status },
    rfr_rfe: null | { rfaNo, dateCreated, embarkDate, port, status }
}
```

**vesselRanks override shape** (stored on vessel when user edits Ranks & Manning tab):
```js
vesselRanks: [
    { rank: 'Captain', manning: 1, salaryMin: 10000, salaryMax: 13000, currency: 'USD' },
    ...  // only ranks with at least one value set are stored
]
```

**6 vessels across 4 clients:**
- `v1` MV Sea Star — Oil Tanker — Global Shipping Ltd
- `v2` MV Atlantic Pride — Bulk Carrier — Global Shipping Ltd
- `v3` Oceanic Express — Container — Blue Water Corp (has RFX-1074, RFR-1051, RFP-1090)
- `v4` Alpha Prime — Chemical Tanker — Alpha Tankers
- `v5` Alpha Horizon — Oil Tanker — Alpha Tankers
- `v6` Pacific Trader — RoRo — Pacific Logistics

### seafarers.js
```js
var allSeafarers  // 13 seafarer objects: { id, name, rank, age, bmi, availDate, cesStcw, cesEnglish, nationality, category, services[] }
var seedRfeRows   // 3 standalone RFE rows: RFE-2011 (C/O, v1), RFE-2019 (Captain, v2), RFE-2024 (2/E, v4)
```
Seafarer categories: `'Client Ex-Crew'`, `'Other Ex-Crew'`, `'New Candidates'`

### clients.js — `var allClientsData`
Array of 4 client objects:
```js
{
    id: 'c1',
    name: 'Global Shipping Ltd', alias: 'GSL',
    address: '...', contactEmail: '...', contactPhone: '...',
    isActive: true,
    vesselIds: ['v1', 'v2'],           // references into allVessels
    salaryRanges: [                    // 11 rank entries
        { rank: 'Captain', min: 8500, max: 11000, currency: 'USD' },
        ...
    ],
    docTypes: [                        // 8 seed document types per client
        { id: 'dt1', name: 'STCW Basic Safety (BST)', required: {} },
        // required: { 'Captain': true, 'Chief Officer': true, ... }
        ...
    ]
}
```
**4 clients:** Global Shipping Ltd (c1), Blue Water Corp (c2), Alpha Tankers (c3), Pacific Logistics (c4, isActive: false).

---

## View: RotationAll (`/operations/rotation`)

**Template id:** `tpl-rotation-all`
**Component file:** `views/RotationAll.js`

A Gantt-style fleet rotation planner. The largest and most complex view.

### Layout
```
Sub-nav bar (sticky)
Filter bar: Client → Vessel → Rank → RF Type segmented | Window 6/12/18mo | Include Ratings | From date + Reset
─────────────────────────────────────────────────────────────────────────────
Sticky month ruler
Scrollable chart body:
  For each vessel:
    Vessel header row (dark slate) [client · name · type · + Embark button]
    Rank rows (62px each): sticky label | chart zone with bars
    RFE rows (50px, bg-blue-50): label+badge | chart zone with future bar + RFE bar
Footer ruler (today / horizon labels)
```

### Gantt bar zones (within 62px rank row)
```
top:3%  height:22%  z-index:4  → RFS/RFR sign-off thin bar  (TOP zone)
top:28% height:44%  z-index:2  → Onboard service bar         (MIDDLE zone)
top:76% height:22%  z-index:3  → RFE/RFR embark/RFX/RFP     (BOTTOM zone)
```

### RF type system
| Code | Colour | Meaning |
|------|--------|---------|
| RFS-xxxx | Rose `#f43f5e` | Request For Sign-off |
| RFR-xxxx | Amber `#f59e0b` | Request For Replacement (creates both RFS + RFE) |
| RFE-xxxx | Sky `#0ea5e9` | Request For Embarkation (standalone) |
| RFP-xxxx | Purple `#a855f7` | Request For Promotion |
| RFX-xxxx | Teal `#14b8a6` | Request For Extension |

Status textures: `active` (solid), `approval` (diagonal stripes), `preparation` (dot grid), `completed` (desaturated).

### Key reactive state (data())
```js
viewMonths, dayWidth: 3.0, rankColWidth: 240, ganttStartStr,
includeRatings, filterClient, filterVessel, filterRank, filterRfType,
ctxMenu: { visible, x, y, vessel, row },
modal: { visible, action, vessel, row },
extendForm, replaceForm, promoteForm, embarkForm, signoffForm,
rfaModal: { visible, kind, data, row, vessel, editStatus, confirmDelete,
            rfcIssued, selectedCandidates, availFilter, showCompare, showProposal },
todayStr, rfeRows (copy of seedRfeRows), allSeafarers
```

### Key computed
- `ganttStart/End/TotalDays`, `todayOffset`, `rfaHorizonOffset` (today+2mo), `ganttMonths`
- `allClients`, `clientVessels`, `allRanks`
- `allFlatRows` — filtered vessel+rank list for rendering
- `vesselRankRows`, `higherRanks`, `rfaModalTypeName/HeaderClass/StatusBadgeClass/StatusOptions`
- `candidateCategories`, `rfaModalAvailDefault`

### Modals
1. **Action modal** — opened from `+ Embark` button or context menu. Actions: Embark (RFE), Extend (RFX), Replace (RFR), Sign Off (RFS), Promote (RFP). Each has its own form section shown with `v-else-if`.
2. **RFA detail modal** — single-pane for RFX/RFP/RFS/RFR, two-pane (960px) for active RFE. Two-pane has candidate pool on right grouped by category with checkboxes, Compare modal, Proposal email modal.
3. **Context menu** — right-click on onboard bar, shows seafarer info + action buttons.

### Replace (RFR) creates 3 things simultaneously:
```js
row.rfs     = { rfaNo: 'RFS-xxxx', ... }
row.rfr_rfe = { rfaNo: 'RFE-xxxx', ... }
rfeRows.push({ vesselId, rfaNo: 'RFE-xxxx', ... })  // standalone RFE row
```

### Standalone RFE rows
`openRfaModal(rfe, 'rfe', null, vessel)` — `row` is null. All code reading `rfaModal.row.rank` must fall back to `rfaModal.data.rank`.

---

## View: ClientsSetup (`/admin/clients`)

**Template id:** `tpl-clients-setup`
**Component file:** `views/ClientsSetup.js`

### Layout
```
Sub-nav: "CLIENTS SETUP"
Selector bar: Client dropdown + Active/Inactive badge
─────────────────────────────────────────────
[Empty state if no client selected]
[Client detail panel]:
  Tab bar: Details | Vessels | Salary Ranges | Documents
```

### Details tab
View mode: 2-col info card (name, alias, address, email, phone, status, vessel count) + Edit button.
Edit mode: inline form, saves back to `allClientsData` object with `Object.assign`.

### Vessels tab
Vessel dropdown (filtered to `selectedClient.vesselIds`). When vessel selected, shows two sub-tabs:

**Details sub-tab** — 11-field card (IMO, built, GT, flag, type, classification society, engine type, engine power, P&I club, hull insurer, hull value). Edit saves with `Object.assign`.

**Ranks & Manning sub-tab** — table of all 11 ranks × 4 columns (Manning count, Min Salary, Max Salary, Currency). Vessel values override client values. Empty vessel cells show client rate in grey italic as placeholder. On save, only rows with ≥1 value are persisted to `vessel.vesselRanks`.

### Salary Ranges tab
Table of 11 ranks × min/max/currency, editable inline. Saves to `client.salaryRanges`.

### Documents tab
**Matrix grid:** document types as rows (sticky left column), ranks as column headers (rotated vertically). Intersection = custom checkbox (blue when checked, grey border when not).

Features:
- **+ Add document type** → inline input form (Enter to confirm, Escape to cancel)
- **Rename** → hover row → click ✏ pencil → inline input, blur/Enter saves
- **Delete row** → hover row → × button appears on right
- **Toggle** → click any cell in the matrix body

Data model per doc type:
```js
{ id: 'dt1', name: 'STCW Basic Safety (BST)', required: { 'Captain': true, 'Chief Officer': true } }
```

**Key component state:**
```js
selectedClientId, activeTab,           // client level
editing, editForm, editSalary,
selectedVesselId, vesselTab,           // vessel level
vesselEditing, vesselEditForm,
vesselRanksEditing, editVesselRanks,
addingDocType, newDocTypeName,         // documents tab
editingDocName, editDocNameVal
```

**Key methods:** `startEdit/cancelEdit/saveEdit`, `startVesselEdit/saveVesselEdit`, `startVesselRanksEdit/saveVesselRanks`, `clientRateFor(rank, 'min'|'max')`, `clientCurrencyFor(rank)`, `addDocType`, `confirmAddDocType`, `removeDocType(docId)`, `toggleDocRequirement(doc, rank)`, `isRequired(doc, rank)`, `startEditDocName(doc)`, `saveDocName(doc)`

---

## CSS architecture

### gantt.css classes
- `.gantt-bar` — base positioning + hover effect
- `.bar-onboard` — `#5b7fbd`, middle zone
- `.bar-future-service` — `#93b8d8`, middle zone (RFE rows)
- `.bar-signoff-early` / `.bar-signoff-late` — adjustment overlays (z-index 5)
- `.rfa-top` / `.rfa-bottom` — zone positioning
- `.rfa-rfs/rfr/rfe/rfp/rfx` — type colours
- `.rfa-active/approval/preparation/completed` — status textures via `::after`
- `.bar-label` — text overlay on bars
- `.today-line` (green `#16a34a`) / `.rfa-horizon-line` (amber `#d97706`) — reference lines
- `.rank-row` (62px) / `.rfe-row` (50px) — row heights

### erp-base.css classes
- `::-webkit-scrollbar` — thin scrollbar
- `.active-tab` — blue bottom border, used in sub-nav bars
- `.tt` — shared tooltip base

---

## Styling conventions

- Sub-nav bars: `bg-white border-b flex px-8 shadow-sm shrink-0` with `.active-tab` button
- Filter bars: `bg-white border-b px-8 py-3 flex items-center gap-4 shrink-0`
- Section labels: `text-[9px] font-black uppercase text-gray-400 tracking-widest`
- Info cards: `bg-white rounded-xl border border-gray-200 px-6 py-5`
- Primary action button: `bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-bold`
- Slate table header: `bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest`
- Alternating table rows: `bg-white` / `bg-gray-50`
- Tab bar (client-level): `border-blue-600 text-blue-600` active
- Tab bar (vessel sub-level): `border-slate-700 text-slate-800` active (darker, to visually nest)

---

## What is NOT yet built (stub views)

These routes exist but show a "Coming soon 🚧" placeholder:
- `/admin/users` — user management
- `/admin/settings` — system settings
- `/recruitment/candidates` — candidate pool / seafarer database
- `/recruitment/pipeline` — recruitment workflow
- `/` (home) — dashboard / landing

**The next logical views to build:**
- **Recruitment → Candidates** — full seafarer profiles, documents, certificates, availability calendar. Data already partially exists in `allSeafarers`.
- **Recruitment → Pipeline** — RFC → candidate shortlist → proposal → confirmation workflow (ties into the RFE two-pane modal already in RotationAll).
- **Admin → Users** — user accounts, roles (Ops, Recruitment, Admin).
- **Home dashboard** — summary cards: vessels at risk, upcoming sign-offs, open RFEs, etc.

---

## Adding a new view — step-by-step pattern

1. **Add x-template** in `index.html`, just before the `<!-- ── RotationAll x-template` comment:
```html
<script type="text/x-template" id="tpl-my-view">
<div class="flex-1 flex flex-col overflow-hidden">
    <nav class="bg-white border-b flex px-8 shadow-sm shrink-0">
        <button class="active-tab py-3 px-1 text-sm">MY VIEW TITLE</button>
    </nav>
    <!-- content here -->
</div>
</script>
```

2. **Create `views/MyView.js`** (pure JS, no HTML tags):
```js
const MyView = {
    template: '#tpl-my-view',
    data() { return { ... }; },
    computed: { ... },
    methods: { ... },
};
```

3. **Add `<script src="views/MyView.js"></script>`** in `index.html` after the window bridge block, before the stub views script.

4. **Add route** in the router routes array in `index.html`.

5. **Add sidebar link** in the appropriate section in `index.html`.

6. **If adding new data**, create `data/mydata.js` using `var myData = [...]`, add `<script src="data/mydata.js"></script>` before the window bridge, and add `window.myData = myData;` to the bridge block.

---

## GitHub Pages deployment

- **Repo:** on GitHub (public)
- **Pages:** enabled from `main` branch, root `/`
- **Live URL:** `https://USERNAME.github.io/REPO-NAME/`
- **Deploy cycle:** edit files locally → stage → commit → push → auto-deploys in ~30s
- **No build step needed** — GitHub Pages serves static files directly
