/* =============================================================================
   Конструктор окон — точка входа JS (ES-модуль).
   Оркестрация: грузим данные, строим поля, связываем через state.
   ============================================================================= */

   import { loadWindowsData } from './data.js';
   import { getState, setState, subscribe } from './state.js';
   import { createWindowTypeField } from './fields/window-type.js';
   import { createSizeField } from './fields/size.js';
   import { createOpeningField } from './fields/opening.js';
   import { createProfileField } from './fields/profile.js';
   import { createCardField } from './fields/card-field.js';
   import { createExtrasField } from './fields/extras.js';
   import { renderWindowPreview } from './window-preview.js';

   /**
    * Инициализация конструктора.
    */
   async function initConstructor() {
     const panel = document.querySelector('[data-config-panel]');

     try {
       const data = await loadWindowsData();

       if (!panel) {
         console.warn('Панель конструктора не найдена в разметке.');
         return;
       }

       panel.innerHTML = '';

       // Первый доступный тип — стартовый
       const startType = data.windowTypes.find((t) => t.available !== false) || data.windowTypes[0];

       // Поле «Размеры» (умеет менять диапазоны при смене типа)
       const sizeField = createSizeField(startType, (size) => {
         setState({ width: size.width, height: size.height });
       });

       // Поле «Способ открывания» (по створкам)
       const openingField = createOpeningField(startType, data.openingTypes, (openings) => {
         setState({ openings });
       });

       // Поле «Профиль + Цвет»
       const profileField = createProfileField(data.profiles, data.colors, (sel) => {
         setState({ profileId: sel.profileId, colorId: sel.colorId });
       });

       // Поле «Стеклопакет»
       const glazingField = createCardField({
         label: 'Стеклопакет',
         name: 'glazing',
         items: data.glazings,
         onChange: (id) => setState({ glazingId: id }),
       });

       // Поле «Фурнитура»
       const hardwareField = createCardField({
         label: 'Фурнитура',
         name: 'hardware',
         items: data.hardware,
         onChange: (id) => setState({ hardwareId: id }),
       });

       // Поле «Дополнительные опции»
       const currency = data.meta?.currency ?? '₽';
       const extrasField = createExtrasField(data.extras, currency, (extras) => {
         setState({ extras });
       });

       // Поле «Тип окна»
       const windowTypeField = createWindowTypeField(data.windowTypes, (typeId) => {
         const type = data.windowTypes.find((t) => t.id === typeId);
         setState({ typeId });
         sizeField.setType(type); // размеры подстраиваются под новый тип
         openingField.setType(type); // группы створок пересобираются
       });

       panel.append(
         windowTypeField,
         sizeField.field,
         openingField.field,
         profileField.field,
         glazingField.field,
         hardwareField.field,
         extrasField.field
       );

       // Стартовое состояние
       const startSize = sizeField.getSize();
       const startProfile = profileField.getValue();
       setState({
         typeId: startType.id,
         width: startSize.width,
         height: startSize.height,
         openings: openingField.getOpenings(),
         profileId: startProfile.profileId,
         colorId: startProfile.colorId,
         glazingId: glazingField.getValue(),
         hardwareId: hardwareField.getValue(),
         extras: extrasField.getValue(),
       });

       // --- Превью окна: перерисовываем при изменении состояния и при ресайзе ---
       const previewContainer = document.querySelector('[data-window-preview]');
       const drawPreview = () => renderWindowPreview(previewContainer, getState(), data);

       subscribe(drawPreview);
       drawPreview(); // первичная отрисовка

       // Пересчёт размеров окна при изменении ширины сцены (debounce через rAF)
       let resizeScheduled = false;
       window.addEventListener('resize', () => {
         if (resizeScheduled) return;
         resizeScheduled = true;
         requestAnimationFrame(() => {
           resizeScheduled = false;
           drawPreview();
         });
       });
     } catch (error) {
       console.error('❌ Ошибка инициализации конструктора:', error);
       if (panel) {
         panel.innerHTML = '';
         panel.append(
           Object.assign(document.createElement('p'), {
             className: 'panel__error',
             textContent: 'Не удалось загрузить конфигуратор. Обновите страницу.',
           })
         );
       }
     }
   }

   document.addEventListener('DOMContentLoaded', initConstructor);
