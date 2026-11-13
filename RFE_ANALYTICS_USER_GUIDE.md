# RFE Pipeline Analytics — user guide

This page shows how long it takes to fill a Request For Embarkation (RFE), from the day it is created until the seafarer embarks. It also shows where the time goes, and why seafarers refuse offers and principals reject candidates.

The page is for two groups of people:

- **Operations**, to follow their own work and spot requests that are stuck;
- **Management**, to follow the Operations department and set targets.

You'll find it in the internal ERP under **Operations → RFE Analytics**.

---

## Contents

1. [The steps of an RFE](#1-the-steps-of-an-rfe)
2. [Choosing what you look at](#2-choosing-what-you-look-at)
3. [The Time tab](#3-the-time-tab)
4. [The Refusals & rejections tab](#4-the-refusals--rejections-tab)
5. [Recording refusals and rejections](#5-recording-refusals-and-rejections)
6. [Targets (management)](#6-targets-management)
7. [Exporting](#7-exporting)
8. [Questions and answers](#8-questions-and-answers)
9. [Glossary](#9-glossary)

---

## 1. The steps of an RFE

Every RFE goes through the same 7 steps. The page always uses the same colours for them, the same as in Atlantis:

| Step | From → to | What happens | Colour |
|---|---|---|---|
| **Start search** | Created → Pool Search | The request waits for the search to start | Grey |
| **Search** | Pool Search → Ask for Acceptance | Operations look for a suitable seafarer | Light blue stripes |
| **Seafarer Acceptance** | Ask for Acceptance → Accepted | The seafarer is asked and answers | Mid blue |
| **To principal** | Accepted → Principal Approval | The candidates are sent to the principal | Dark blue |
| **On Approval** | Principal Approval → Preparation | The principal decides | Light blue stripes with a purple line underneath |
| **Preparation** | Preparation → Ready | Documents, travel and the other preparation tasks | Light green |
| **Ready To Embark** | Ready → Embarked | Everything is ready; waiting for the joining date | Dark green |

**When the principal rejects all candidates**, the request goes back to Search and the search starts again. The page counts the days of the steps only from the **last** search onwards. The days lost before it are shown separately as **rework**.

---

## 2. Choosing what you look at

### Tabs

- **Time:** how long RFEs take, and which requests are stuck now.
- **Refusals & rejections:** why seafarers say no and why principals reject candidates.

### Filters

The filter row applies to the whole page. Leave a filter empty to include everything.

| Filter | Shows only… |
|---|---|
| **Embarked** (Time tab) / **Decided** (Refusals tab) | the period, see below |
| **Principal** | one principal's RFEs |
| **Vessel type** | one vessel type |
| **Rank** | one rank |
| **Seafarer pool** | *Dedicated to client*, *Ex-crew (not dedicated)* or *New candidate* |
| **User group** | one Operations group, e.g. *Crossworld* or *Creworld* |
| **User** | one Operations user's RFEs |

**Clear (n)** removes all the filters at once.

### The period

On the **Time** tab, an RFE belongs to the period in which the seafarer **embarked**. On the **Refusals & rejections** tab, a refusal or rejection belongs to the period in which it was **decided**.

| Choice | Covers |
|---|---|
| Last 3 / 6 / 12 months | up to today |
| This year | from 1 January to today |
| Last year | the whole previous calendar year |
| Custom range… | the whole months you pick in **From** and **To** |

### The comparison

Under the filters, a line such as *"Compared with the previous 12 months (13 Nov 2024 – 13 Nov 2025)"* says what the arrows on the tiles compare with. The switch at the end of that line chooses between:

- **Previous period:** the same length of time just before. August–September is compared with June–July.
- **Same period last year:** the same dates a year earlier. August–September 2026 is compared with August–September 2025. This is useful for work that changes with the season.

**Reading the arrows:**

- **↓ 3.5 d** in **green** means it got better, e.g. faster.
- **↑ 3 pts** in **red** means it got worse, e.g. the rejection rate went up 3 percentage points.
- **Grey** arrows are for numbers that are neither good nor bad, such as the number of completed RFEs.
- **No change** means the difference is too small to show.

If there is no earlier data, or too little of it, the line says so and the tiles show no arrows.

### Median or Average

The **Median / Average** switch at the top right changes every figure on the page.

- **Median** (the default) is the middle value: half the RFEs took less, half took more. One very slow RFE barely moves it, so it shows what is **usual**.
- **Average** adds up all the days and divides by the number of RFEs. A few very slow RFEs pull it up, so it shows the **total load**, including the problem cases.

If the average is much higher than the median, a few RFEs are taking far longer than the rest.

---

## 3. The Time tab

### Tiles

| Tile | What it tells you |
|---|---|
| **Median (or Average) start to embarkation time** | Days from creating the RFE to embarkation |
| **Within target** | Share of RFEs completed within the total target, which is the sum of the step targets. The label reads *On track* at 80% or more, *Watch* at 60–79%, *Below 60%* under 60%. |
| **Completed RFEs** | How many seafarers embarked in the period |
| **Slowest step** | The step that takes the most days |
| **Most over target** | The step furthest above its own target, as a % of the target. The label reads *Over target* or *All within*. |
| **Rework rate** | Share of RFEs sent back to search after a principal rejection, and the days each one lost |

### Start to Embarkation Time by step

Each bar is one group: a principal, rank, user and so on, chosen with **Compare by**. The bar is split into the 7 coloured steps, and the number inside each piece is its days. The slowest group is at the top.

- **The dashed line** is the total target. Bars that pass it are over target.
- **The number at the end of a bar** is the total. **(n=…)** next to the name is the number of RFEs.
- **Pale bars marked "low sample"** have fewer than 5 RFEs, so treat them with care.
- **Hover** over a bar to see every step and the share within target.
- **Click a bar** to look inside that group. The page filters to it and moves one level down. For example, click a principal to see that principal's users, then click a user to see their seafarer pools.
- **Table** shows the same figures as a table you can export.

**Example:** if Pacific Logistics has a much longer purple-striped **On Approval** piece than the others, that principal takes longer to decide. That isn't an Operations delay.

### Spread per step

This chart shows how much each step varies from one RFE to another.

- **The box** holds the middle half of the RFEs. The line inside it is the median.
- **The whiskers** (thin lines) show the usual range.
- **The dots** are unusual cases, far slower than normal.
- **◆** is the step's target.
- In **Average** mode, an orange circle marks the average.

A long box or many dots means the step is unpredictable, even if its median looks fine.

### Rework

For each group, this table shows how many RFEs went back to search after a principal rejection, the rework rate, and the days lost.

### Monthly trend per step

There is one small chart per step, showing the days for each month. The dashed line is the step's target. Use it to see whether a step is getting faster or slower.

### In-flight RFEs

These are the requests **open right now**, not yet embarked. For each one you'll see:

- its current stage;
- how many days it has been in that stage;
- the stage's target;
- the typical time for that stage.

The **Status** column flags each request:

- **Over target** (red): longer than the target.
- **Slower than usual** (amber): within target, but more than 1.5 × the typical time.
- **On track** (green): neither.

The worst cases are listed first. This list always shows **today's** situation. The period filter and the Seafarer pool filter don't affect it.

---

## 4. The Refusals & rejections tab

### Tiles

| Tile | Meaning |
|---|---|
| **Seafarer refusal rate** | Of the seafarers asked, the share who said no |
| **No answer** | Of the seafarers asked, the share who didn't answer in time. Counted separately from refusals. |
| **Principal rejection rate** | Of the candidates sent to the principal, the share rejected |
| **Asked per filled RFE** | How many seafarers are asked, on average, for each one finally approved |
| **Top refusal reason** / **Top rejection reason** | The most common reason, and its share |

**Not favored is not a rejection.** When a principal approves one candidate, the other candidates sent with it are marked **"Not favored"**. They don't count as rejections and have no reason.

### Why seafarers refuse / Why principals reject

These charts show each reason with its number of cases and its share. **Click a bar** to list those cases in the **Cases** table at the bottom of the page.

### Time lost per reason

This chart shows how many extra days each reason costs:

- **For a refusal:** how much longer search and acceptance took, compared with RFEs that had no refusal.
- **For a rejection:** the days lost before the search started again.

Reasons with fewer than 3 cases are left out.

### Reasons by group

This table has one row per group (chosen with **Compare by**) and one column per reason. The switch chooses between **Seafarer refusals** and **Principal rejections**.

- Each row starts with the group's rate, then shows the share of each reason. **Darker cells mean a larger share.**
- Rows marked **low sample** have fewer than 5 cases.

**Example:** a principal row that is dark under *Not enough experience on the vessel type* tells you to propose candidates with more experience on that vessel type.

### Monthly trend

Three small charts show the refusal, no-answer and rejection rates by month. A month with too few cases is skipped. The current month is still running, so its value can jump around.

### Cases

Every refusal, no answer and rejection in the period, newest first, with the reason, any note, the seafarer, rank, principal, vessel and user.

- Click a reason bar above to show only that reason. A chip at the top shows the choice; click its **✕** to show all cases again.
- **Show no answers** lists only the seafarers who didn't answer.

---

## 5. Recording refusals and rejections

The statistics are only as good as what is recorded.

### Operations: in RFAs

When you have asked a seafarer, record the answer on the candidate's row:

- **Accepted**;
- **Refused**: choose the reason from the list. Pick the closest reason, and use *Other* only when nothing fits;
- **No answer**: when the seafarer didn't reply in time.

The candidate then shows a badge such as *"✕ Refused · Salary / terms"* or *"No answer"*. When the principal decides, you'll also see *"✕ Rejected · …"* or *"Not favored by principal"*.

### Principals: in the Client UI (Pending Approvals)

- **Approve** one candidate. The others are marked *not favored* automatically, and the principal is not asked for a reason.
- **Reject all:** the principal must give **one reason per candidate**. They can use *"Same reason for all"* to fill every row at once. A short note is required when the reason is *Other*.

---

## 6. Targets (management)

**Targets** (top right, on the Time tab) sets the target days for each step. The total target is the sum of the steps and appears as you type.

- **Save** applies the targets everywhere at once: the dashed lines, ◆ markers, tiles and In-flight statuses.
- **Reset** restores the default values.

The targets are the same for every principal.

---

## 7. Exporting

Every table offers **Export PDF** and **Export Excel**. These are the step-bars table (Chart → **Table**), **In-flight RFEs** and **Cases**.

- The export contains the columns currently shown. Use **Columns** to add or remove them first.
- The file notes the period, the Median/Average setting and the filters in use.

---

## 8. Questions and answers

**Why don't the step numbers add up to the median start-to-embarkation time?**
Each median is worked out on its own. The median of each step and the median of the totals come from different RFEs, so they don't add up. In **Average** mode they do add up (for the final pass).

**Why is a group pale or marked "low sample"?**
It has fewer than 5 RFEs or cases. One unusual case can swing its figures, so don't draw conclusions from it alone.

**I chose "Last year". Why do In-flight RFEs still show current requests?**
That list always shows the requests open today, whatever period is selected. A note under its title reminds you.

**Why does the current month look strange in the trends?**
The month isn't over yet, so it includes only a few cases.

**Why can't I pick older months in Custom range?**
The page offers only the months for which data exists.

**Does Seafarer pool mean the same thing on both tabs?**
- On the **Time** tab, it is the pool of the seafarer who finally **embarked**.
- On the **Refusals & rejections** tab, it is the pool of **each candidate** who was asked or proposed.

---

## 9. Glossary

| Term | Meaning |
|---|---|
| **RFE** | Request For Embarkation: a request to fill a position on a vessel |
| **Principal** | The client (ship owner or manager) who approves the candidates |
| **Seafarer pool** | *Dedicated to client*: works only for this principal. *Ex-crew (not dedicated)*: has sailed with us before. *New candidate*: never sailed with us. |
| **Final pass** | The last search → approval cycle, which ended in an approval |
| **Rework** | Days lost to search cycles that the principal rejected |
| **Not favored** | A candidate sent to the principal who wasn't chosen because another candidate was approved. Not a rejection. |
| **No answer** | The seafarer didn't reply in time. Counted separately from refusals. |
| **pts** | Percentage points: the difference between two percentages, e.g. 14% → 17% is +3 pts |
| **Median** | The middle value: half are lower, half are higher |
| **Low sample** | Fewer than 5 RFEs or cases |
