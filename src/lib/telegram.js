// Thin wrapper around Telegram Web App SDK. Everything degrades gracefully in a normal browser.
const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
const inTelegram = Boolean(tg && tg.initData);

// Full screen on phones (Bot API 8.0+). Telegram keeps its controls (close, title, ⋯) on top of
// the app, so the app pads its content by the safe areas Telegram reports.
export function initTelegram() {
  if (!inTelegram) return;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.('#f5f3f9');
    tg.setBackgroundColor?.('#f5f3f9');
    tg.setBottomBarColor?.('#f5f3f9');
    tg.disableVerticalSwipes?.();
    const mobile = ['ios', 'android', 'android_x'].includes(tg.platform);
    if (mobile && tg.isVersionAtLeast?.('8.0')) {
      tg.requestFullscreen?.();
      tg.lockOrientation?.();
    }
    applyInsets();
    for (const ev of ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged', 'viewportChanged']) tg.onEvent?.(ev, applyInsets);
  } catch {}
}

// Mirrors Telegram's safe areas into CSS variables (also works on clients that do not set them).
function applyInsets() {
  const sa = tg.safeAreaInset || {};
  const ca = tg.contentSafeAreaInset || {};
  const root = document.documentElement.style;
  root.setProperty('--tg-top', `${(sa.top || 0) + (ca.top || 0)}px`);
  root.setProperty('--tg-bottom', `${(sa.bottom || 0) + (ca.bottom || 0)}px`);
  document.documentElement.classList.toggle('tg-fullscreen', Boolean(tg.isFullscreen));
}

export function tgUser() {
  return inTelegram ? tg.initDataUnsafe?.user || null : null;
}

// Telegram gives Ukrainian as "uk"; the app uses "ua".
export function suggestedLang() {
  const code = (tgUser()?.language_code || navigator.language || 'uk').toLowerCase();
  if (code.startsWith('ru')) return 'ru';
  return 'ua';
}

export function haptic(kind) {
  if (!inTelegram) return;
  try {
    const h = tg.HapticFeedback;
    if (kind === 'success' || kind === 'error' || kind === 'warning') h.notificationOccurred(kind);
    else if (kind === 'select') h.selectionChanged();
    else h.impactOccurred(kind || 'light');
  } catch {}
}

export function initData() {
  return inTelegram ? tg.initData : '';
}
