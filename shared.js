// Shared by index.html and homework.html: the plan calendar and the data loader.

// ─── PLAN CALENDAR ──────────────────────────────────────────────────────────
const PLAN_START = new Date(2026, 7, 10); // month is 0-indexed: 7 = August
const HOLIDAYS = ['2026-08-26'];

// Local date parts — toISOString() converts to UTC first, which shifts the
// date backwards on UTC+ machines and skips the wrong day as a holiday.
function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6; }

/** Working days of the plan: index 0 = Day 1. Skips weekends and HOLIDAYS. */
function buildPlanDates(numDays) {
  const result = [];
  const cursor = new Date(PLAN_START);
  while (result.length < numDays) {
    if (!isWeekend(cursor) && !HOLIDAYS.includes(toISO(cursor))) result.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

// ─── DATA SOURCES ───────────────────────────────────────────────────────────
// A source is one of:
//
//   'progress.csv'                       a CSV next to the page (needs http://,
//                                        fetch() can't read files off file://)
//   'https://…/pub?output=csv'           any CSV URL that allows CORS, e.g. a
//                                        Google Sheet "Publish to web" → CSV link
//   { sheetId: '…', tab: 'Progress' }    a Google Sheet shared "anyone with the
//                                        link"; read via JSONP, works anywhere
//
// Every loader resolves to an array of plain objects keyed by the lower-cased
// header row, with all values as trimmed strings.

async function loadRows(source) {
  if (source && typeof source === 'object' && source.sheetId) return loadSheetRows(source);
  if (typeof source === 'string' && source) return loadCsvRows(source);
  throw new Error('No data source configured');
}

/** Human label for the sync indicator. */
function sourceLabel(source) {
  if (source && typeof source === 'object' && source.sheetId) return 'Google Sheet';
  if (/docs\.google\.com|drive\.google\.com/i.test(String(source))) return 'Google Drive CSV';
  return String(source).split('/').pop().split('?')[0] || 'CSV';
}

async function loadCsvRows(url) {
  if (location.protocol === 'file:' && !/^https?:/i.test(url)) {
    throw new Error(`Can't read ${url} from a file:// page — serve the folder over http (e.g. python3 -m http.server)`);
  }
  // Bust caches so an edited CSV shows up on the next reload, not hours later
  const bust = (url.includes('?') ? '&' : '?') + '_=' + Date.now();
  const res = await fetch(url + bust, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) {
    throw new Error(`${url} returned a web page, not CSV — use a direct / published CSV link`);
  }
  return rowsFromTable(parseCsv(text));
}

/** RFC 4180 CSV: quoted fields, "" escapes, commas and newlines inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

function rowsFromTable(table) {
  if (!table.length) return [];
  const head = table[0].map(h => h.trim().toLowerCase());
  return table.slice(1).map(cells =>
    Object.fromEntries(head.map((h, i) => [h, (cells[i] || '').trim()])));
}

// Google Sheet via gviz. JSONP rather than fetch(): Google sends no CORS header
// to the "null" origin of a file:// page, but <script> tags are exempt.
async function loadSheetRows({ sheetId, tab }) {
  const data = await jsonp(cb =>
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
    `?headers=1${tab ? `&sheet=${encodeURIComponent(tab)}` : ''}&tqx=out:json;responseHandler:${cb}`);
  const table = data && data.table;
  if (!table || !Array.isArray(table.rows)) throw new Error('Unexpected response from the Sheet');
  const head = (table.cols || []).map((c, i) => String((c && c.label) || (c && c.id) || i).trim().toLowerCase());
  return table.rows
    .map(r => (r && r.c) || [])
    .map(cells => Object.fromEntries(head.map((h, i) => [h, gvizText(cells[i]).trim()])));
}

/** gviz returns typed cells: {v: value, f: formatted}. Prefer plain values. */
function gvizText(cell) {
  if (!cell) return '';
  const { v, f } = cell;
  if (v === null || v === undefined) return f == null ? '' : String(f);
  // Date cells arrive as "Date(2026,7,10)" with a 0-based month → YYYY-MM-DD
  const dm = typeof v === 'string' && /^Date\((\d+),(\d+),(\d+)/.exec(v);
  if (dm) return `${dm[1]}-${String(+dm[2] + 1).padStart(2, '0')}-${String(dm[3]).padStart(2, '0')}`;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  return f == null ? String(v) : String(f);
}

function jsonp(buildUrl, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const cb = '__sheet_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = () => { clearTimeout(timer); delete window[cb]; script.remove(); };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true; cleanup(); reject(new Error('Timed out reaching the Sheet'));
    }, timeoutMs);
    window[cb] = data => { if (settled) return; settled = true; cleanup(); resolve(data); };
    script.onerror = () => {
      if (settled) return;
      settled = true; cleanup();
      reject(new Error('Could not load the Sheet — is it shared with "anyone with the link"?'));
    };
    script.src = buildUrl(cb);
    document.head.appendChild(script);
  });
}

/** Status cells are typed by hand, so accept the obvious synonyms. */
function normalizeStatus(raw) {
  const v = String(raw || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (['done', 'complete', 'completed', 'finished', 'submitted', 'yes', 'y', 'true', '✅', '1'].includes(v)) return 'done';
  if (['in-progress', 'progress', 'doing', 'wip', 'started', 'ongoing', 'partial'].includes(v)) return 'in-progress';
  return 'planned';
}

// Quotes are escaped too: data-supplied text also lands in attributes.
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
