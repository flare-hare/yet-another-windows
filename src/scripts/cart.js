/* =============================================================================
   МОДУЛЬ: cart — корзина добавленных окон.
   Стор (список позиций + localStorage + подписка) и два рендера:
     • компактная СВОДКА под превью (итого + счётчик + кнопка), клик открывает диалог;
     • ДИАЛОГ с подробным составом (позиции + удаление).
   Позиция = снимок конфигурации + цена + человекочитаемое описание.
   ============================================================================= */

import { el } from './dom.js';
import { calcPrice, formatPrice } from './price.js';

const SPRITE = 'images/svg/sprite.svg';
const SVGNS = 'http://www.w3.org/2000/svg';

/** Иконка типа окна из спрайта (те же symbol id, что в карточках выбора). */
function spriteIcon(iconId) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'cart-item__thumb-svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVGNS, 'use');
  use.setAttribute('href', `${SPRITE}#${iconId}`);
  svg.append(use);
  return svg;
}

/** Иконка «корзина» (SVG) для кнопки удаления позиции. */
const TRASH_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

const STORAGE_KEY = 'okonika-cart-v1';

/** @type {Array<Object>} */
let items = load();

/** Подписчики на изменение корзины. */
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* приватный режим/переполнение — работаем в памяти */
  }
}

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
function subscribeCart(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Склонение «окно / окна / окон». */
function pluralWindows(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} окно`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} окна`;
  return `${n} окон`;
}

/**
 * Собирает позицию корзины из состояния конфигуратора.
 * @param {import('./state.js').ConfigState} state
 * @param {Object} data - windows.json
 * @returns {Object}
 */
export function buildCartItem(state, data) {
  const byId = (list, id) => (Array.isArray(list) ? list.find((x) => x.id === id) : undefined);
  const type = byId(data.windowTypes, state.typeId);
  const profile = byId(data.profiles, state.profileId);
  const glazing = byId(data.glazings, state.glazingId);
  const color = byId(data.colors, state.colorId);
  const hardware = byId(data.hardware, state.hardwareId);

  const { total } = calcPrice(state, data);
  const sashes = type?.sashes ?? 1;
  const openings = state.openings || [];
  const handleSides = state.handleSides || [];
  const hasOpening = openings.some((o) => o && o !== 'fixed');

  const sideName = (s) => (s === 'left' ? 'ручка слева' : 'ручка справа');
  const openingName = (id) => byId(data.openingTypes, id)?.name ?? 'Глухое';

  // Подробный состав позиции (используется и в корзине, и в заявке боту/на почту)
  const details = [];
  for (let i = 0; i < sashes; i += 1) {
    const opId = openings[i] ?? 'fixed';
    const isFixed = opId === 'fixed';
    const label = sashes > 1 ? `Створка ${i + 1}` : 'Створка';
    // Сторону ручки показываем только у открывающихся створок
    details.push(`${label}: ${openingName(opId)}${isFixed ? '' : `, ${sideName(handleSides[i])}`}`);
  }
  if (profile) details.push(`Профиль: ${profile.name}`);
  if (glazing) details.push(`Стеклопакет: ${glazing.name}`);
  if (color) details.push(`Цвет: ${color.name}`);
  if (hasOpening && hardware) details.push(`Фурнитура: ${hardware.name}`);

  // Доп. опции (extras — массив id)
  const extraNames = (state.extras || []).map((id) => byId(data.extras, id)?.name).filter(Boolean);
  if (extraNames.length) details.push(`Доп. опции: ${extraNames.join(', ')}`);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: type?.name ?? 'Окно',
    typeId: state.typeId, // для иконки типа окна в карточке
    size: `${state.width}×${state.height} см`,
    price: total,
    details,
    config: { ...state },
  };
}

/** Добавляет позицию. */
export function addItem(item) {
  items.push(item);
  persist();
  notify();
}

