# RFE Pipeline Analytics — backend brief

This brief is for the developer who will write the endpoints behind the **RFE Pipeline Analytics** page of the internal ERP. It covers:

- what the page shows;
- what data it needs;
- what the application must start recording for that data to exist;
- a proposed set of endpoints.

The mockup is the reference. Endpoint names and shapes below are a proposal; change them to fit the real API conventions.

- **Live mockup:** https://alprinias.github.io/maritimeERP/#/operations/rfe-analytics (Operations → RFE Analytics in the sidebar)
- **Run locally:** open `index.html` in a browser. There is no build step.
- **Code to read:**

  | File | What is in it |
  |---|---|
  | `data/analytics.js` | Stages, steps, pools, users/groups, reason lists, the step-duration rule (`rfeStepDurations`), made-up history |
  | `views/OpsAnalytics.js` | Every calculation the page makes (filters, period, comparison, statistics, rates) |
  | `views/RFAs.js` | Where Operations record refusals / no answer and send candidates for approval; `principalApprove`, `principalRejectAll` |
  | `views/ClientApprovals.js` | Client UI: the principal approves one candidate or rejects all, with one reason per candidate |

---

## 1. What the page is for

There are two audiences:

- **Operations** use the page to check their own performance.
- **Management** use it to check the Operations department.

The page answers three questions:

1. **How long does it take from creating a Request For Embarkation (RFE) to the seafarer embarking, and which step is slow?** This is the **Time** tab.
2. **Why do seafarers refuse and why do principals reject candidates, and what does that cost in days?** This is the **Refusals & rejections** tab.
3. **Which open RFEs are stuck right now?** This is the **In-flight RFEs** table at the bottom of the Time tab.

One filter row applies to the whole page:

- period;
- principal;
- vessel type;
- rank;
- seafarer pool;
- user group;
- user.

The page also has three switches:

- **Statistic:** median (default) or average.
- **Compare by:** none, principal, rank, vessel type, seafarer pool, user or user group.
- **Targets:** days per step, set by management.

---

## 2. Concepts

### 2.1 Stages and stage events

An RFE moves through these stages:

| Stage id | Label | Entered when |
|---|---|---|
| `created` | Created | The RFE is created |
| `search` | Pool Search | The search for candidates starts. It is entered again when the principal rejects all candidates. |
| `ask` | Ask for Acceptance | The first candidate of this pass is asked |
| `accepted` | Accepted | A candidate accepts |
| `approval` | Principal Approval | Candidates are sent to the principal |
| `preparation` | Preparation | The principal approves a candidate |
| `ready` | Ready | All preparation tasks are complete |
| `embarked` | Embarked | The seafarer embarks |

**The backend must store every stage entry as an event: `{ rfeId, stage, at }`, where `at` is a UTC timestamp.** Store the history of entries, not only the current stage. A rejection loop produces a second `search`, `ask`, `accepted` and `approval` entry, and the page needs those.

### 2.2 Steps and the final-pass rule

The page measures 7 steps, each between two consecutive stages:

| Step | From → to | Label on the page |
|---|---|---|
| `s1` | created → search | Start search |
| `s2` | search → ask | Search |
| `s3` | ask → accepted | Seafarer Acceptance |
| `s4` | accepted → approval | To principal |
| `s5` | approval → preparation | On Approval |
| `s6` | preparation → ready | Preparation |
| `s7` | ready → embarked | Ready To Embark |

The measuring rules are:

- **`s1`** runs from `created` to the **first** `search` entry.
- **`s2`–`s7`** are measured on the **final pass**, which runs from the **last** `search` entry onwards. Within that pass, take the first entry of each stage.
- **Rework days** run from the first to the last `search` entry. This is the time lost to passes the principal rejected.
- **Loops** is the number of `search` entries minus 1.
- **Total (start to embarkation)** runs from `embarked` back to `created`.

Durations are in days, as decimals. The reference implementation is `rfeStepDurations()` in `data/analytics.js`. It returns `null` while the RFE is not complete; an RFE counts as completed only once it has an `embarked` event.

Step medians don't add up to the median total. The page says so in a footnote, so this isn't a bug.

### 2.3 Candidate decisions

Every candidate asked for acceptance on an RFE ends with one outcome:

