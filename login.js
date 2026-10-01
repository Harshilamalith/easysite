const AFTER_LOGIN_URL = 'index.html'; // the student dashboard page (built in the next step)
const $ = (id) => document.getElementById(id);
let mode = 'login';        // 'login' | 'register'
let codePurpose = 'verify'; // 'verify' | 'reset'
let pendingEmail = '';

function show(step) { ['main', 'code', 'done'].forEach((s) => $('step-' + s).classList.toggle('hidden', s !== step)); }
function say(text, type) { const m = $('msg'); m.textContent = text || ''; m.className = 'msg' + (type ? ' ' + type : ''); }
async function busy(btn, fn) {
  btn.disabled = true; say('');
  try { await fn(); } catch (e) { say(e.message, 'err'); } finally { btn.disabled = false; }
}

function setMode(m) {
  mode = m;
  $('tab-login').classList.toggle('on', m === 'login'); $('tab-register').classList.toggle('on', m === 'register');
  $('confirm-wrap').classList.toggle('hidden', m !== 'register');
  $('main-btn').textContent = m === 'login' ? 'Log in' : 'Create account';
  $('password').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('forgot-link').classList.toggle('hidden', m !== 'login'); say('');
}
$('tab-login').onclick = () => setMode('login');
$('tab-register').onclick = () => setMode('register');

function askForCode(purpose, email) {
  codePurpose = purpose; pendingEmail = email;
  $('code-title').textContent = purpose === 'verify' ? 'Verify your email' : 'Reset your password';
  $('code-sub').textContent = 'We sent a 6-digit code to ' + email + '. Check your spam folder too.';
  $('newpw-wrap').classList.toggle('hidden', purpose !== 'reset');
  $('code-btn').textContent = purpose === 'verify' ? 'Verify' : 'Set new password';
  $('code').value = ''; show('code'); $('code').focus();
}

function signedIn(result) {
  Session.set(result);
  $('done-sub').textContent = result.email + (result.profile ? '' : ' — next, complete your student profile.');
  show('done'); say('');
}

$('form-main').onsubmit = (ev) => { ev.preventDefault(); busy($('main-btn'), async () => {
  const email = $('email').value.trim().toLowerCase(), pw = $('password').value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
  if (pw.length < 8) throw new Error('Password must be at least 8 characters.');
  if (mode === 'register' && pw !== $('password2').value) throw new Error('The two passwords do not match.');
  const passwordHash = await hashPassword(email, pw);
  const r = await callApi(mode === 'login' ? 'authLogin' : 'authRegister', { email, passwordHash });
  if (r.needsVerification) askForCode('verify', email); else signedIn(r);
}); };

$('forgot-link').onclick = () => busy($('forgot-link'), async () => {
  const email = $('email').value.trim().toLowerCase();
  if (!email) throw new Error('Type your email above first.');
  await callApi('authForgotPassword', { email });
  askForCode('reset', email);
});

$('form-code').onsubmit = (ev) => { ev.preventDefault(); busy($('code-btn'), async () => {
  const code = $('code').value.trim();
  if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code.');
  if (codePurpose === 'verify') return signedIn(await callApi('authVerifyEmail', { email: pendingEmail, code }));
  const pw = $('newpw').value;
  if (pw.length < 8) throw new Error('New password must be at least 8 characters.');
  signedIn(await callApi('authResetPassword', { email: pendingEmail, code, passwordHash: await hashPassword(pendingEmail, pw) }));
}); };

$('resend-link').onclick = () => busy($('resend-link'), async () => {
  await callApi(codePurpose === 'verify' ? 'authResendCode' : 'authForgotPassword', { email: pendingEmail });
  say('A new code is on its way.', 'ok');
});
$('back-link').onclick = () => { show('main'); say(''); };
$('continue-btn').onclick = () => { location.href = AFTER_LOGIN_URL; };
$('signout-link').onclick = () => { Session.clear(); show('main'); say('Signed out.', 'ok'); };

if (Session.get()) { $('done-sub').textContent = Session.get().email; show('done'); }
