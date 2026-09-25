import { auth } from '../core/auth.js';
import { icon } from '../core/icons.js';
import { isSupabaseConfigured } from '../core/supabase-client.js';

export function renderLogin(root, onSuccess) {
  root.innerHTML = `
    <div class="login">
      <section class="login-story" aria-hidden="true">
        <div>
          <h2>Budget Management System</h2>
          <p class="lead">One place to build, track and report on Capital SACCO's annual budget — from first draft to management review.</p>
        </div>
        <ol class="flow">
          <li><strong>Budget</strong><span>Enter or upload Operating, CAPEX, Staff, Governance and Funding figures for any budget year.</span></li>
          <li><strong>Actuals</strong><span>Record monthly actuals once — year-to-date and full-year totals follow automatically.</span></li>
          <li><strong>Performance</strong><span>See budget vs actual, variance and branch performance as the year unfolds.</span></li>
          <li><strong>Reports</strong><span>Generate management-ready reports straight from the stored figures.</span></li>
        </ol>
        <p class="fine">Capital SACCO Ltd. · P.O. Box 1479-60200 Meru, Kenya</p>
      </section>

      <section class="login-main">
        <div class="login-card">
          <div class="login-logo">
            <img src="assets/logo.jpg" alt="Capital SACCO Ltd. — Base for Growth">
          </div>
          <h1>Sign in</h1>
          <p class="intro">Budget Management System</p>

          ${!isSupabaseConfigured ? `
          <div class="banner banner-teal" role="note" style="margin-bottom:16px">
            ${icon('spark')}<div><strong>Walkthrough mode.</strong> Supabase isn't connected yet, so any email and password will open a local preview. No data is read or written.</div>
          </div>` : ''}

          <form class="login-form" id="loginForm" novalidate>
            <div id="formError" role="alert"></div>
            <div class="field">
              <label for="email">Email address</label>
              <input class="input" type="email" id="email" name="email" autocomplete="username" placeholder="you@capitalsacco.co.ke" required>
              <span class="field-error" id="emailError" hidden></span>
            </div>
            <div class="field">
              <label for="password">Password</label>
              <div class="input-wrap">
                <input class="input" type="password" id="password" name="password" autocomplete="current-password" placeholder="Enter your password" required>
                <button type="button" class="input-toggle" id="togglePw" aria-label="Show password" aria-pressed="false">${icon('eye')}</button>
              </div>
              <span class="field-error" id="passwordError" hidden></span>
            </div>
            <button type="submit" class="btn btn-primary btn-block" id="loginSubmit">
              <span class="btn-label">Sign in</span>
            </button>
          </form>

          <div class="login-note">
            Access is managed by Capital SACCO's Finance department. If you've forgotten your password or need an account, contact your system administrator.
          </div>
        </div>
      </section>
    </div>`;

  const form = document.getElementById('loginForm');
  const emailEl = document.getElementById('email');
  const pwEl = document.getElementById('password');
  const emailErr = document.getElementById('emailError');
  const pwErr = document.getElementById('passwordError');
  const formError = document.getElementById('formError');
  const submitBtn = document.getElementById('loginSubmit');
  const toggleBtn = document.getElementById('togglePw');

  toggleBtn.addEventListener('click', () => {
    const showing = pwEl.type === 'text';
    pwEl.type = showing ? 'password' : 'text';
    toggleBtn.setAttribute('aria-pressed', String(!showing));
    toggleBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    toggleBtn.innerHTML = icon(showing ? 'eye' : 'eyeOff');
  });

  function setError(el, msgEl, message) {
    if (message) { el.setAttribute('aria-invalid', 'true'); msgEl.hidden = false; msgEl.textContent = message; }
    else { el.removeAttribute('aria-invalid'); msgEl.hidden = true; msgEl.textContent = ''; }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.innerHTML = '';
    let valid = true;
    if (!emailEl.value.trim() || !/^\S+@\S+\.\S+$/.test(emailEl.value)) {
      setError(emailEl, emailErr, 'Enter a valid email address.'); valid = false;
    } else setError(emailEl, emailErr, '');
    if (!pwEl.value) {
      setError(pwEl, pwErr, 'Enter your password.'); valid = false;
    } else setError(pwEl, pwErr, '');
    if (!valid) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span><span class="btn-label">Signing in…</span>`;
    try {
      const session = await auth.signIn(emailEl.value.trim(), pwEl.value);
      onSuccess(session);
    } catch (err) {
      formError.innerHTML = `<div class="banner banner-error" role="alert">${icon('warn')}<div><strong>Sign-in failed.</strong> ${err.message || 'Check your email and password and try again.'}</div></div>`;
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span class="btn-label">Sign in</span>`;
    }
  });
}