| Outcome | Recorded by | Reason |
|---|---|---|
| `refused` | Operations (RFAs view), when the seafarer says no | **Required**, from the seafarer refusal list |
| `noAnswer` | Operations, when the seafarer did not answer in time | None. It is reported separately from refusals. |
| `accepted` | Operations | — (still waiting to be sent to the principal) |
| `onApproval` | Operations, by sending to the principal | — (waiting for the principal) |
| `approved` | Principal (Client UI) | — |
| `notFavored` | Automatic. When the principal approves one candidate, the **other** candidates on approval get this outcome. | None. **This is not a rejection.** |
| `rejected` | Principal, with "Reject all" | **Required, one reason per candidate**, from the principal rejection list. When N candidates are rejected, N reasons are stored. |

For each decision, store:

- the outcome;
- `reasonId` and an optional `note` (the note is required when the reason is `other`);
- `decidedAt`;
- the candidate's **pool at the time they were asked**: `dedicated` (dedicated to the principal), `excrew` (ex-crew, not dedicated) or `new` (new candidate).

The pool matters because the pool filter and grouping on the Refusals tab use the **candidate's** pool. They do not use the pool of the seafarer who finally embarked.

### 2.4 Reason lists (draft)

These lists are drafts that the stakeholders still need to agree. Store **ids** so that labels can be renamed later; the backend should serve the lists rather than hard-code them in the UI.

**Seafarer refusal:**

| id | Label |
|---|---|
| `salary` | Salary / terms |
| `vessel` | Vessel type or trading area |
| `contract` | Contract length / rotation |
| `availability` | Not available on the joining date |
| `family` | Family / personal |
| `health` | Health |
| `otherOffer` | Accepted another company's offer |
| `other` | Other |

**Principal rejection:**

| id | Label |
|---|---|
| `expRank` | Not enough experience in the rank |
| `expVessel` | Not enough experience on the vessel type |
| `performance` | Past performance / appraisal |
| `documents` | Certificates or documents |
| `age` | Age |
| `english` | English / communication |
| `crewMix` | Nationality / crew mix |
| `salary` | Salary expectation |
| `preferOther` | Prefers another candidate or former crew |
| `other` | Other |

### 2.5 Users and groups

Each RFE has a **handling Operations user**, and each user belongs to one **user group**. In the mockup the groups are *Crossworld* and *Creworld*. The mockup derives the handler from the principal, because there is no assignment yet. **The backend needs a real "handled by" user on the RFE.**

Decide whether the group is the user's group *now* or *at the time of the RFE*. This is an open question (§7).

---

## 3. What the application must record

Most of this does not exist today. The analytics page has nothing to read until it does.

1. **Stage events** on every transition (§2.1). The mockup already marks the transition points with a call to `logRfeStage(ref, stage)`:
   - sending candidates to the principal: `approval`;
   - the principal approving a candidate: `preparation`;
   - the principal rejecting all candidates: `search`.

   The remaining transitions (`created`, the first `search`, `ask`, `accepted`, `ready`, `embarked`) must be logged at the matching places.
2. **Candidate decisions** with the fields in §2.3.
3. **The handling user** on each RFE.
4. **The candidate's pool** when they are asked.
5. **Targets:** one number of days per step, editable by management.

### Write endpoints (recording)

| Method & path | Body | Effect |
|---|---|---|
| `POST /rfes/{rfeId}/candidates/{candId}/refusal` | `{ reasonId, note? }` | Outcome `refused`. `reasonId` is required; `note` is required when the reason is `other`. |
| `POST /rfes/{rfeId}/candidates/{candId}/no-answer` | — | Outcome `noAnswer` |
| `POST /rfes/{rfeId}/approval/approve` | `{ candidateId }` | The chosen candidate becomes `approved`. **Every other candidate on approval becomes `notFavored`.** Logs a `preparation` event. |
| `POST /rfes/{rfeId}/approval/reject-all` | `{ reasons: [{ candidateId, reasonId, note? }] }` | **There must be one entry for every candidate on approval**; return 400 otherwise. `note` is required for `other`. All of them become `rejected`, and a `search` event is logged (loop). |
| `PUT /rfe-analytics/targets` | `{ s1: 1, s2: 10, …, s7: 3 }` | Management only. Values are days, ≥ 0. |

Both approval endpoints are called from the **Client UI** by the principal, so they need the principal's authorisation. The refusal and no-answer endpoints are internal, for Operations.

---

## 4. Read endpoints for the page

### Approach

The server returns **fact rows**, filtered by period and filters, and **the browser aggregates them**. This is how the mockup works. With this approach:

- the median/average switch, Compare by, drill-down and clicks on reasons respond instantly, without another request;
- medians can't be pre-summed, so the server would otherwise need one query per combination of grouping and statistic;
- the volume is small: about 150–200 completed RFEs a year and about 3 candidate decisions per RFE. Three years of decisions is about 1,500 rows.

If volume grows a lot, the calculations in §5 can move to the server later without changing the page.

