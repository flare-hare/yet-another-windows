/* =============================================================================
   МОДУЛЬ: quick-actions — быстрые действия под превью.
   Показывает настройки АКТИВНОЙ створки (state.activeSash): способ открывания
   + сторона ручки. Активная створка выбирается шестернёй на превью.
   + кнопки «Сбросить» и «В корзину». Источник правды — state, синхрон с панелью.
   ============================================================================= */

import { el } from './dom.js';
import { getState, setState, subscribe } from './state.js';

const SIDES = [
  { id: 'left', name: 'Слева' },
  { id: 'right', name: 'Справа' },
];

export function setupQuickActions(container, data, handlers = {}) {
  if (!container) return;

  function render(state) {
    const type = data.windowTypes.find((t) => t.id === state.typeId) || data.windowTypes[0];
    const sashes = type.sashes || 1;
    const active = Math.min(state.activeSash ?? 0, sashes - 1);

    container.innerHTML = '';

    // Заголовок активной створки
    const openId = state.openings[active] ?? data.openingTypes[0]?.id;
    const isFixed = openId === 'fixed';
    const side = state.handleSides[active] ?? (active === 0 ? 'right' : 'left');

    const head = el('div', { className: 'quick__head' }, [
      el('span', {
        className: 'quick__head-title',
        textContent: sashes > 1 ? `Створка ${active + 1}` : 'Створка',
      }),
      el('span', {
        className: 'quick__head-hint',
        textContent: sashes > 1 ? 'выберите шестернёй на окне' : '',
      }),
    ]);
    container.append(head);

    // Открывание
    const body = el('div', { className: 'quick__body' });
    body.append(el('span', { className: 'quick__label', textContent: 'Открывание' }));
    body.append(
      buildSegment(
        data.openingTypes.map((o) => ({ id: o.id, name: o.name })),
        openId,
        (id) => {
          const openings = [...getState().openings];
          openings[active] = id;
          setState({ openings });
        }
      )
    );

    // Сторона ручки — только для открывающихся
    if (!isFixed) {
      body.append(el('span', { className: 'quick__label', textContent: 'Сторона ручки' }));
      body.append(
        buildSegment(SIDES, side, (id) => {
          const handleSides = [...getState().handleSides];
          handleSides[active] = id;
          setState({ handleSides });
        })
      );
    }
    container.append(body);

    // Кнопки действий
    container.append(
      el('div', { className: 'quick__actions' }, [
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
      ])
    );
  }

  /** Сегментированный переключатель (кнопки, одна активна). */
  function buildSegment(items, activeId, onSelect) {
    const seg = el('div', { className: 'segment', attrs: { role: 'group' } });
    items.forEach((item) => {
      seg.append(
        el('button', {
          className: `segment__btn${item.id === activeId ? ' segment__btn--active' : ''}`,
          textContent: item.name,
          attrs: { type: 'button', 'aria-pressed': String(item.id === activeId) },
          onclick: () => onSelect(item.id),
        })
      );
    });
    return seg;
  }

  render(getState());
  subscribe(render);
}
