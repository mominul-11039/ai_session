# ai_session

Planning site for the AI Infra Engineer program. Static pages, deployed to
GitHub Pages by `.github/workflows/static.yml` on every push to `main`.

| Page | What it is |
|---|---|
| [`index.html`](index.html) | The AI-Infra Roadmap — 35 topics and 4 open discussions across 17 days |
| [`sessions.html`](sessions.html) | Session planner — AI Infra and AI tracks, read from the Sheet |
| [`apps-script.gs`](apps-script.gs) | Backend to paste into the Google Sheet |
| [`sessions.csv`](sessions.csv) | Starting data — upload this to Drive to create the `Sessions` tab |
| [`homework.html`](homework.html) | Homework — assignments per plan day, read from `homework.csv` |
| [`shared.js`](shared.js) | Plan calendar + CSV / Google Sheet loader used by `index.html` and `homework.html` |
| [`progress.csv`](progress.csv) | Topic completion for the roadmap — **read directly by `index.html`** |
| [`homework.csv`](homework.csv) | Homework list — **read directly by `homework.html`** |

## Where the data lives

| Page | Source constant | Default |
|---|---|---|
| `index.html` (roadmap progress) | `PROGRESS_SOURCE` | Google Sheet `1W1hQSfr…` (first tab) |
| `homework.html` | `HOMEWORK_SOURCE` | Google Sheet `1sFsFX-T…` (first tab) |
| `sessions.html` | `SHEET_ID` / `SHEET_ENDPOINT` | Google Sheet, `Sessions` tab |

The roadmap *content* (topics, tasks, resources) is still hard-coded in
`index.html`; only completion status comes from `progress.csv`.

Edit the CSV, push, reload — the page reflects it. Each page caches the last
good read in the browser, so it still shows something if the source is down.

**Local preview:** `fetch()` can't read files from a `file://` page, so serve
the folder: `python3 -m http.server` → open `http://localhost:8000`.

### Moving a CSV to Google Drive later

A plain Drive file link (`drive.google.com/file/d/…`) does **not** work — Drive
sends no CORS header, so the browser blocks it. Use one of these instead and
set it as the source constant:

1. **Published CSV (simplest).** Upload the CSV, open it with Google Sheets,
   *File → Share → Publish to web* → pick the tab → **CSV** → copy the link:
   ```js
   const PROGRESS_SOURCE = 'https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?gid=0&single=true&output=csv';
   ```
   Google caches published output for a few minutes.
2. **Shared Sheet.** Share the Sheet as *anyone with the link can view* and use
   its id and tab name. Works even off `file://` and updates immediately:
   ```js
   const HOMEWORK_SOURCE = { sheetId: '1eAsfQmkfJoyx7cS9pznR2HbIvbo_QxwMvqudA2A5fCs', tab: 'Homework' };
   ```

Keep the same header row in Drive as in the CSV.

### `progress.csv`

| Column | Notes |
|---|---|
| `id` | Must match the roadmap id (`d01` … `d39`). Rows without one are skipped |
| `day`, `title` | For your reference only — the page uses its own |
| `status` | `planned`, `in-progress` or `done` |
| `note` | Optional. Shown on that topic's page |

### `homework.csv`

| Column | Notes |
|---|---|
| `id` | Any unique id, e.g. `hw01` |
| `day` | Optional plan day 1–17. Groups the homework; blank = *General* |
| `topic` | Optional topic name shown above the title |
| `title` | Homework title |
| `description` | Optional. `` `backticks` `` render as inline code |
| `date` | Optional `YYYY-MM-DD`, shown as-is (not a deadline). Blank = that day's plan date, if `day` is set |
| `link` | Optional `https://` link (submission form, repo, doc) |
| `note` | Optional, e.g. reviewer feedback |

`status` is matched loosely: `Done`, `Completed`, `Submitted`, `yes`, `✅` all
count as done; `WIP`, `doing`, `In Progress` count as in-progress. Anything
else reads as not started.

## Session planner — the `Sessions` tab

The **sessions are stored in the Sheet** too, so the schedule is shared by
everyone who opens the site and changing it needs no git push.

There are two levels of connection, set by two constants near the top of the
script in `sessions.html`:

| Constant | Gives you | Setup |
|---|---|---|
| `SHEET_ID` | **Read only.** Sheet edits appear on the site. Edits made *on the page* stay in that browser | None beyond link-sharing the Sheet — **already configured** |
| `SHEET_ENDPOINT` | **Read and write.** The page's edit / delete write back to the Sheet | Deploy `apps-script.gs`, steps below |

New sessions are always added **in the Sheet** — the page has no "add" button.
It can edit and delete existing ones.

`SHEET_ENDPOINT` wins when both are set. With neither, the page falls back to
each browser's own local storage.

Reading works everywhere, including when `sessions.html` is opened straight off
disk. It uses a JSONP `<script>` tag rather than `fetch()`, because `fetch` is
subject to CORS and Google sends no CORS header to the `null` origin a `file://`
page has. **Writing** still uses `fetch`, so it needs the page served over
http(s) — on `file://` the sidebar says *Serve over http:// to save edits*.

## Connecting the Google Sheet

Only the session planner needs the steps below. The roadmap's `Progress` tab is
read-only and works with `SHEET_ID` alone — no Apps Script, no deployment.

**1. Create the Sheet**

Upload [`sessions.csv`](sessions.csv) to Google Drive, then right-click it →
*Open with* → *Google Sheets*. Rename the tab at the bottom to **`Sessions`**.
It contains the 7 starting sessions.

In the import dialog, **untick "Convert text to numbers, dates and formulas"** —
otherwise Sheets reformats the `date` and `start` columns and the page can no
longer read them.

To replace the contents of a Sheet you already made: *File* → *Import* →
*Upload* → **Replace current sheet**. That keeps the same URL and sharing.

**2. Add the backend**

In that Sheet: *Extensions* → *Apps Script*. Delete the placeholder code, paste
everything from [`apps-script.gs`](apps-script.gs), and save.

**3. Deploy it**

*Deploy* → *New deployment* → gear icon → **Web app**, then set:

- **Execute as:** Me
- **Who has access:** Anyone

Click *Deploy*, approve the permission prompt, and copy the **Web app URL**. It
looks like `https://script.google.com/macros/s/AKfy…/exec`.

**4. Point the site at it**

In [`sessions.html`](sessions.html), paste the URL into `SHEET_ENDPOINT`:

```js
const SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfy…/exec';
```

Push once. From then on, every edit and delete writes to the Sheet — no
further pushes needed.

The sidebar of **both** pages always shows the current state:

| Badge | Meaning |
|---|---|
| 🟢 *Google Sheet · Synced HH:MM* | Reading the Sheet fine (and writing, on `sessions.html` with `SHEET_ENDPOINT` set) |
| 🟠 *Sheet — read only* | `sessions.html` only — reading the Sheet; page edits stay in this browser |
| 🔴 *Sheet unreachable* | Could not read the Sheet; showing the last known data |
| ⚪ *Local only* | No Sheet configured |

*Refresh* re-reads the Sheet without reloading the page.

## `Sessions` tab columns

| Column | Notes |
|---|---|
| `id` | Unique. Any string. Rows without one are skipped |
| `track` | `infra` or `ai` |
| `title` | Session name |
| `date` | `YYYY-MM-DD` |
| `start` | `HH:mm`, 24-hour |
| `duration` | Minutes — 30, 45, 60, 90, 120 or 180 |
| `host` | Free text |
| `mode` | `onsite`, `online` or `hybrid` |
| `location` | Room name, or a meeting URL |
| `status` | `planned`, `done` or `cancelled` |
| `tags` | Comma separated |
| `agenda` | One item per line inside the cell |

You can edit rows directly in the Sheet — the site picks the changes up on the
next load, or when you press *Refresh* in the sidebar.

## A note on access

There is no login. Once `SHEET_ENDPOINT` is set, anyone who can open the site
can edit and delete sessions, because the Apps Script URL sits in the page's
JavaScript. This is a deliberate trade for a static site with no server.

If you need edits restricted to specific people, the options are:

- **Set the deployment to "Only myself"** and edit exclusively in the Sheet —
  the site becomes read-only for everyone else. Google enforces this properly.
- **Add Google sign-in** (OAuth) so the browser writes as the signed-in user and
  the Sheet's own sharing settings decide who may write.

A passcode checked in JavaScript is not one of the options — anyone can read it
in the page source.

Roadmap progress does not have this problem: the site only ever reads the
`Progress` tab, so changing a status needs edit access to the Sheet itself,
which Google enforces.