All read endpoints accept the same filter query parameters, and every one of them is optional:

```
from, to             UTC timestamps, from inclusive / to exclusive (omit "to" = up to now)
principalId, vesselType, rank, pool, userId, groupId
```

### 4.1 `GET /rfe-analytics/lookups`

This endpoint returns the filter options and the fixed lists. Call it once per page load.

```json
{
  "principals":  [{ "id": "c1", "name": "Alpha Tankers" }],
  "vesselTypes": ["Bulk Carrier", "Container", "Tanker"],
  "ranks":       ["Master", "Chief Officer", "..."],
  "pools":       [{ "id": "dedicated", "label": "Dedicated to client" }, { "id": "excrew", "label": "Ex-crew (not dedicated)" }, { "id": "new", "label": "New candidate" }],
  "groups":      [{ "id": "g1", "name": "Crossworld" }, { "id": "g2", "name": "Creworld" }],
  "users":       [{ "id": "u1", "name": "Eleni Markou", "groupId": "g1" }],
  "refusalReasons":   [{ "id": "salary", "label": "Salary / terms" }],
  "rejectionReasons": [{ "id": "expRank", "label": "Not enough experience in the rank" }],
  "targets":     { "s1": 1, "s2": 10, "s3": 3, "s4": 2, "s5": 5, "s6": 14, "s7": 3 },
  "dataStart":   "2023-12-01T00:00:00Z"
}
```

- **Ranks** must come in the crew rank order the ERP already uses.
- **`dataStart`** is the first full month for which events exist. The page doesn't offer custom months before it, and shows no comparison for earlier periods.

### 4.2 `GET /rfe-analytics/completed`

This endpoint returns completed RFEs whose **embarkation** falls in `[from, to)`. The Time tab reads them.

```json
[{
  "rfeId": "RFE-5012", "principalId": "c1", "vesselId": "v3", "vesselName": "Alpha Star", "vesselType": "Tanker",
  "rank": "Chief Officer", "pool": "dedicated", "userId": "u2", "groupId": "g1",
  "createdAt": "2026-03-02T09:14:00Z", "embarkedAt": "2026-04-11T06:00:00Z",
  "steps": { "s1": 0.8, "s2": 6.4, "s3": 2.1, "s4": 1.2, "s5": 3.9, "s6": 11.7, "s7": 2.6 },
  "totalDays": 40.0, "reworkDays": 0, "loops": 0
}]
```

- `pool` is the pool of the seafarer who **embarked**.
- The server should compute `steps`, `totalDays`, `reworkDays` and `loops` with the rule in §2.2, so there is one source of truth. The raw `events` array can be added as an optional field for debugging.

### 4.3 `GET /rfe-analytics/decisions`

This endpoint returns one row per candidate decision whose **decision date** falls in `[from, to)`. The Refusals & rejections tab reads them.

```json
[{
  "rfeId": "RFE-5039", "principalId": "c1", "vesselId": "v7", "vesselName": "Oceanic", "vesselType": "Bulk Carrier",
  "rank": "Able Seaman", "userId": "u1", "groupId": "g1",
  "candidateId": "s123", "candidateName": "…", "pool": "new",
  "outcome": "rejected", "reasonId": "expRank", "note": "", "decidedAt": "2026-09-28T10:02:00Z"
}]
```

- Include **open RFEs** as well as completed ones, because recent decisions belong to RFEs that haven't embarked yet.
- Include the `accepted` and `onApproval` rows (with `decidedAt` = when they accepted or were sent), because they count as "asked".
- `pool` is the **candidate's** pool (§2.3), and the `pool` filter applies to it.

### 4.4 `GET /rfe-analytics/in-flight`

This endpoint returns the open RFEs **as of now**. It ignores `from`/`to` and `pool`, and applies the other filters.

```json
{
  "typicalDays": { "s1": 1.0, "s2": 7.2, "s3": 2.0, "s4": 1.4, "s5": 4.1, "s6": 11.9, "s7": 3.0 },
  "rows": [{
    "rfeId": "RFE-4001", "kind": "rfe", "principalId": "c2", "vesselName": "Pacific Dawn", "vesselType": "Container",
    "rank": "Master", "userId": "u4", "groupId": "g2",
    "stage": "approval", "stageEnteredAt": "2026-11-02T08:30:00Z"
  }]
}
```

- **`typicalDays`** is the median of each step over the RFEs embarked in the **last 12 months**.
- **`stage`** is the current stage. The page turns it into the step being waited on: `created` waits on `s1`, `search` on `s2`, … `ready` on `s7`.
- **Status rules on the page:**
  - *Over target* when days in stage > the step target.
  - Otherwise *Slower than usual* when days in stage > 1.5 × `typicalDays`.
  - Otherwise *On track*.
