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
import { setupCart, addItem, buildCartItem } from './cart.js';
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
        modifier: 'options--row',
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

      // Синхрон: открывание из quick actions → панель + скрытие фурнитуры,
      // когда все створки глухие (открывать нечего → фурнитура не нужна).
      openingSyncUnsub?.();
      openingSyncUnsub = subscribe((s) => {
        openingField.syncFromState(s.openings);
        const hasOpening = (s.openings || []).some((o) => o && o !== 'fixed');
        hardwareField.field.hidden = !hasOpening;
      });
      // Применяем сразу для стартового состояния (подписка выше сработает позже).
      hardwareField.field.hidden = !openings.some((o) => o && o !== 'fixed');
    }

    // Отписка для синхрона открывания (пересоздаётся при каждом buildPanel)
    let openingSyncUnsub = null;
    // Ссылка на текущее поле размеров (для синхрона с input на превью)

    // Первое построение
    buildPanel();

    // Корзина: на мобайле/планшете переезжает вниз
    setupCartPosition();

    // Корзина: компактная сводка под превью + диалог с составом (+ localStorage)
    const currency = data.meta?.currency ?? '₽';
    setupCart(
      {
        emptyEl: document.querySelector('[data-cart-empty]'),
        summaryEl: document.querySelector('[data-cart-summary]'),
        openEl: document.querySelector('[data-cart-open]'),
        countEl: document.querySelector('[data-cart-count]'),
        totalEl: document.querySelector('[data-cart-total]'),
        dialog: document.querySelector('[data-cart-dialog]'),
        dialogItems: document.querySelector('[data-cart-items]'),
        dialogTotal: document.querySelector('[data-cart-dialog-total]'),
        dialogClose: document.querySelector('[data-cart-dialog-close]'),
        successEl: document.querySelector('[data-checkout-success]'),
      },
      currency
    );

    // Кнопки «Оформить заказ» (в сводке и в диалоге) — заглушки до формы заявки.
    const checkoutHandler = () => {
      // TODO: следующий шаг — форма заявки (имя, телефон) + отправка
      console.log('Оформить заказ (заглушка)');
    };
    document.querySelector('[data-cart-checkout]')?.addEventListener('click', checkoutHandler);
    document
      .querySelector('[data-cart-checkout-dialog]')
      ?.addEventListener('click', checkoutHandler);

    // Quick actions под превью
    const quickContainer = document.querySelector('[data-quick-actions]');
    setupQuickActions(quickContainer, data, {
      onAddToCart: () => {
        // Переносим текущее окно в корзину, затем сбрасываем конфигуратор
        addItem(buildCartItem(getState(), data));
        buildPanel();
      },
    });

    // Цена текущего окна теперь показывается в quick-actions (под превью),
    // а не в корзине — корзина суммирует только ДОБАВЛЕННЫЕ окна (см. далее).

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
