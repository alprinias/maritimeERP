# RFE Pipeline Analytics — frontend brief

This brief is for the developer who will build the **RFE Pipeline Analytics** page in the real application with **Vue 3, Vuetify 3 (the Atlantis look) and Apache ECharts 5**. The page reads the endpoints described in [RFE_ANALYTICS_BACKEND.md](RFE_ANALYTICS_BACKEND.md). Read that brief first for the concepts:

- stages and the 7 steps;
- the final-pass rule;
- candidate outcomes, including "not favored";
- the reason lists.

The mockup is the visual and behavioural reference. Port its logic, but **don't copy its structure**: it is a single-file prototype on CDN scripts, with the Options API, x-templates and global variables.

- **Live mockup:** https://alprinias.github.io/maritimeERP/#/operations/rfe-analytics (Operations → RFE Analytics)
- **Run locally:** open `index.html` in a browser. There is no build step.

| Mockup file | What to take from it |
|---|---|
| `index.html`, template `tpl-ops-analytics` | Page layout, texts, Vuetify components used |
| `views/OpsAnalytics.js` | **All calculations and every ECharts option**. Each section below names the function to port. |
| `assets/client-portal.css`, `.atl-an*` rules | Sizes, spacing, swatches, heat table, tile change arrows |
| `data/analytics.js` | Step ids, labels and colours (`RFE_STEPS`); `rfeStepDurations` is the reference for the backend |
| `views/ClientCommon.js`, `AtlTable` | The Atlantis table: column chooser, sorting, paging, PDF/Excel export, phone cards |
| `views/RFAs.js`, `views/ClientApprovals.js` | The screens that **record** refusals and rejections (§9) |

---

## 1. The page in one paragraph

The page has two tabs, **Time** and **Refusals & rejections**, under a header holding the **Median / Average** switch and the **Targets** button. One filter row applies to the whole page: period, principal, vessel type, rank, seafarer pool, user group and user.

- **Time tab:**
  - KPI tiles;
  - a stacked bar per group showing days per step;
  - a box plot of the spread per step;
  - a rework table;
  - 7 small trend charts;
  - the In-flight RFEs table.
- **Refusals & rejections tab:**
  - KPI tiles;
  - two reason bar charts;
  - time lost per reason;
  - a reason heat table by group;
  - 3 small trend charts;
  - a Cases table.

The KPI tiles on both tabs show the change against a comparison period. Everything is in the Atlantis look (Vuetify theme `atlantis`, primary `#1565C0`, font Inter).

---

## 2. Suggested structure

```
RfeAnalyticsPage.vue          header, tabs, filter bar, state, data loading
├─ AnalyticsFilters.vue       period (+ custom From/To), 6 filters, Clear
├─ KpiTiles.vue               tiles + "Compared with …" caption (both tabs)
├─ time/
│  ├─ StepBarsPanel.vue       stacked bars ⇄ table, Compare by, legend, footnote
│  ├─ SpreadPanel.vue         box plot
│  ├─ ReworkPanel.vue         v-table with meters
│  ├─ StepTrendsPanel.vue     7 small multiples
│  └─ InFlightPanel.vue       AtlTable
├─ decisions/
│  ├─ ReasonBarsPanel.vue     used twice (refusals / rejections)
│  ├─ TimeLostPanel.vue
│  ├─ ReasonHeatPanel.vue     Compare by + side switch
│  ├─ RateTrendsPanel.vue     3 small multiples
│  └─ CasesPanel.vue          AtlTable + reason chip
├─ TargetsDialog.vue
└─ EChart.vue                 thin wrapper (or vue-echarts)
composables/
├─ useAnalyticsPeriod.js      range + comparison range (port `range`)
├─ useRfeStats.js             quantile/median/average, step stats, groupBy
└─ useDecisionStats.js        decision counts and rates, reasons, time lost
```

