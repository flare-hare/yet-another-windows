/* =============================================================================
   МОДУЛЬ: howto — управление диалогом «Как это работает» (нативный <dialog>).
   Открытие по кнопкам [data-open-howto], закрытие по [data-close-howto],
   по клику на подложку и по Esc (Esc — нативно у <dialog>).
   ============================================================================= */

   export function setupHowto() {
    const dialog = document.querySelector('[data-howto]');
    if (!dialog) return;

    const openers = document.querySelectorAll('[data-open-howto]');
    const closers = dialog.querySelectorAll('[data-close-howto]');

    openers.forEach((btn) => {
      btn.addEventListener('click', () => dialog.showModal());
    });

    closers.forEach((btn) => {
      btn.addEventListener('click', () => dialog.close());
    });

    // Закрытие по клику на подложку (вне контента диалога)
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }
