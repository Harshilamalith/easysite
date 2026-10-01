/* Email + password login inside the original modal (verification code, reset password). */
(function () {
    const $ = (id) => document.getElementById(id);
    let mode = 'login', purpose = 'verify', pending = '';

    function say(text, ok) { const m = $('modal-status'); m.textContent = text || ''; m.style.color = ok ? '#34d399' : '#f87171'; }
    async function busy(btn, fn) {
        btn.disabled = true; say('');
        try { await fn(); } catch (e) { say(e.message || 'Something went wrong.'); } finally { btn.disabled = false; }
    }
    function setMode(m) {
        mode = m;
        $('auth-tab-login').classList.toggle('active', m === 'login');
        $('auth-tab-register').classList.toggle('active', m === 'register');
        $('auth-confirm-wrap').style.display = m === 'register' ? 'flex' : 'none';
        $('auth-forgot-link').style.display = m === 'login' ? 'block' : 'none';
        $('auth-submit-btn').textContent = m === 'login' ? 'Log in' : 'Create account';
        $('auth-password').autocomplete = m === 'login' ? 'current-password' : 'new-password';
        say('');
    }
    function showCode(p, email) {
        purpose = p; pending = email;
        $('auth-title').textContent = p === 'verify' ? 'Verify your email' : 'Reset your password';
        $('auth-sub').textContent = 'We sent a 6-digit code to ' + email + '. Check your spam folder too.';
        $('auth-newpw-wrap').style.display = p === 'reset' ? 'flex' : 'none';
        $('auth-code-btn').textContent = p === 'verify' ? 'Verify' : 'Set new password';
        $('auth-main').style.display = 'none'; $('auth-code').style.display = 'block';
        $('auth-code-input').value = ''; $('auth-code-input').focus();
    }
    function showMain() {
        $('auth-title').textContent = 'Student Login';
        $('auth-sub').textContent = 'Log in with your email and password, or create a new account.';
        $('auth-code').style.display = 'none'; $('auth-main').style.display = 'block'; say('');
    }

    $('auth-tab-login').onclick = () => setMode('login');
    $('auth-tab-register').onclick = () => setMode('register');

    $('auth-form').onsubmit = (ev) => { ev.preventDefault(); busy($('auth-submit-btn'), async () => {
        const email = $('auth-email').value.trim().toLowerCase(), pw = $('auth-password').value;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
        if (pw.length < 8) throw new Error('Password must be at least 8 characters.');
        if (mode === 'register' && pw !== $('auth-password2').value) throw new Error('The two passwords do not match.');
        const passwordHash = await hashPassword(email, pw);
        const r = await callApi(mode === 'login' ? 'authLogin' : 'authRegister', { email: email, passwordHash: passwordHash });
        if (r.needsVerification) showCode('verify', email); else { showMain(); handleSession(r); }
    }); };

    $('auth-forgot-link').onclick = (e) => { e.preventDefault(); busy($('auth-submit-btn'), async () => {
        const email = $('auth-email').value.trim().toLowerCase();
        if (!email) throw new Error('Type your email above first.');
        await callApi('authForgotPassword', { email: email });
        showCode('reset', email);
    }); };

    $('auth-code-form').onsubmit = (ev) => { ev.preventDefault(); busy($('auth-code-btn'), async () => {
        const code = $('auth-code-input').value.trim();
        if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code.');
        let r;
        if (purpose === 'verify') r = await callApi('authVerifyEmail', { email: pending, code: code });
        else {
            const pw = $('auth-newpw').value;
            if (pw.length < 8) throw new Error('New password must be at least 8 characters.');
            r = await callApi('authResetPassword', { email: pending, code: code, passwordHash: await hashPassword(pending, pw) });
        }
        showMain(); handleSession(r);
    }); };

    $('auth-resend-link').onclick = (e) => { e.preventDefault(); busy($('auth-code-btn'), async () => {
        await callApi(purpose === 'verify' ? 'authResendCode' : 'authForgotPassword', { email: pending });
        say('A new code is on its way.', true);
    }); };
    $('auth-back-link').onclick = (e) => { e.preventDefault(); showMain(); };
})();
