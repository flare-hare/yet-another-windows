/* =============================================================================
   МОДУЛЬ: checkout — форма оформления заказа внутри диалога корзины.
   Валидация, сбор данных, генерация номера заказа, показ экрана «Спасибо»,
   очистка корзины. Реальная отправка (PHP-бэкенд) подключается в submitOrder —
   сейчас там заглушка, но payload формируется полноценный.
   ============================================================================= */

import { getItems, getTotal, clearCart } from './cart.js';
import { formatPrice } from './price.js';

/** Простой валидатор телефона (РФ и общий): 10-15 цифр. */
function isValidPhone(value) {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/** Простой валидатор email. */
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
}

/** Генерирует номер заказа вида ОК-250720-4821 (дата + случайные цифры). */
function generateOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rnd = String(Math.floor(1000 + Math.random() * 9000));
  return `ОК-${ymd}-${rnd}`;
}

/**
 * Отправка заказа. СЕЙЧАС — заглушка (эмулирует запрос).
 * Позже заменить на реальный fetch к PHP-бэкенду:
 *
 *   const res = await fetch('order.php', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload),
 *   });
 *   if (!res.ok) throw new Error('network');
 *   return await res.json(); // { ok: true, orderNumber: '...' }
 *
 * @param {Object} payload - данные заказа (контакты + позиции + сумма)
 * @returns {Promise<{ ok: boolean, orderNumber: string }>}
 */
async function submitOrder(payload) {
  const res = await fetch('order.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = await res.json();
  if (!result.ok) throw new Error(result.error || 'submit failed');
  return result;
}

/**
 * Настраивает форму оформления.
 * @param {Object} refs
 * @param {HTMLFormElement} refs.form        - форма [data-order-form]
 * @param {HTMLElement} refs.checkout        - блок «корзина+форма» [data-checkout]
 * @param {HTMLElement} refs.success         - экран успеха [data-checkout-success]
 * @param {HTMLElement} refs.orderNumberEl   - место для номера [data-order-number]
 * @param {HTMLElement} refs.successCloseBtn - кнопка «Готово»
 * @param {HTMLDialogElement} refs.dialog    - диалог (для закрытия)
 * @param {string} [currency='₽']
 */
export function setupCheckout(refs, currency = '₽') {
  const { form, checkout, success, orderNumberEl, successCloseBtn, dialog } = refs;
  if (!form) return;

  const submitBtn = form.querySelector('[data-order-submit]');

  /** Показывает ошибку под полем. */
  function setError(name, message) {
    const errEl = form.querySelector(`[data-error-for="${name}"]`);
    const input = form.querySelector(`[name="${name}"]`);
    if (errEl) errEl.textContent = message || '';
    if (input) input.classList.toggle('field-input__control--invalid', Boolean(message));
  }

  /** Проверяет форму, возвращает данные или null. */
  function validate() {
    const data = Object.fromEntries(new FormData(form).entries());
    let ok = true;

    if (!data.name || data.name.trim().length < 2) {
      setError('name', 'Укажите имя');
      ok = false;
    } else setError('name', '');

    if (!isValidPhone(data.phone)) {
      setError('phone', 'Проверьте номер телефона');
      ok = false;
    } else setError('phone', '');

    if (!isValidEmail(data.email)) {
      setError('email', 'Проверьте email');
      ok = false;
    } else setError('email', '');

    if (!data.consent) {
      setError('consent', 'Необходимо согласие на обработку данных');
      ok = false;
    } else setError('consent', '');

    return ok ? data : null;
  }

  // Убираем ошибку поля при вводе
  form.addEventListener('input', (e) => {
    const name = e.target?.name;
    if (name) setError(name, '');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (getItems().length === 0) return; // защита: пустой заказ не отправляем
    const data = validate();
    if (!data) return;

    const payload = {
      orderNumber: generateOrderNumber(),
      customer: {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email.trim(),
        comment: (data.comment || '').trim(),
        consent: Boolean(data.consent),
      },
      items: getItems().map((it) => ({
        title: it.title,
        size: it.size,
        price: it.price,
        details: it.details,
        config: it.config,
      })),
      total: getTotal(),
      totalFormatted: formatPrice(getTotal(), currency),
      createdAt: new Date().toISOString(),
    };

    // Блокируем кнопку на время отправки
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправляем…';
    }

    try {
      const res = await submitOrder(payload);
      if (!res.ok) throw new Error('submit failed');

      // Успех: показываем экран «Спасибо», чистим корзину
      if (orderNumberEl) orderNumberEl.textContent = res.orderNumber;
      if (checkout) checkout.hidden = true;
      if (success) success.hidden = false;
      clearCart();
      form.reset();
    } catch {
      setError('email', 'Не удалось отправить. Попробуйте ещё раз или позвоните нам.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить заявку';
      }
    }
  });

  // «Готово» на экране успеха — закрыть диалог и вернуть форму
  successCloseBtn?.addEventListener('click', () => {
    dialog?.close?.();
  });

  // При каждом открытии диалога показываем форму, а не экран успеха
  dialog?.addEventListener('close', () => {
    if (checkout) checkout.hidden = false;
    if (success) success.hidden = true;
  });
}
