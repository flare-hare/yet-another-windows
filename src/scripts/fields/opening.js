/* =============================================================================
   ПОЛЕ: Способ открывания — по одной группе на каждую створку окна.
   Число створок берётся из type.sashes. При смене типа группы пересобираются.
   Внутри группы — карточки-радио из data.openingTypes (с описанием).
   ============================================================================= */

import { el } from '../dom.js';

/**
 * Создаёт группу выбора открывания для одной створки.
 * @param {number} sashIndex - индекс створки (0-based)
 * @param {Array} openingTypes - data.openingTypes
 * @param {string} selectedId - выбранный способ
 * @param {(id:string)=>void} onSelect
 * @returns {HTMLElement}
 */
function createSashGroup(sashIndex, openingTypes, selectedId, onSelect) {
  const group = el('div', { className: 'sash-group' });

  // Заголовок группы («Створка 1») — только если створок больше одной,
  // подставляется снаружи; здесь всегда рисуем для единообразия.
  group.append(
    el('span', {
      className: 'sash-group__title',
      textContent: `Створка ${sashIndex + 1}`,
    })
  );

  const options = el('div', { className: 'options options--opening' });
  const groupName = `opening-${sashIndex}`;

  openingTypes.forEach((opt, index) => {
    const inputId = `${groupName}-${opt.id}`;
    const isChecked = selectedId ? opt.id === selectedId : index === 0;

    const input = el('input', {
      className: 'option__input visually-hidden',
      id: inputId,
      checked: isChecked,
      attrs: { type: 'radio', name: groupName, value: opt.id },
    });

    const title = el('span', { className: 'option__title', textContent: opt.name });
    const desc = el('span', { className: 'option__desc', textContent: opt.description });
    const label = el('label', { className: 'option option--wide', htmlFor: inputId }, [
      title,
      desc,
    ]);

    input.addEventListener('change', () => {
      if (input.checked && typeof onSelect === 'function') onSelect(opt.id);
    });

    options.append(input, label);
  });

  group.append(options);
  return group;
}

/**
 * Строит поле «Способ открывания».
 * @param {Object} type - текущий тип окна (нужно type.sashes)
 * @param {Array} openingTypes - data.openingTypes
 * @param {(openings:string[])=>void} onChange - вызывается при любом изменении
 * @returns {{field: HTMLElement, setType: (type:Object)=>void, getOpenings: ()=>string[]}}
 */
export function createOpeningField(type, openingTypes, onChange) {
  const field = el('div', { className: 'field' });
  field.append(el('h3', { className: 'field__label', textContent: 'Способ открывания' }));

  const groupsWrap = el('div', { className: 'sash-groups' });
  field.append(groupsWrap);

  const defaultId = openingTypes[0]?.id ?? null;
  let openings = []; // выбор по створкам

  function render(sashCount) {
    groupsWrap.innerHTML = '';
    // Сохраняем прежние значения, где возможно; недостающие — дефолт
    openings = Array.from({ length: sashCount }, (_, i) => openings[i] ?? defaultId);

    // Заголовки «Створка N» показываем только если створок больше одной
    const showTitles = sashCount > 1;
    groupsWrap.classList.toggle('sash-groups--single', !showTitles);

    openings.forEach((selId, i) => {
      const group = createSashGroup(i, openingTypes, selId, (id) => {
        openings[i] = id;
        onChange([...openings]);
      });
      if (!showTitles) {
        // прячем заголовок «Створка 1» для одностворчатых
        group.querySelector('.sash-group__title')?.classList.add('visually-hidden');
      }
      groupsWrap.append(group);
    });
  }

  render(type.sashes || 1);
  onChange([...openings]);

  function setType(newType) {
    render(newType.sashes || 1);
    onChange([...openings]);
  }

  return { field, setType, getOpenings: () => [...openings] };
}
