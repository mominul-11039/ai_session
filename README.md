# ai_session

Planning site for the AI Infra Engineer program. Static pages, deployed to
GitHub Pages by `.github/workflows/static.yml` on every push to `main`.

| Page | What it is |
|---|---|
| [`index.html`](index.html) | The AI-Infra Roadmap — 35 topics and 4 open discussions across 17 days |
| [`sessions.html`](sessions.html) | Session planner — AI Infra and AI tracks, read from the Sheet |
| [`apps-script.gs`](apps-script.gs) | Backend to paste into the Google Sheet |
| [`sessions.csv`](sessions.csv) | Starting data — upload this to Drive to create the Sheet |

## Where the session data lives

The roadmap is hard-coded in `index.html`. The **sessions are stored in a Google
Sheet**, so the schedule is shared by everyone who opens the site and changing it
needs no git push.

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

The sidebar always shows the current state:

| Badge | Meaning |
|---|---|
| 🟢 *Google Sheet · Synced HH:MM* | Read and write, working |
| 🟠 *Sheet — read only* | Reading the Sheet; page edits stay in this browser |
| 🔴 *Sheet unreachable* | Could not read the Sheet; showing the last known data |
| ⚪ *Local only* | No Sheet configured |

## Sheet columns

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
