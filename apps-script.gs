/**
 * Backend for the AI Infra session planner.
 *
 * Paste this into the Google Sheet that holds the sessions:
 *   Extensions → Apps Script → replace everything → Save → Deploy.
 * Full setup steps are in README.md.
 *
 * GET  /exec  → { ok: true, sessions: [...] }
 * POST /exec  → replaces the sheet contents with the posted sessions array
 */

const SHEET_NAME = 'Sessions';
const HEADERS = ['id', 'track', 'title', 'date', 'start', 'duration',
                 'host', 'mode', 'location', 'status', 'tags', 'agenda'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Prefer a tab called "Sessions". If there isn't one, fall back to the first
  // tab rather than creating an empty one and silently ignoring real data.
  const named = ss.getSheetByName(SHEET_NAME);
  if (named) return named;
  const first = ss.getSheets()[0];
  if (first) return first;
  const created = ss.insertSheet(SHEET_NAME);
  created.appendRow(HEADERS);
  return created;
}

function json_(payload, callback) {
  // The page reads via a <script> tag, so when it passes ?callback=… the reply
  // has to be JavaScript that calls it. Plain JSON otherwise.
  if (callback && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Dates can come back as Date objects — the page expects YYYY-MM-DD strings. */
function asDateString_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '').trim();
}

/** Times can come back as Date objects too — the page expects HH:mm. */
function asTimeString_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(v || '').trim();
}

function doGet(e) {
  const cb = e && e.parameter ? e.parameter.callback : null;
  try {
    const values = sheet_().getDataRange().getValues();
    if (values.length < 2) return json_({ ok: true, sessions: [] }, cb);

    const head = values[0].map(String);
    const sessions = values.slice(1)
      .filter(row => String(row[head.indexOf('id')] || '').trim() !== '')
      .map(row => {
        const get = name => row[head.indexOf(name)];
        return {
          id: String(get('id')),
          track: String(get('track') || 'infra').trim(),
          title: String(get('title') || '').trim(),
          date: asDateString_(get('date')),
          start: asTimeString_(get('start')),
          duration: Number(get('duration')) || 60,
          host: String(get('host') || '').trim(),
          mode: String(get('mode') || 'onsite').trim(),
          location: String(get('location') || '').trim(),
          status: String(get('status') || 'planned').trim(),
          tags: String(get('tags') || '').split(',').map(s => s.trim()).filter(String),
          agenda: String(get('agenda') || '').split('\n').map(s => s.trim()).filter(String),
        };
      });

    return json_({ ok: true, sessions: sessions }, cb);
  } catch (err) {
    return json_({ ok: false, error: String(err) }, cb);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const list = Array.isArray(body.sessions) ? body.sessions : [];

    const rows = list.map(s => [
      String(s.id || ''),
      String(s.track || 'infra'),
      String(s.title || ''),
      String(s.date || ''),
      String(s.start || ''),
      Number(s.duration) || 60,
      String(s.host || ''),
      String(s.mode || 'onsite'),
      String(s.location || ''),
      String(s.status || 'planned'),
      (s.tags || []).join(', '),
      (s.agenda || []).join('\n'),
    ]);

    const sh = sheet_();
    sh.clear();
    sh.appendRow(HEADERS);
    if (rows.length) {
      sh.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    }
    // Keep dates and times as plain text so they round-trip unchanged
    sh.getRange(1, 4, sh.getMaxRows(), 2).setNumberFormat('@');

    return json_({ ok: true, count: rows.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