- Keep the calculations in plain functions, so they can be unit-tested without Vue.
- `vue-echarts` is fine as the chart wrapper. The mockup's own wrapper (`EChart` in `OpsAnalytics.js`) is about 15 lines:
  - it uses the **SVG renderer**;
  - it calls `setOption(option, true)` whenever the option changes;
  - a `ResizeObserver` resizes the chart;
  - it emits every chart `click` as `bar-click`.

---

## 3. State and data loading

| State | Default | Effect |
|---|---|---|
| `tab` | `'time'` | `'time'` or `'decisions'` |
| `period` | `'m12'` | `m3`, `m6`, `m12`, `ytd`, `ly` or `custom` |
| `customFrom`, `customTo` | last 12 months when Custom is first chosen | `'YYYY-MM'`. Keep From ≤ To by moving the other box. |
| `compareMode` | `'prev'` | `'prev'` (previous period) or `'year'` (same period last year). Changes the comparison request only. |
| `filters` | all `null` | `principalId`, `vesselType`, `rank`, `pool`, `groupId`, `userId` |
| `stat` | `'median'` | `'median'` or `'average'`. **Client-only**: no refetch. |
| `compareBy` | `'client'` | `all`, `client` (principal), `rank`, `vesselType`, `pool`, `user`, `group`. **Client-only**; shared by both tabs. |
| `leadView` | `'chart'` | `chart` or `table` for the step bars |
| `decSide` | `'refusal'` | Heat table side |
| `selReason` | `null` | `{ kind: 'refused' \| 'rejected' \| 'noAnswer', id? }`. Narrows the Cases table. |
| `targets` | from lookups | `{ s1 … s7 }` in days |

Which data to load, and when:

| Data | When to load |
|---|---|
| `GET lookups` | Once. Gives the filter options, reason lists, targets and `dataStart`. |
| `GET completed` | **Twice**: once for the period and once for the comparison period. Call it when the period or filters change and the Time tab is open (or lazily on first open). |
| `GET decisions` | Twice, as above, for the Refusals tab |
| `GET in-flight` | When the filters change, apart from pool and period, which it ignores |

- Debounce filter changes by about 250 ms.
- Cancel stale requests (`AbortController`). Otherwise a slow response can overwrite a newer one.
- Cache by query string, so switching tabs back and forth doesn't refetch.
- **The mockup has no loading or error states.** Add them:
  - a skeleton for the tiles and panels while loading;
  - an error panel with a Retry button.

  Keep the previous data on screen, dimmed, while new data loads, so the layout doesn't jump.

---

## 4. Period and comparison

Port the `range` computed property and its helpers `_anMonths` and `_anMonthKey` from `OpsAnalytics.js`. The period's label reads **"Embarked"** on the Time tab and **"Decided"** on the Refusals tab.

A switch next to the comparison caption, **Previous period** / **Same period last year** (`compareMode`: `'prev'` by default, or `'year'`), chooses what the tiles compare with. It applies to both tabs.

| Choice (label in the list) | Period `[from, to)` | Previous period | Same period last year | Trend months |
|---|---|---|---|---|
| Last 3 / 6 / 12 months | now − N × 30.44 d → now | the N × 30.44 d before | the same dates one year earlier | the last N calendar months, including the current one |
| This year (2026) | 1 Jan → now | the same number of days before 1 Jan | 1 Jan → today's date, last year | Jan → current month |
| Last year (2025) | the previous calendar year | the year before | the year before (the same) | 12 months |
| Custom range… | 1st of From → 1st of the month after To | the same number of whole months just before | the same months one year earlier; up to today's date last year when To is the current month | From → To |

For example, a custom range of Aug–Sep 2026 is compared either with Jun–Jul 2026 or with Aug–Sep 2025.

**Custom range:**
- Show two extra selects, **From** and **To**.
- Offer only months from `dataStart` up to the current month, newest first.

**When the range reaches today** (any choice except Last year, or a custom range ending in the current month):
- Omit `to` in the request.
- Treat the range as "live". The In-flight panel then shows no note (§6.6).

