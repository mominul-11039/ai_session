/* ────────────────────────────────────────────────────────────────────────────
   Shared admin gate for the AI Infra program pages.

   Everyone can open and read the pages. Only a signed-in admin sees the
   controls that add, edit, complete or delete sessions.

   ⚠️  This is a front-end gate on a static site: it decides what the UI shows,
   not what a determined visitor can reach. Anyone who opens devtools can flip
   the flag. Use it to keep the schedule tidy, not to protect secrets. If you
   need real access control, the session data has to move behind a server.

   ── Changing the passcode ───────────────────────────────────────────────────
   Open any page, then in the browser console run:

       Auth.hashFor('admin', 'your-new-passcode')

   Paste the result into ADMINS[].hash below.
   Default credentials: admin / ai-infra-2026
   ──────────────────────────────────────────────────────────────────────────── */
const Auth = (function () {
  const KEY = 'ai-program-auth';
  const TTL_HOURS = 12;

  const ADMINS = [
    { id: 'admin', name: 'Program Admin', hash: '1bc308c172cb33' },
  ];

  // cyrb53 — small, dependency-free, and works over file:// and plain http
  // alike (crypto.subtle is unavailable outside secure contexts).
  function hash(str, seed = 0x5f3a) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }

  function hashFor(id, passcode) {
    return hash(`${String(id).trim().toLowerCase()}:${passcode}`);
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.id || !s.expires) return null;
      if (Date.now() > s.expires) { localStorage.removeItem(KEY); return null; }
      return s;
    } catch (e) {
      return null;
    }
  }

  function login(id, passcode) {
    const cleanId = String(id || '').trim().toLowerCase();
    const admin = ADMINS.find(a => a.id === cleanId);
    if (!admin || hashFor(cleanId, passcode || '') !== admin.hash) {
      return { ok: false, error: 'That admin ID and passcode do not match.' };
    }
    localStorage.setItem(KEY, JSON.stringify({
      id: admin.id,
      name: admin.name,
      expires: Date.now() + TTL_HOURS * 3600 * 1000,
    }));
    return { ok: true, admin };
  }

  function logout() { localStorage.removeItem(KEY); }
  function current() { return readSession(); }
  function isAdmin() { return !!readSession(); }

  /** Send a visitor to the login screen, returning here afterwards. */
  function goToLogin(next) {
    const target = next || (location.pathname.split('/').pop() || 'index.html');
    location.href = `login.html?next=${encodeURIComponent(target)}`;
  }

  /** Renders the "viewing as…" block that sits at the bottom of each sidebar. */
  function renderFooter(el, opts = {}) {
    if (!el) return;
    const s = current();
    const here = location.pathname.split('/').pop() || 'index.html';

    if (s) {
      const until = new Date(s.expires).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      el.innerHTML = `
        <div class="auth-box is-admin">
          <div class="auth-dot"></div>
          <div class="auth-text">
            <div class="auth-role">${s.name}</div>
            <div class="auth-note">Edit access until ${until}</div>
          </div>
          <button class="auth-btn" id="auth-action">Log out</button>
        </div>`;
      el.querySelector('#auth-action').onclick = () => {
        logout();
        if (opts.onChange) opts.onChange(); else location.reload();
      };
    } else {
      el.innerHTML = `
        <div class="auth-box">
          <div class="auth-dot"></div>
          <div class="auth-text">
            <div class="auth-role">Viewing as guest</div>
            <div class="auth-note">${opts.guestNote || 'Read-only'}</div>
          </div>
          <button class="auth-btn" id="auth-action">Admin login</button>
        </div>`;
      el.querySelector('#auth-action').onclick = () => goToLogin(here);
    }
  }

  return { isAdmin, current, login, logout, hashFor, goToLogin, renderFooter };
})();
