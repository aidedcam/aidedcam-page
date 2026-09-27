// Shared by both viewers: the status banner. A banner is { key, params, action? } with action
// { key, run }, or null to hide it. Kept as data, so a language change can re-render it.
export function renderBanner(el, banner, t) {
  el.replaceChildren();
  el.hidden = !banner;
  if (!banner) return;
  const span = document.createElement('span');
  span.textContent = t(banner.key, banner.params || {});
  el.appendChild(span);
  if (banner.action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gv-link gv-banner-action';
    btn.textContent = t(banner.action.key);
    btn.addEventListener('click', banner.action.run);
    el.append(' ', btn);
  }
}
