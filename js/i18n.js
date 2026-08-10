/**
 * InboxZero — i18n ampliado a 5 idiomas con soporte para menú desplegable
 * Globals: t(key, vars?), applyTranslations(), setLocale(code), getLocale()
 */
(function () {
  'use strict';

  // 1. Ampliamos la lista a los 5 idiomas requeridos
  const SUPPORTED = ['es', 'en', 'fr', 'de', 'pt'];
  const FALLBACK = 'en';
  const STORAGE_KEY = 'inboxzero_locale';

  let messages = {};
  let locale = FALLBACK;

  function resolveKey(obj, key) {
    return key.split('.').reduce((acc, part) => {
      if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
        return acc[part];
      }
      return undefined;
    }, obj);
  }

  function interpolate(str, vars) {
    if (!vars || typeof str !== 'string') return str;
    return str.replace(/\{\{(\w+)\}\}/g, (_, name) =>
      vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : `{{${name}}}`
    );
  }

  function parseVarsAttr(el) {
    const raw = el.getAttribute('data-i18n-vars');
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  function t(key, vars) {
    const value = resolveKey(messages, key);
    if (value === undefined) {
      console.warn('[i18n] Missing key:', key);
      return key;
    }
    if (typeof value !== 'string') {
      console.warn('[i18n] Key is not a string:', key);
      return key;
    }
    return interpolate(value, vars);
  }

  function detectLocale() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;

    const browser = (navigator.language || navigator.userLanguage || FALLBACK)
      .split('-')[0]
      .toLowerCase();
    return SUPPORTED.includes(browser) ? browser : FALLBACK;
  }

  async function loadLocale(code) {
    const tryCodes = code === FALLBACK ? [code] : [code, FALLBACK];
    for (const loc of tryCodes) {
      try {
        const res = await fetch(`locales/${loc}.json`);
        if (!res.ok) continue;
        messages = await res.json();
        locale = loc;
        return;
      } catch (err) {
        console.warn('[i18n] Failed to load locale', loc, err);
      }
    }
    messages = {};
    locale = FALLBACK;
  }

  function applyTranslations(root) {
    const scope = root || document;

    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const vars = parseVarsAttr(el);
      el.textContent = t(key, vars);
    });

    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      const vars = parseVarsAttr(el);
      el.innerHTML = t(key, vars);
    });

    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key);
    });

    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      el.title = t(key);
    });

    scope.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      const key = el.getAttribute('data-i18n-alt');
      el.alt = t(key);
    });

    const titleKeyEl = document.querySelector('title[data-i18n]');
    if (titleKeyEl) {
      document.title = t(titleKeyEl.getAttribute('data-i18n'));
    }

    document.documentElement.lang = locale;

    // Sincronizar visualmente el menú desplegable con el idioma activo
    const selector = document.getElementById('language-select');
    if (selector) {
      selector.value = locale;
    }
  }

  async function setLocale(code) {
    if (!SUPPORTED.includes(code)) {
      console.warn('[i18n] Unsupported locale:', code);
      return;
    }
    localStorage.setItem(STORAGE_KEY, code);
    await loadLocale(code);
    applyTranslations();
    window.dispatchEvent(new CustomEvent('localechange', { detail: { locale: code } }));
  }

  function getLocale() {
    return locale;
  }

  async function initI18n() {
    locale = detectLocale();
    await loadLocale(locale);
    applyTranslations();

    // Conectar el evento del menú desplegable (<select>)
    const selector = document.getElementById('language-select');
    if (selector) {
      selector.addEventListener('change', function (e) {
        setLocale(e.target.value);
      });
    }

    document.dispatchEvent(new CustomEvent('i18n:ready', { detail: { locale } }));
  }

  window.t = t;
  window.applyTranslations = applyTranslations;
  window.setLocale = setLocale;
  window.getLocale = getLocale;
  window.getMessage = function getMessage(key) {
    return resolveKey(messages, key);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
  } else {
    initI18n();
  }
})();
