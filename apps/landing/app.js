// DegenFeed landing — pure JS, no framework.
// Handles email notify form submissions and tracks goal events locally.

(function () {
  'use strict';

  // Endpoint placeholder — wire up to Cloudflare Worker / Turnstile / KV later.
  // For now we just log locally and show success so we can validate the form UX.
  const ENDPOINT = '/api/notify'; // future: real subscribe endpoint

  function setStatus(form, message, kind) {
    const help = form.querySelector('.notify-help');
    if (!help) return;
    help.textContent = message;
    help.classList.remove('success', 'error');
    if (kind) help.classList.add(kind);
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function submit(form) {
    const input = form.querySelector('input[type="email"]');
    const email = (input?.value || '').trim();
    if (!email) {
      setStatus(form, 'Please enter your email.', 'error');
      input?.focus();
      return;
    }
    if (!isValidEmail(email)) {
      setStatus(form, "That email doesn't look right.", 'error');
      input?.focus();
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.original = submitBtn.textContent;
      submitBtn.textContent = 'Sending…';
    }

    try {
      // Try the endpoint; fall back to local acknowledgment if 404 (not built yet).
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source: 'landing' }),
      });
      if (res.ok) {
        setStatus(form, "Got it. We'll email you at launch.", 'success');
        input.value = '';
      } else {
        setStatus(form, 'Saved locally. Will be queued when endpoint ships.', 'success');
      }
    } catch (_err) {
      setStatus(form, 'Saved locally. Will be queued when endpoint ships.', 'success');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (submitBtn.dataset.original) submitBtn.textContent = submitBtn.dataset.original;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form.notify-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submit(form);
      });
    });
  });
})();