'use strict';
(() => {
  const root = document.documentElement;
  const intro = document.getElementById('intro');
  const shell = document.getElementById('game-shell');
  const button = document.getElementById('intro-start');
  const art = document.getElementById('intro-art');
  let leaving = false;
  function showFallback() { intro.classList.add('intro-fallback'); }
  art.addEventListener('error', showFallback);
  if (art.complete && !art.naturalWidth) showFallback();
  if (!root.classList.contains('intro-active')) return;
  intro.hidden = false;
  shell.inert = true;
  button.focus({preventScroll: true});
  function enterGame() {
    if (leaving) return;
    leaving = true;
    // Session storage survives reloads and same-tab navigation, not a new visit.
    try { sessionStorage.setItem('tariff-bash.intro.seen', '1'); } catch {}
    intro.classList.add('intro-leaving');
    const finish = () => {
      intro.hidden = true;
      shell.inert = false;
      root.classList.remove('intro-active');
      document.getElementById('play').focus({preventScroll: true});
      document.removeEventListener('keydown', introKeys, true);
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else window.setTimeout(finish, 260);
  }
  function introKeys(event) {
    if (!root.classList.contains('intro-active')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) enterGame();
    }
  }
  button.addEventListener('click', enterGame);
  document.addEventListener('keydown', introKeys, true);
})();
