/**
 * InboxZero — selector de idioma de la landing
 * Extraído de initLanguageDropdown en js/app.js (sin el resto de la app).
 */
(function () {
  'use strict';

  function initLanguageDropdown() {
    const toggle = document.getElementById('lang-dropdown-toggle');
    const menu = document.getElementById('lang-dropdown-menu');
    const flagEl = document.getElementById('lang-dropdown-flag');
    const labelEl = document.getElementById('lang-dropdown-label');
    const nativeSelect = document.getElementById('language-select');
    if (!toggle || !menu || !flagEl || !labelEl || !nativeSelect) return;
    const options = Array.from(menu.querySelectorAll('li[data-lang]'));
    function closeMenu() {
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }
    function openMenu() {
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    }
    function syncDisplay(langCode) {
      const match = options.find((li) => li.dataset.lang === langCode) || options[0];
      if (!match) return;
      flagEl.className = `fi fi-${match.dataset.flag} lang-flag`;
      labelEl.textContent = match.querySelector('span:last-child')?.textContent || '';
      options.forEach((li) => {
        li.setAttribute('aria-selected', li.dataset.lang === langCode ? 'true' : 'false');
      });
    }
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.hidden) openMenu(); else closeMenu();
    });
    options.forEach((li) => {
      li.addEventListener('click', () => {
        const langCode = li.dataset.lang;
        if (nativeSelect.value !== langCode) {
          nativeSelect.value = langCode;
          nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        syncDisplay(langCode);
        closeMenu();
      });
    });
    document.addEventListener('click', closeMenu);
    nativeSelect.addEventListener('change', () => {
      syncDisplay(nativeSelect.value);
    });
    window.addEventListener('localechange', () => {
      syncDisplay(nativeSelect.value);
    });
    document.addEventListener('i18n:ready', (e) => {
      syncDisplay(e.detail?.locale || nativeSelect.value);
    });
    syncDisplay(nativeSelect.value);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLanguageDropdown);
  } else {
    initLanguageDropdown();
  }
})();