/** Удаляет позицию по id. */
function removeItem(id) {
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
 * Настраивает компактную сводку под превью + диалог со списком.
 * @param {Object} refs
 * @param {HTMLElement} refs.emptyEl     - «Пока пусто…» [data-cart-empty]
 * @param {HTMLElement} refs.summaryEl   - блок сводки [data-cart-summary]
 * @param {HTMLElement} refs.openEl      - кликабельная область-кнопка [data-cart-open]
 * @param {HTMLElement} refs.countEl     - счётчик [data-cart-count]
 * @param {HTMLElement} refs.totalEl     - сумма в сводке [data-cart-total]
 * @param {HTMLElement} refs.checkoutBtn - кнопка сводки [data-cart-checkout]
 * @param {HTMLDialogElement} refs.dialog - диалог [data-cart-dialog]
 * @param {HTMLElement} refs.dialogItems - список в диалоге [data-cart-items]
 * @param {HTMLElement} refs.dialogTotal - сумма в диалоге [data-cart-dialog-total]
 * @param {HTMLElement} refs.dialogClose - кнопка закрытия
 * @param {HTMLElement} refs.dialogCheckout - кнопка оформления в диалоге
 * @param {string} [currency='₽']
 */
export function setupCart(refs, currency = '₽') {
  const {
    emptyEl,
    summaryEl,
    openEl,
    countEl,
    totalEl,
    dialog,
    dialogItems,
    dialogTotal,
    dialogClose,
    checkoutBtn,
    successEl,
  } = refs;

  const openDialog = () => {
    renderDialog(getItems());
    dialog?.showModal?.();
  };
  const closeDialog = () => dialog?.close?.();

  // Открытие диалога: и клик по области сводки, и кнопка «Перейти к оформлению».
  // ОБЕ точки идут через openDialog (с renderDialog), иначе состав не обновится.
  openEl?.addEventListener('click', openDialog);
  checkoutBtn?.addEventListener('click', openDialog);
  dialogClose?.addEventListener('click', closeDialog);
  // Клик по подложке (вне inner) закрывает диалог.
  dialog?.addEventListener('click', (e) => {
    if (e.target === dialog) closeDialog();
  });

  function renderSummary(list) {
    const isEmpty = list.length === 0;
    if (emptyEl) emptyEl.hidden = !isEmpty;
    if (summaryEl) summaryEl.hidden = isEmpty;
    if (countEl) countEl.textContent = pluralWindows(list.length);
    if (totalEl) totalEl.textContent = formatPrice(getTotal(), currency);

    // Корзина опустела при открытом диалоге:
    //  • если показан экран «Спасибо» (после заказа) — оставляем его;
    //  • если пользователь удалил последнюю позицию вручную — закрываем диалог.
    if (isEmpty && dialog?.open) {
      const successVisible = successEl && !successEl.hidden;
      if (!successVisible) {
        closeDialog();
        return;
      }
    }

    // если диалог открыт — обновим состав
    if (dialog?.open) renderDialog(list);
  }

  function renderDialog(list) {
    if (!dialogItems) return;
    dialogItems.innerHTML = '';
    if (list.length === 0) {
      // Пустой список показываем только если открыт экран «Спасибо» (после заказа).
      // Закрытие пустого диалога при ручном удалении делает renderSummary.
      dialogItems.append(
        el('li', { className: 'cart-dialog__empty', textContent: 'Корзина пуста.' })
      );
    } else {
      list.forEach((item) => dialogItems.append(renderItem(item, currency)));
    }
    if (dialogTotal) dialogTotal.textContent = formatPrice(getTotal(), currency);
  }

  /**
   * Карточка позиции: [мини-превью] + <details>-спойлер.
   * summary — тип, размер, кнопка-корзина и цена; внутри — детали конфигурации.
   */
  function renderItem(item, cur) {
    // Иконка типа окна из спрайта (как в карточках выбора типа).
    const iconId = item.typeId || item.config?.typeId || 'single';
    const thumb = el('div', { className: 'cart-item__thumb', attrs: { 'aria-hidden': 'true' } }, [
      spriteIcon(iconId),
    ]);

    // Кнопка-иконка удаления (слева от цены)
    const removeBtn = el('button', {
      className: 'cart-item__remove',
      innerHTML: TRASH_SVG,
      attrs: { type: 'button', 'aria-label': `Удалить ${item.title} ${item.size}` },
    });
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault(); // не переключать <details>
      e.stopPropagation();
      removeItem(item.id);
    });

    // Шапка-спойлер: тип + размер, затем кнопка удаления и цена
    const summary = el('summary', { className: 'cart-item__summary' }, [
      thumb,
      el('div', { className: 'cart-item__info' }, [
        el('span', { className: 'cart-item__title', textContent: item.title }),
        el('span', { className: 'cart-item__size', textContent: item.size }),
      ]),
      removeBtn,
      el('span', { className: 'cart-item__price', textContent: formatPrice(item.price, cur) }),
    ]);

    const details = el('details', { className: 'cart-item' }, [summary]);

    if (item.details?.length) {
      details.append(
        el(
          'ul',
          { className: 'cart-item__details' },
          item.details.map((d) => el('li', { className: 'cart-item__detail', textContent: d }))
        )
      );
    }

    return el('li', {}, [details]);
  }

  subscribeCart(renderSummary);
  renderSummary(getItems());
}
