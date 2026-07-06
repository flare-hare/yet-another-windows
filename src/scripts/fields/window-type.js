/* =============================================================================
   ПОЛЕ: Тип окна — карточки-радиокнопки из data.windowTypes.
   Иконки берутся из внешнего SVG-спрайта через <use href="...#id">.
   Типы с available === false рисуются как «скоро» (недоступны для выбора).
   ============================================================================= */

import { el } from '../dom.js';

const SPRITE = 'images/svg/sprite.svg';
const SVGNS = 'http://www.w3.org/2000/svg';
const XLINKNS = 'http://www.w3.org/1999/xlink';

/**
 * Создаёт SVG-иконку, ссылающуюся на <symbol> в спрайте.
 * @param {string} iconId - id символа (совпадает с id типа окна)
 * @returns {SVGSVGElement}
 */
function spriteIcon(iconId) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'option__icon-svg');
  svg.setAttribute('aria-hidden', 'true');

  const use = document.createElementNS(SVGNS, 'use');
  const href = `${SPRITE}#${iconId}`;
  use.setAttribute('href', href);
  // Fallback для старых браузеров (Safari)
  use.setAttributeNS(XLINKNS, 'xlink:href', href);

  svg.append(use);
  return svg;
}

/**
 * Строит поле выбора типа окна.
 * @param {Array} windowTypes - массив data.windowTypes
 * @param {(typeId: string) => void} [onChange] - колбэк при выборе
 * @returns {HTMLElement} готовый блок поля
 */
export function createWindowTypeField(windowTypes, onChange) {
  const field = el('div', { className: 'field' });
  field.append(el('h3', { className: 'field__label', textContent: 'Тип окна' }));

  const options = el('div', { className: 'field__options options options--type' });

  // Первый доступный тип — выбран по умолчанию
  const firstAvailableIndex = windowTypes.findIndex((t) => t.available !== false);

  windowTypes.forEach((type, index) => {
    const isAvailable = type.available !== false;
    const inputId = `window-type-${type.id}`;

    const input = el('input', {
      className: 'option__input visually-hidden',
      id: inputId,
      attrs: {
        type: 'radio',
        name: 'window-type',
        value: type.id,
      },
      checked: index === firstAvailableIndex,
      disabled: !isAvailable,
    });

    const icon = el('span', { className: 'option__icon' }, [spriteIcon(type.id)]);
    const title = el('span', { className: 'option__title', textContent: type.name });
    const desc = el('span', { className: 'option__desc', textContent: type.description });

    const labelChildren = [icon, title, desc];

    // Бейдж «скоро» для недоступных типов
    if (!isAvailable) {
      labelChildren.push(el('span', { className: 'option__badge', textContent: 'скоро' }));
    }

    const label = el(
      'label',
      {
        className: isAvailable ? 'option' : 'option option--disabled',
        htmlFor: inputId,
      },
      labelChildren
    );

    input.addEventListener('change', () => {
      if (input.checked && typeof onChange === 'function') {
        onChange(type.id);
      }
    });

    options.append(input, label);
  });

  field.append(options);
  return field;
}