- **`kind`** is `rfe` for an embarkation request or `rfr` for the RFE inside a replacement request. Both appear in the mockup.

### 4.5 Period and comparison: two calls per tab

The browser works out the selected period and the **comparison period**, then calls `completed` (or `decisions`) once for each. The user chooses the comparison: **Previous period** (the default) or **Same period last year**.

| Choice | Period | Previous period | Same period last year |
|---|---|---|---|
| Last 3 / 6 / 12 months | now − N × 30.44 days → now | the N months just before | the same dates one year earlier |
| This year | 1 Jan → now | the same number of days before 1 Jan | 1 Jan → today's date, last year |
| Last year | the previous calendar year | the year before that | the year before that |
| Custom range (From–To months) | first day of From → first day after To | the same number of months just before | the same months one year earlier |

Example: a custom range of Aug–Sep 2026 is compared either with Jun–Jul 2026 (previous period) or with Aug–Sep 2025 (same period last year).

When the selected period runs up to today, the "same period last year" comparison runs only up to **today's date last year**. For example, Oct 2026 – Nov 2026 viewed on 13 Nov 2026 is compared with 1 Oct – 13 Nov 2025. The comparison call therefore always sends an explicit `to`.

The tiles show the change against the comparison period. There is no comparison when the comparison period starts before `dataStart`, or has fewer than 5 records. "Same period last year" needs at least one year of history before the selected period. The server only needs to support `from`/`to`; it has no logic of its own for the comparison.

---

## 5. Calculations the page makes

This section is for information. The server does **not** need to implement these as long as it returns the fact rows above.

| Figure | Definition |
|---|---|
| Median / average | Linear-interpolated median (`_anQuantile(…, 0.5)`) or arithmetic mean, per step and for the total |
| Within target | Share of RFEs with total ≤ the sum of the step targets |
| Rework rate | Share of RFEs with loops > 0 |
| Spread (box plot) | Quartiles; whiskers = the furthest values within 1.5 × the interquartile range; points beyond = outliers |
| Asked | Every decision row |
| Sent | `rejected` + `approved` + `notFavored` |
| Refusal rate | refused ÷ asked |
| No-answer rate | noAnswer ÷ asked |
| Rejection rate | rejected ÷ sent (`notFavored` is in the denominator but is not a rejection) |
| Asked per filled RFE | asked ÷ approved |
| Time lost per refusal reason | stat(s2 + s3) of RFEs with that refusal − stat(s2 + s3) of RFEs without any refusal |
| Time lost per rejection reason | stat(reworkDays) of RFEs with that rejection |
| Low sample | A group with < 5 RFEs is greyed out; a trend month needs ≥ 5 in the rate's base |

"Time lost per reason" needs the search + acceptance days and the rework days of the RFE behind each decision. The proposal is that each `decisions` row carries `s2s3Days` and `reworkDays` (`null` while the RFE is open). The mockup reads them from its own history instead.

---

## 6. Conventions

- **Timestamps:** ISO 8601 in UTC. **Durations:** days, as decimals.
- **Month buckets:** the trend charts group by calendar month in UTC (a choice made by the mockup — see §7).
- **Filtering is server-side; grouping is client-side.** Every filter value is an id, apart from `vesselType` and `rank`, which are the plain values from the lookups.
- **Labels:** principal, vessel, user and group names come with the rows or from the lookups, so the page never needs extra calls to show a table.
- **Exports:** the page's PDF and Excel export works in the browser from the rows it already holds, so the server needs no export endpoint.

---

## 7. Open questions

1. **Reason lists:** the two lists in §2.4 are drafts and need agreeing with the stakeholders before go-live.
2. **Handling user:** where does "handled by" come from? Is it assigned per RFE, or derived from the principal? When a user changes group, do past RFEs move with them?
3. **Pool definition:** what makes a seafarer "dedicated to client" or "ex-crew", and is it decided at the time they are asked?
4. **No answer:** does Operations always record it by hand (as in the mockup), or should it also be set automatically after a deadline?
5. **Time zone:** should period boundaries and months be in UTC or in the company's time zone?
6. **Access:** does every Operations user see the whole department, or only their own group, with management seeing everything? Who can change targets? The mockup has no restrictions.
7. **Back-fill:** can stage events be rebuilt for past RFEs from existing records (audit log, status history)? If not, the page starts empty and fills as new RFEs complete. The comparison arrows appear once the comparison period is fully covered: after one period's length for "Previous period", and after a year for "Same period last year".
