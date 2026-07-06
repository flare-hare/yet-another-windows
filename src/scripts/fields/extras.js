/* =============================================================================
   ПОЛЕ: Доп. опции — чекбоксы (можно выбрать несколько) с ценами.
   Цена показывается, только если > 0 (нулевые скрываются).
   ============================================================================= */

   import { el } from '../dom.js';

   /**
    * Форматирует цену: «+1 300 ₽». Возвращает пустую строку, если 0.
    * @param {number} price
    * @param {string} currency
    * @returns {string}
    */
   function formatExtraPrice(price, currency) {
     if (!price || price <= 0) return '';
     // Разряды пробелами (1 300)
     const formatted = price.toLocaleString('ru-RU');
     return `+${formatted} ${currency}`;
   }

   /**
    * Строит поле «Дополнительные опции».
    * @param {Array} extras - data.extras [{ id, name, description, price }]
    * @param {string} currency - символ валюты (data.meta.currency)
    * @param {(selected:string[])=>void} onChange
    * @returns {{field: HTMLElement, getValue: ()=>string[]}}
    */
   export function createExtrasField(extras, currency, onChange) {
     const field = el('div', { className: 'field' });
     field.append(el('h3', { className: 'field__label', textContent: 'Дополнительные опции' }));

     const list = el('div', { className: 'extras' });
     const selected = new Set();

     extras.forEach((extra) => {
       const inputId = `extra-${extra.id}`;
       const input = el('input', {
         className: 'extra__input visually-hidden',
         id: inputId,
         attrs: { type: 'checkbox', name: 'extras', value: extra.id },
       });

       // Галочка-индикатор
       const check = el('span', { className: 'extra__check', attrs: { 'aria-hidden': 'true' } });

       // Тексты
       const title = el('span', { className: 'extra__title', textContent: extra.name });
       const desc = el('span', { className: 'extra__desc', textContent: extra.description });
       const body = el('span', { className: 'extra__body' }, [title, desc]);

       // Цена (скрываем, если 0)
       const priceText = formatExtraPrice(extra.price, currency);
       const price = el('span', { className: 'extra__price', textContent: priceText });

       const label = el('label', { className: 'extra', htmlFor: inputId }, [check, body, price]);

       input.addEventListener('change', () => {
         if (input.checked) {
           selected.add(extra.id);
         } else {
           selected.delete(extra.id);
         }
         if (typeof onChange === 'function') onChange([...selected]);
       });

       list.append(input, label);
     });

     field.append(list);

     return { field, getValue: () => [...selected] };
   }
