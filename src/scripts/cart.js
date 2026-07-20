/* =============================================================================
   МОДУЛЬ: cart — корзина добавленных окон.
   Стор (список позиций + localStorage + подписка) и два рендера:
     • компактная СВОДКА под превью (итого + счётчик + кнопка), клик открывает диалог;
     • ДИАЛОГ с подробным составом (позиции + удаление).
   Позиция = снимок конфигурации + цена + человекочитаемое описание.
   ============================================================================= */

   import { el } from './dom.js';
   import { calcPrice, formatPrice } from './price.js';

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

   /** @returns {number} количество позиций */
   export function getCount() {
     return items.length;
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
     const hasOpening = (state.openings || []).some((o) => o && o !== 'fixed');

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
     } = refs;

     const openDialog = () => {
       renderDialog(getItems());
       dialog?.showModal?.();
     };
     const closeDialog = () => dialog?.close?.();

     // Открытие диалога: клик по области сводки (кроме кнопки «Оформить заказ»).
     openEl?.addEventListener('click', openDialog);
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
       // если диалог открыт — обновим и его
       if (dialog?.open) renderDialog(list);
     }

     function renderDialog(list) {
       if (!dialogItems) return;
       dialogItems.innerHTML = '';
       if (list.length === 0) {
         dialogItems.append(
           el('li', { className: 'cart-dialog__empty', textContent: 'Корзина пуста.' })
         );
         // Диалог НЕ закрываем: после оформления заказа тут показывается экран
         // «Спасибо» (см. checkout.js). Закрытие пустого диалога делает пользователь.
       } else {
         list.forEach((item) => dialogItems.append(renderItem(item, currency)));
       }
       if (dialogTotal) dialogTotal.textContent = formatPrice(getTotal(), currency);
     }

     /** Подробная карточка позиции (в диалоге): тип, размер, детали, цена, удаление. */
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

       children.push(
         el('button', {
           className: 'cart-item__remove',
           textContent: 'Удалить',
           attrs: { type: 'button', 'aria-label': `Удалить ${item.title} ${item.size}` },
           onclick: () => removeItem(item.id),
         })
       );

       return el('li', { className: 'cart-item' }, children);
     }

     subscribeCart(renderSummary);
     renderSummary(getItems());
   }
