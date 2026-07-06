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
   import { setupCartPosition } from './cart-position.js';
   import { setupHowto } from './howto.js';
   import { setupQuickActions } from './quick-actions.js';

   /** Сторона ручки по умолчанию для каждой створки. */
   function defaultHandleSides(count) {
     return Array.from({ length: count }, (_, i) => (i === 0 ? 'right' : 'left'));
   }

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

       /**
        * Строит (или пересобирает) все поля панели с дефолтными значениями
        * и выставляет стартовое состояние. Вызывается при старте и при сбросе.
        */
       function buildPanel() {
         panel.innerHTML = '';

         const startType = data.windowTypes.find((t) => t.available !== false) || data.windowTypes[0];

         const sizeField = createSizeField(startType, (size) => {
           setState({ width: size.width, height: size.height });
         });

         const openingField = createOpeningField(startType, data.openingTypes, (openings) => {
           setState({ openings });
         });

         const profileField = createProfileField(data.profiles, data.colors, (sel) => {
           setState({ profileId: sel.profileId, colorId: sel.colorId });
         });

         const glazingField = createCardField({
           label: 'Стеклопакет',
           name: 'glazing',
           items: data.glazings,
           onChange: (id) => setState({ glazingId: id }),
         });

         const hardwareField = createCardField({
           label: 'Фурнитура',
           name: 'hardware',
           items: data.hardware,
           onChange: (id) => setState({ hardwareId: id }),
         });

         const currency = data.meta?.currency ?? '₽';
         const extrasField = createExtrasField(data.extras, currency, (extras) => {
           setState({ extras });
         });

         const windowTypeField = createWindowTypeField(data.windowTypes, (typeId) => {
           const type = data.windowTypes.find((t) => t.id === typeId);
           setState({ typeId });
           sizeField.setType(type);
           openingField.setType(type);
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
         const openings = openingField.getOpenings();
         setState({
           typeId: startType.id,
           width: startSize.width,
           height: startSize.height,
           openings,
           handleSides: defaultHandleSides(openings.length),
           profileId: startProfile.profileId,
           colorId: startProfile.colorId,
           glazingId: glazingField.getValue(),
           hardwareId: hardwareField.getValue(),
           extras: extrasField.getValue(),
         });

         // Синхрон: открывание из quick actions → панель
         openingSyncUnsub?.();
         openingSyncUnsub = subscribe((s) => openingField.syncFromState(s.openings));
       }

       // Отписка для синхрона открывания (пересоздаётся при каждом buildPanel)
       let openingSyncUnsub = null;

       // Первое построение
       buildPanel();

       // Корзина: на мобайле/планшете переезжает вниз
       setupCartPosition();

       // Quick actions под превью
       const quickContainer = document.querySelector('[data-quick-actions]');
       setupQuickActions(quickContainer, data, {
         onReset: () => buildPanel(), // полный сброс = пересборка панели с дефолтами
         onAddToCart: () => {
           console.log('Добавить в корзину (заглушка):', getState());
         },
       });

       // --- Превью окна: перерисовка при изменении state и при ресайзе ---
       const previewContainer = document.querySelector('[data-window-preview]');
       const selectSash = (index) => setState({ activeSash: index });
       const drawPreview = () => renderWindowPreview(previewContainer, getState(), data, selectSash);

       subscribe(drawPreview);
       drawPreview();

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

   document.addEventListener('DOMContentLoaded', () => {
     setupHowto();
     initConstructor();
   });