**Comparison caption** above the tiles, one of:
- `Compared with the previous 12 months (13 Nov 2024 – 13 Nov 2025)`, or `Compared with the same period a year earlier (01 Aug 2025 – 30 Sep 2025)`;
- `No comparison: there is no data before Dec 2023`, when the comparison period starts before `dataStart`;
- `No comparison: too few records in …`, when the comparison period has fewer than 5 rows.

**Subtitles and exports** also name the period. The page subtitle reads e.g. "… · median days · embarked: Last 12 months". The PDF subtitle reads e.g. "Embarked: 2025 · Median · Alpha Tankers".

---

## 5. KPI tiles and change arrows

Each tile shows:
- a label and an icon;
- a large value: 30 px, tabular numbers;
- **the change against the comparison period** on its own line under the value;
- a sub-line;
- on some tiles, a status chip.

Port `_anDelta`, `timeSummary`, `kpis` and `decKpis`.

**How the change is written:**
- An arrow icon (`mdi-arrow-up` / `mdi-arrow-down`) followed by the absolute change, formatted in the tile's unit:
  - days to 1 decimal: `3.5 d`;
  - percentage points: `9 pts` (`1 pt` when it is 1);
  - counts: `11 RFEs`;
  - ratio: `0.4`.
- When the formatted change is 0, write `No change`, with `mdi-minus`, in grey.
- **Colour depends on whether the change is good:**
  - green (`success`) = better;
  - red (`error`) = worse;
  - grey = neutral.

  The icon and the words carry the meaning too, so colour is never the only signal.
- Show no arrow when there is no comparison period, or when it has fewer than 5 rows.

**Time tab tiles:**

| Tile | Value | Better when |
|---|---|---|
| {Median\|Average} start to embarkation time | stat of `totalDays` | lower |
| Within target | share with total ≤ sum of the step targets. Chip: ≥ 80% *On track* (success), ≥ 60% *Watch* (warning), otherwise *Below 60%* (error). | higher |
| Completed RFEs | count | neutral |
| Slowest step | the step with the highest stat. The change compares **the same step**. | lower |
| Most over target | the step with the highest stat ÷ target. Chip *Over target* when > 100%, otherwise *All within*. | lower |
| Rework rate | share with loops > 0. The sub-line gives the count and the stat of the rework days. | lower |

**Refusals tab tiles:**

| Tile | Value | Better when |
|---|---|---|
| Seafarer refusal rate | refused ÷ asked | lower |
| No answer | noAnswer ÷ asked | lower |
| Principal rejection rate | rejected ÷ sent. The sub-line says how many were not favored ("not counted"). | lower |
| Asked per filled RFE | asked ÷ approved, 1 decimal | lower |
| Top refusal reason | the share of the most frequent reason. The change compares that same reason's share. | neutral |
| Top rejection reason | as above | neutral |

**Definitions:**
- **asked** = every decision row;
- **sent** = rejected + approved + notFavored.

---

## 6. Time tab, panel by panel

If the period and filters match no completed RFEs, replace the whole tab (except In-flight) with one empty panel: "No completed RFEs match these filters."

### 6.1 Step colours

These are fixed per step and come from the Atlantis Gantt.

| Step | Short label (legend) | Fill | Text inside | Darker line | Special |
|---|---|---|---|---|---|
| s1 | Start search | `#BDBDBD` | `#212121` | `#9E9E9E` | |
| s2 | Search | hatch | `#1A3A66` | `#7FA6D9` | **Atlantis search stripes** |
| s3 | Seafarer Acceptance | `#4F7DBF` | white | | |
| s4 | To principal | `#1565C0` | white | | |
| s5 | On Approval | hatch | `#1A3A66` | `#7E57C2` | **Stripes + 5 px purple `#7E57C2` strip along the bottom** |
| s6 | Preparation | `#8FC48A` | `#1B3A17` | | |
| s7 | Ready To Embark | `#3D8B47` | white | | |

