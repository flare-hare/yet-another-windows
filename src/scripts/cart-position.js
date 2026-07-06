/* =============================================================================
   МОДУЛЬ: cart-position — перемещение корзины между позициями по ширине экрана.
   Десктоп (широкий): корзина в левой колонке (.constructor__aside) под превью.
   Планшет/мобайл (одна колонка): корзина — последний элемент .constructor__layout
   (визуально уезжает в самый низ).
   Узел корзины ОДИН — просто переносим его в DOM (никаких дублей).
   ============================================================================= */

// Брейкпоинт совпадает с адаптивом (≤1024px = одна колонка)
const MOBILE_QUERY = '(width <= 1024px)';

/**
 * Настраивает автоперемещение корзины.
 * Возвращает функцию отписки (на случай будущей очистки).
 */
export function setupCartPosition() {
  const cart = document.querySelector('[data-cart]');
  const aside = document.querySelector('.constructor__aside');
  const layout = document.querySelector('.constructor__layout');

  if (!cart || !aside || !layout) return () => {};

  const mql = window.matchMedia(MOBILE_QUERY);

  function place(isMobile) {
    if (isMobile) {
      // мобайл: корзина — последний элемент layout (внизу)
      if (cart.parentElement !== layout) {
        layout.append(cart);
      }
    } else {
      // десктоп: корзина обратно в aside, под превью
      if (cart.parentElement !== aside) {
        aside.append(cart);
      }
    }
  }

  // стартовая расстановка + подписка на смену брейкпоинта
  place(mql.matches);
  const handler = (e) => place(e.matches);
  mql.addEventListener('change', handler);

  return () => mql.removeEventListener('change', handler);
}
