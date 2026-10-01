/* Shared student-auth module (used by every student page). */
const API_URL = "https://script.google.com/macros/s/AKfycbwQiNcbDAXIWaLRAQ6bmFQpB8fuyvmRbWp7aTfzyqdSz9f871GFay4kJ980EUnLy7al/exec";
const SESSION_KEY = 'cpv2_session';

const wait_ = (ms) => new Promise((r) => setTimeout(r, ms));

async function callApi(action, payload, attempt) {
  attempt = attempt || 1;
  if (!API_URL || API_URL.indexOf('PASTE_YOUR') === 0) throw new Error('Site not connected to the backend yet (set API_URL in auth.js).');
  let resp;
  try {
    resp = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload: payload || {} }) });
  } catch (e) {
    if (attempt < 3) { await wait_(500 * attempt); return callApi(action, payload, attempt + 1); }
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  let data;
  try { data = await resp.json(); } catch (e) {
    if (attempt < 3) { await wait_(500 * attempt); return callApi(action, payload, attempt + 1); }
    throw new Error('The server is busy. Please try again in a moment.');
  }
  if (!data.ok) throw new Error(data.error || 'Something went wrong.');
  return data.data;
}

// Slow, salted PBKDF2 runs in the browser (free CPU); the server never sees the raw password.
async function hashPassword(email, password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 150000,
    salt: enc.encode('clearphysics:' + email.trim().toLowerCase()) }, key, 256);
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const Session = {
  get() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; } },
  set(s) { localStorage.setItem(SESSION_KEY, JSON.stringify({ token: s.sessionToken, email: s.email })); },
  clear() { localStorage.removeItem(SESSION_KEY); },
  token() { const s = this.get(); return s ? s.token : null; }
};

// Use on student pages: callApi('getMyProfile', withSession({})) — signs out if the session is rejected.
function withSession(payload) { return Object.assign({ sessionToken: Session.token() }, payload || {}); }