- **Hatch:** the Atlantis Gantt CSS is `repeating-linear-gradient(135deg, #DCE8F7 0 7px, #A9C5EA 7px 9px)`. ECharts can't use CSS gradients. The mockup draws the striped segments with a **custom series under the bars** (`_hatch` in `leadOption`, shapes from `_anHatchShapes()`): a `#DCE8F7` rectangle plus 45° `#A9C5EA` lines, 2.6 px wide and every 13 px, cut at the segment's edges. The s2 and s5 bars themselves are transparent, so they still carry the label, the white border and the tooltip.
  - **Don't use an ECharts image pattern** (`{ image, repeat }`) for this. In one user's browser the pattern was drawn transparent, although it rendered in headless Edge.
- **Purple strip on s5:** drawn with a `custom` series of rectangles over the s5 segment. See the `_approvalStrip` series in `leadOption`.
- **Legend:** an HTML legend above the chart (not the ECharts legend), with 30 × 14 swatches. The stripes and the strip use the Gantt CSS classes `atl-bar--search` and `atl-bar--approval`, so the legend looks exactly like Atlantis.

### 6.2 Start to Embarkation Time by step

Port `groupStats`, `leadOption`, `leadRows` and `onBarClick`.

**Bars:**
- One horizontal bar per Compare-by group, **slowest first**.
- 7 stacked segments, one per step: the step's median or average.
- The bar is 22 px thick, with a 1 px white border between segments.
- The last segment has rounded right corners.

**Labels:**
- Each segment shows its value inside it, hidden when the segment is shorter than 6.5% of the axis maximum.
- The total sits at the tip of the bar (`33.4 d`). A group with **fewer than 5 RFEs** gets `· low sample` after the total, drawn at 35% opacity, with a grey axis label.
- The y-axis label is `Name  (n=37)`.

**Target line:** a dashed vertical line at the **sum of the step targets**, labelled `Target 38 d`. The x-axis maximum must always include it.

**Tooltip** (axis trigger, shadow pointer), which lists:
- each step with its swatch and value;
- then the sum of the step stats, the start-to-embarkation stat measured per RFE, and the share within target.

**Table view:** an AtlTable with the columns:
- the group;
- RFEs;
- s1 … s7;
- the start-to-embarkation stat;
- Within target;
- Rework rate.

**Click a bar to drill down.** The page sets the filter to the clicked group, then moves Compare by to the next level:

| Compare by | Becomes |
|---|---|
| group | user |
| client | user |
| user | pool |
| rank | pool |
| vessel type | rank |
| pool | client |

Clicking does nothing when Compare by is "All RFEs".

**Footnote:**
- In median mode: the bar length is the sum of the step medians, so it differs from the median per RFE.
- In average mode: the sum equals the average of the final pass.
- Both: low-sample groups are greyed out.

### 6.3 Spread per step (box plot)

Port `boxOption`.

- **One box per step:** quartiles Q1 to Q3, with the median line inside.
  - Fill: the step colour at 33% alpha.
  - Border: the step's darker line, 1.5 px.
- **Whiskers:** the furthest values within 1.5 × IQR (the box length) of the box. Values beyond them are grey outlier dots.
- **Target:** a dark ◆ (`z: 5`, so it stays on top).
- **In Average mode:** add a white circle with an orange `#E07A35` border, 2.5 px, at the average.
- **Legend:** `Middle 50% · usual range`, (`Average`), `Outlier`, `Target`.
- **Box tooltip:** median, average, middle 50%, usual range and target.

### 6.4 Rework

This is a `v-table`, sorted by rework rate, with one row per Compare-by group:
- RFEs;
- back to search;
- rework rate as a meter bar plus a %;
- days lost (the stat of `reworkDays`, or — when none).

### 6.5 Monthly trend per step

Port `trendOptions`.

- **7 small multiples** in a grid with a minimum column width of 260 px. Each is 130 px high.
- **Header:** swatch, step label and `target N d`.
- **Line:** 2 px in the step's darker colour; gaps are connected; the latest value is labelled at the end.
- A dashed line marks the target.
- **x-axis:** the trend months from §4, labelled `Mon 'YY`, about 4 labels shown.

