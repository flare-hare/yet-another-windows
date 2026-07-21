/* =============================================================================
   МОДУЛЬ: cookie — уведомление об использовании localStorage.
   Показывает баннер, пока пользователь не нажал «Понятно». Факт согласия
   запоминается в localStorage, чтобы не показывать повторно.
   ============================================================================= */

const STORAGE_KEY = 'okonika-cookie-ok';

/**
 * @param {Object} refs
 * @param {HTMLElement} refs.banner - контейнер баннера [data-cookie]
 * @param {HTMLElement} refs.acceptBtn - кнопка «Понятно» [data-cookie-accept]
 */
export function setupCookie({ banner, acceptBtn }) {
  if (!banner) return;

  let accepted = false;
  try {
    accepted = localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    /* приватный режим — покажем баннер, это не критично */
  }

  if (accepted) return; // уже согласился — не показываем

  banner.hidden = false;

  acceptBtn?.addEventListener('click', () => {
    banner.hidden = true;
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* не смогли сохранить — просто скроем на эту сессию */
    }
  });
}
