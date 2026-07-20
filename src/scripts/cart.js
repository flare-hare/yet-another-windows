/* =============================================================================
   МОДУЛЬ: cart — корзина добавленных окон.
   Отдельный стор (не путать с конфигуратором-state): хранит список позиций,
   сохраняется в localStorage, оповещает подписчиков. Плюс рендер в разметку.
   Позиция = снимок конфигурации + рассчитанная цена + человекочитаемое описание.
   ============================================================================= */

import { el } from './dom.js';
import { calcPrice, formatPrice } from './price.js';

const STORAGE_KEY = 'okonika-cart-v1';

/** @type {Array<Object>} список позиций корзины */
let items = load();

/** Подписчики на изменение корзины. */
const listeners = new Set();

/** Загружает корзину из localStorage (безопасно). */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Сохраняет корзину в localStorage (безопасно). */
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* приватный режим/переполнение — просто работаем в памяти */
  }
}

/** Оповещает подписчиков текущим списком. */
function notify() {
  listeners.forEach((fn) => fn(getItems()));
}

/** @returns {Array<Object>} копия списка позиций */
export function getItems() {
  return items.map((it) => ({ ...it }));
}

/** @returns {number} сумма корзины */
export function getTotal() {
  return items.reduce((sum, it) => sum + (it.price || 0), 0);
}

/**
 * Подписаться на изменения корзины.
 * @param {(items: Array<Object>) => void} fn
 * @returns {() => void} отписка
 */
export function subscribeCart(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Собирает человекочитаемое описание позиции из состояния конфигуратора.
 * @param {import('./state.js').ConfigState} state
 * @param {Object} data - windows.json
 * @returns {Object} позиция корзины
 */
export function buildCartItem(state, data) {
  const byId = (list, id) => (Array.isArray(list) ? list.find((x) => x.id === id) : undefined);
  const type = byId(data.windowTypes, state.typeId);
  const profile = byId(data.profiles, state.profileId);
  const glazing = byId(data.glazings, state.glazingId);
  const color = byId(data.colors, state.colorId);
  const hardware = byId(data.hardware, state.hardwareId);

  const { total } = calcPrice(state, data);
  const hasOpening = (state.openings || []).some((o) => o && o !== 'fixed');

  // Свёрнутые детали (показываем по клику)
  const details = [];
  if (profile) details.push(`Профиль: ${profile.name}`);
  if (glazing) details.push(`Стеклопакет: ${glazing.name}`);
  if (color) details.push(`Цвет: ${color.name}`);
  if (hasOpening && hardware) details.push(`Фурнитура: ${hardware.name}`);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: type?.name ?? 'Окно',
    size: `${state.width}×${state.height} см`,
    price: total,
    details,
    // снимок конфигурации — на будущее (редактирование/оформление заказа)
    config: { ...state },
  };
}

/** Добавляет позицию в корзину. */
export function addItem(item) {
  items.push(item);
  persist();
  notify();
}

/** Удаляет позицию по id. */
export function removeItem(id) {
  items = items.filter((it) => it.id !== id);
  persist();
  notify();
}

/** Полностью очищает корзину. */
export function clearCart() {
  items = [];
  persist();
  notify();
}

/**
 * Настраивает рендер корзины в разметку и подписку на изменения.
 * @param {Object} refs - ссылки на узлы разметки
 * @param {HTMLElement} refs.itemsEl   - контейнер позиций [data-cart-items]
 * @param {HTMLElement} refs.emptyEl   - заглушка «пусто» (внутри itemsEl)
 * @param {HTMLElement} refs.totalRow  - строка «Итого» [data-cart-total-row]
 * @param {HTMLElement} refs.totalEl   - значение суммы [data-cart-total]
 * @param {HTMLElement} refs.checkoutBtn - кнопка «Оформить заказ»
 * @param {string} [currency='₽']
 */
export function setupCart(refs, currency = '₽') {
  const { itemsEl, totalRow, totalEl, checkoutBtn } = refs;

  function render(list) {
    if (!itemsEl) return;
    itemsEl.innerHTML = '';

    const isEmpty = list.length === 0;

    if (isEmpty) {
      itemsEl.append(
        el('p', {
          className: 'cart__empty',
          textContent: 'Пока пусто — соберите окно и нажмите «В корзину».',
        })
      );
    } else {
      list.forEach((item) => itemsEl.append(renderItem(item, currency)));
    }

    // Итог и кнопка оформления — только когда есть позиции (защита от пустых заказов)
    if (totalRow) totalRow.hidden = isEmpty;
    if (totalEl) totalEl.textContent = formatPrice(getTotal(), currency);
    if (checkoutBtn) checkoutBtn.hidden = isEmpty;
  }

  /** Карточка одной позиции (компактно: тип + размер + цена, детали по клику). */
  function renderItem(item, cur) {
    const head = el('div', { className: 'cart-item__head' }, [
      el('div', { className: 'cart-item__info' }, [
        el('span', { className: 'cart-item__title', textContent: item.title }),
        el('span', { className: 'cart-item__size', textContent: item.size }),
      ]),
      el('span', { className: 'cart-item__price', textContent: formatPrice(item.price, cur) }),
    ]);

    const children = [head];

    if (item.details?.length) {
      children.push(
        el(
          'ul',
          { className: 'cart-item__details' },
          item.details.map((d) => el('li', { className: 'cart-item__detail', textContent: d }))
        )
      );
    }

    const removeBtn = el('button', {
      className: 'cart-item__remove',
      textContent: 'Удалить',
      attrs: { type: 'button', 'aria-label': `Удалить ${item.title} ${item.size}` },
      onclick: () => removeItem(item.id),
    });
    children.push(removeBtn);

    return el('li', { className: 'cart-item' }, children);
  }

  subscribeCart(render);
  render(getItems());
}