### 6.6 In-flight RFEs

Port `flightRows` and `flightColumns`. The data comes from `GET in-flight`.

**Columns:** Request, Rank, Principal, Vessel, User, Group, Current stage, Days in stage, Target (d), Typical (median d), Status.

Request and Rank are always shown. **Hidden at first** (via the column chooser): Group and Typical.

**Status chip:**
- **Over target** (error): days in stage are above the step target.
- **Slower than usual** (warning): days in stage are above 1.5 × typical.
- **On track** (success): neither.

Sort by status, worst first, then by days, longest first.

When the range is not live (§4), show the note: "As of today — this list does not follow the selected period (2025)."

---

## 7. Refusals & rejections tab, panel by panel

Port the "Refusals & rejections tab" block of `OpsAnalytics.js`:
- `decisions`, `_decCounts`, `reasonStats` and `reasonOption`;
- `lostByReason` and `lostOption`;
- `decGroups` and `heatStyle`;
- `decTrendOptions`, `caseRows` and `caseColumns`.

**Colours:** refusals use `#1565C0`, rejections `#7E57C2` and no answer `#757575`. There is one hue per side, so the reasons are not given different colours.

| Panel | Specification |
|---|---|
| **Why seafarers refuse** / **Why principals reject** | Side by side: two columns of at least 440 px each, otherwise one column. Sorted horizontal bars (18 px), most frequent first, labelled `count · share`. The height grows with the number of reasons (34 px per bar + 50). Tooltip: count, share, time lost, "Click to list the cases". **Click a bar** to set `selReason` and smooth-scroll to Cases. If a side has nothing, show "No refusals in this period." (or "No rejections …"). |
| **Time lost per reason** | One chart covering both sides, sorted by days. Bars are coloured by side, with a legend for the two sides. The label is `+4.2 d`. Reasons with fewer than 3 cases are left out. For a refusal: stat(s2 + s3) of RFEs with that reason − stat(s2 + s3) of RFEs without any refusal, floored at 0. For a rejection: stat(reworkDays) of RFEs with that reason. |
| **Reasons by {group}** | Has its own Compare-by select (the same state as on the Time tab) and a switch: *Seafarer refusals* / *Principal rejections*. Columns: group, Asked (or Sent), rate with (n), then one column per reason that occurs, showing its share **within the group's refusals or rejections**. Cell shading uses the side's hue with `alpha = 0.06 + share × 0.94`; text turns white above 45%. Rows are sorted by rate. Groups with < 5 cases are dimmed and marked `· low sample`. The table scrolls sideways on narrow screens. |
| **Monthly trend** | 3 small multiples: refusal, no-answer and rejection rate, with a % y-axis. **A month is skipped when its rate's own base has fewer than 5**: the base is asked for the first two rates and sent for the rejection rate. Expect the current, partial month to be noisy. |
| **Cases** | An AtlTable listing every refused, no-answer and rejected decision in scope, newest first. Columns: Date, Request, Seafarer, Outcome (chip with icon), Reason, Note, Pool, Rank, Principal, Vessel, User. Date and Request are always shown; hidden at first: Seafarer, Note. When `selReason` is set, show a closable chip in the panel header (e.g. "Seafarer refused: Salary / terms"). When it isn't, show a "Show no answers" button, which sets `selReason = { kind: 'noAnswer' }`. The PDF subtitle includes the chosen reason. |

---

## 8. Targets dialog

The **Targets** button appears only on the Time tab and only for management (see the permissions question in the backend brief).

The dialog has:
- one row per step: swatch, label and a number field (days, step 0.5, ≥ 0);
- the total shown live: "Start to embarkation target";
- **Reset** (to the defaults 1 / 10 / 3 / 2 / 5 / 14 / 3), **Cancel** and **Save**. Save calls `PUT targets`.

