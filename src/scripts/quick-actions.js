/* =============================================================================
   МОДУЛЬ: quick-actions — быстрые действия под превью.
   Для каждой створки: способ открывания + сторона ручки.
   + кнопки «Сбросить» и «Добавить в корзину» (заглушка).
   Источник правды — state (openings, handleSides). Синхронизируется с панелью:
   пишет в state и перерисовывается при внешних изменениях (подписка).
   ============================================================================= */

   import { el } from './dom.js';
   import { getState, setState, subscribe } from './state.js';

   const SIDES = [
     { id: 'left', name: 'Слева' },
     { id: 'right', name: 'Справа' },
   ];

   /**
    * Строит панель быстрых действий.
    * @param {HTMLElement} container - [data-quick-actions]
    * @param {Object} data - данные (windowTypes, openingTypes)
    * @param {Object} handlers - { onReset: fn, onAddToCart: fn }
    */
   export function setupQuickActions(container, data, handlers = {}) {
     if (!container) return;

     function render(state) {
       const type = data.windowTypes.find((t) => t.id === state.typeId) || data.windowTypes[0];
       const sashes = type.sashes || 1;

       container.innerHTML = '';

       // Группы по створкам
       const groups = el('div', { className: 'quick__groups' });
       for (let i = 0; i < sashes; i += 1) {
         groups.append(buildSashControls(i, sashes, state, data));
       }
       container.append(groups);

       // Действия
       const actions = el('div', { className: 'quick__actions' }, [
         el('button', {
           className: 'btn btn--ghost quick__btn',
           textContent: 'Сбросить',
           attrs: { type: 'button' },
           onclick: () => handlers.onReset?.(),
         }),
         el('button', {
           className: 'btn btn--primary quick__btn',
           textContent: 'В корзину',
           attrs: { type: 'button' },
           onclick: () => handlers.onAddToCart?.(),
         }),
       ]);
       container.append(actions);
     }

     /** Контролы одной створки: открывание (segmented) + сторона ручки. */
     function buildSashControls(index, sashCount, state, data) {
       const group = el('div', { className: 'quick__group' });

       if (sashCount > 1) {
         group.append(
           el('span', { className: 'quick__group-title', textContent: `Створка ${index + 1}` })
         );
       }

       // Открывание — сегментированный переключатель
       const openId = state.openings[index] ?? data.openingTypes[0]?.id;
       const openSeg = buildSegment(
         data.openingTypes.map((o) => ({ id: o.id, name: o.name })),
         openId,
         (id) => {
           const openings = [...getState().openings];
           openings[index] = id;
           setState({ openings });
         }
       );
       group.append(el('div', { className: 'quick__row' }, [openSeg]));

       // Сторона ручки — только для открывающихся створок
       if (openId !== 'fixed') {
         const side = state.handleSides[index] ?? (index === 0 ? 'right' : 'left');
         const sideSeg = buildSegment(SIDES, side, (id) => {
           const handleSides = [...getState().handleSides];
           handleSides[index] = id;
           setState({ handleSides });
         });
         const label = el('span', { className: 'quick__hint', textContent: 'Ручка' });
         group.append(el('div', { className: 'quick__row' }, [label, sideSeg]));
       }

       return group;
     }

     /** Сегментированный переключатель (набор кнопок, одна активна). */
     function buildSegment(items, activeId, onSelect) {
       const seg = el('div', { className: 'segment', attrs: { role: 'group' } });
       items.forEach((item) => {
         const btn = el('button', {
           className: `segment__btn${item.id === activeId ? ' segment__btn--active' : ''}`,
           textContent: item.name,
           attrs: { type: 'button', 'aria-pressed': String(item.id === activeId) },
           onclick: () => onSelect(item.id),
         });
         seg.append(btn);
       });
       return seg;
     }

     // Первичная отрисовка + подписка на изменения state (синхрон с панелью)
     render(getState());
     subscribe(render);
   }
