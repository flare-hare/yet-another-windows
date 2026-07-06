/* =============================================================================
   ХЕЛПЕР: card-field — универсальное поле «заголовок + карточки-радио».
   Используется для однотипных полей (стеклопакет, фурнитура и т.п.).
   Каждая карточка = radio + label (название + описание).
   ============================================================================= */

   import { el } from '../dom.js';

   /**
    * Строит поле выбора из списка вариантов (карточки с описанием).
    * @param {Object} cfg
    * @param {string} cfg.label   - заголовок поля («Стеклопакет»)
    * @param {string} cfg.name    - имя группы radio (уникальное)
    * @param {Array}  cfg.items   - варианты [{ id, name, description }]
    * @param {(id:string)=>void} cfg.onChange
    * @param {string} [cfg.modifier] - модификатор сетки (класс options--*)
    * @returns {{field: HTMLElement, getValue: ()=>string}}
    */
   export function createCardField({ label, name, items, onChange, modifier = '' }) {
     const field = el('div', { className: 'field' });
     field.append(el('h3', { className: 'field__label', textContent: label }));

     const optionsClass = `options options--card${modifier ? ` ${modifier}` : ''}`;
     const options = el('div', { className: optionsClass });

     let selectedId = items[0]?.id ?? null;

     items.forEach((item, index) => {
       const inputId = `${name}-${item.id}`;
       const input = el('input', {
         className: 'option__input visually-hidden',
         id: inputId,
         checked: index === 0,
         attrs: { type: 'radio', name, value: item.id },
       });

       const title = el('span', { className: 'option__title', textContent: item.name });
       const children = [title];
       if (item.description) {
         children.push(el('span', { className: 'option__desc', textContent: item.description }));
       }
       const labelEl = el('label', { className: 'option option--wide', htmlFor: inputId }, children);

       input.addEventListener('change', () => {
         if (input.checked) {
           selectedId = item.id;
           if (typeof onChange === 'function') onChange(item.id);
         }
       });

       options.append(input, labelEl);
     });

     field.append(options);

     return { field, getValue: () => selectedId };
   }