Saving updates every chart, target line and tile at once.

---

## 9. Screens that record the data

These belong to other pages, but the analytics depend on them.

**Internal RFAs view (Operations):** once a seafarer has been asked, the candidate row offers:
- **Accepted**;
- a **"Refused — reason…" select** (seafarer refusal list), which records the refusal as soon as a reason is picked;
- a **No answer** button.

The candidate's badge then reads:
- `✕ Refused · Salary / terms`;
- `No answer`;
- `✕ Rejected · Age`, for a rejection by the principal;
- `Not favored by principal`.

**Client UI, Pending Approvals (principal):**
- **Approve:** the principal approves one candidate. The other candidates on approval become *not favored* automatically, and no reason is asked.
- **Reject all:** opens a dialog with **one reason select per candidate**, plus an optional note per candidate:
  - an optional "same reason for all" select at the top fills every row;
  - the confirm button is disabled until every candidate has a reason;
  - a note is required when the reason is *Other*.
- **Decision history** lists each candidate's reason.

---

## 10. Look, layout and accessibility

**Atlantis look:**
- Vuetify theme `atlantis` and Inter;
- white panels with a 1 px border, 8 px radius;
- blue section titles;
- ink colours: primary `#212121`, secondary `#616161`, muted `#9E9E9E`;
- chart grid lines `#EEEEEE`, axes `#BDBDBD`.

Text in charts always uses these ink colours, never the series colour.

**Layout:**
- Filter row: one wrapping row. Each select is 130–220 px wide, period 170–200 px, months up to 150 px. Below 700 px every select takes the full width.
- Tiles: `repeat(auto-fill, minmax(165px, 1fr))`.
- Two-column panels: `minmax(440px, 1fr)`.
- Small multiples: `minmax(260px, 1fr)`.
- **At phone width (390 px) there must be no sideways page scroll.** AtlTable shows cards on phones.

**Charts:**
- Every chart has a tooltip.
- The step bars have a table view.
- Low-sample groups are marked with text as well as by greying.
- Status chips always have an icon and a word.

**Exports:**
- AtlTable exports **PDF and Excel** of the visible columns.
- The title is the panel title; the subtitle is the period, statistic and active filters (`pdfSubtitle`).
- The page itself has no export.

---

## 11. Acceptance checklist

Compare against the mockup with the same made-up data, or against the real data with a known answer.

- [ ] Every period choice gives the right `[from, to)`, comparison caption (in both comparison modes), trend months and subtitle. Custom: From/To swap correctly, and no month before `dataStart` is offered.
- [ ] Tile arrows: green = better, red = worse, grey = neutral. "No change" appears when the formatted change is 0. No arrows when there is no comparison.
- [ ] Median ⇄ Average and Compare by change everything **without** new requests.
- [ ] The step bars look exactly like the mockup:
  - colours, stripes and the purple strip;
  - labels hidden on short segments;
  - target line, totals, low-sample greying;
  - the table view matches the chart.
- [ ] Drill-down follows the map in §6.2.
- [ ] Box plot: whiskers at 1.5 × IQR, outliers, ◆ target on top, the average circle only in Average mode.
- [ ] In-flight: the status rules work, the pool and period filters are ignored, and the "as of today" note appears for past periods.
- [ ] Rejection rate excludes not-favored candidates from the numerator. No answer is never counted as a refusal.
- [ ] Clicking a reason bar narrows Cases and scrolls to it. The chip clears the selection. "Show no answers" works.
- [ ] Heat table: shares add up to 100% per row (rounding aside); dark cells have white text.
- [ ] Trend months under the base of 5 are skipped.
- [ ] Targets: Save updates the page and persists; Reset restores the defaults; only management sees the button.
- [ ] Loading, empty and error states, and stale responses never overwrite newer ones.
- [ ] Phone width: no sideways scroll; tables show as cards; charts resize when the window or sidebar changes.
- [ ] PDF and Excel exports contain the visible columns and the filter subtitle.
