(function () {
  var STORAGE_KEY = 'inboxzero_cookie_consent';
  var styleInjected = false;
  function injectStyles() {
    if (styleInjected || document.getElementById('cookie-consent-styles')) return;
    styleInjected = true;
    var style = document.createElement('style');
    style.id = 'cookie-consent-styles';
    style.textContent =
      '#cookie-consent-banner { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2000; ' +
      'background: #101c42; color: #ffffff; padding: 16px 20px; box-shadow: 0 -6px 20px rgba(0,0,0,0.25); ' +
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }' +
      '.cookie-consent-inner { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; ' +
      'justify-content: space-between; gap: 20px; flex-wrap: wrap; }' +
      '.cookie-consent-message { margin: 0; font-size: 0.88rem; line-height: 1.5; color: #cbd8f7; flex: 1 1 320px; }' +
      '.cookie-consent-more { color: #F5B21A; font-weight: 600; text-decoration: none; margin-left: 4px; }' +
      '.cookie-consent-more:hover { text-decoration: underline; }' +
      '.cookie-consent-actions { display: flex; gap: 10px; flex-shrink: 0; }' +
      '.cookie-consent-btn { padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; ' +
      'cursor: pointer; border: none; }' +
      '.cookie-consent-accept { background: #F5B21A; color: #2a1a00; }' +
      '.cookie-consent-accept:hover { background: #ffc94d; }' +
      '.cookie-consent-reject { background: transparent; color: #ffffff; border: 1.5px solid rgba(255,255,255,0.4); }' +
      '.cookie-consent-reject:hover { background: rgba(255,255,255,0.08); }' +
      '@media (max-width: 640px) { .cookie-consent-inner { flex-direction: column; align-items: stretch; } ' +
      '.cookie-consent-actions { justify-content: stretch; } .cookie-consent-btn { flex: 1; } }';
    document.head.appendChild(style);
  }
  function getStoredConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      return data && data.value ? data.value : null;
    } catch (_) {
      return null;
    }
  }
  function storeConsent(value) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ value: value, date: new Date().toISOString() })
      );
    } catch (_) {
      /* localStorage no disponible: no se guarda, se preguntará de nuevo */
    }
  }
  window.hasCookieConsent = function () {
    return getStoredConsent() === 'accepted';
  };
  window.resetCookieConsent = function () {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    renderBanner();
  };
  function removeBanner() {
    var el = document.getElementById('cookie-consent-banner');
    if (el) el.remove();
  }
  function openCookiesPolicy(e) {
    if (e) e.preventDefault();
    var link = document.querySelector('[data-legal="cookies"]');
    if (link) link.click();
  }
  function renderBanner() {
    if (getStoredConsent()) {
      removeBanner();
      return;
    }
    injectStyles();
    var el = document.getElementById('cookie-consent-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cookie-consent-banner';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    var tFn = typeof window.t === 'function' ? window.t : function (k) { return k; };
    el.innerHTML =
      '<div class="cookie-consent-inner">' +
      '<p class="cookie-consent-message">' +
      tFn('cookieBanner.message') +
      ' <a href="#" id="cookie-consent-more" class="cookie-consent-more">' +
      tFn('cookieBanner.moreInfo') +
      '</a></p>' +
      '<div class="cookie-consent-actions">' +
      '<button type="button" id="cookie-consent-reject" class="cookie-consent-btn cookie-consent-reject">' +
      tFn('cookieBanner.reject') +
      '</button>' +
      '<button type="button" id="cookie-consent-accept" class="cookie-consent-btn cookie-consent-accept">' +
      tFn('cookieBanner.accept') +
      '</button>' +
      '</div>' +
      '</div>';
    var acceptBtn = document.getElementById('cookie-consent-accept');
    var rejectBtn = document.getElementById('cookie-consent-reject');
    var moreLink = document.getElementById('cookie-consent-more');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        storeConsent('accepted');
        removeBanner();
      });
    }
    if (rejectBtn) {
      rejectBtn.addEventListener('click', function () {
        storeConsent('rejected');
        removeBanner();
      });
    }
    if (moreLink) {
      moreLink.addEventListener('click', openCookiesPolicy);
    }
  }
  function init() {
    renderBanner();
  }
  document.addEventListener('i18n:ready', init);
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(init, 0);
  });
  window.addEventListener('localechange', function () {
    if (!getStoredConsent()) renderBanner();
  });
})();
