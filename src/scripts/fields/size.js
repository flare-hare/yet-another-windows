/* =============================================================================
   ПОЛЕ: Размеры — две отдельные карточки-слайдера (Ширина, Высота) в ряд.
   Каждая карточка: заголовок «Ширина» + редактируемое значение (input number),
   SVG-линейка с насечками (каждая 5-я длиннее), кнопки [−]/[＋].
   Значения в см; диапазоны из constraints выбранного типа.
   ============================================================================= */

import { el } from '../dom.js';

const STEP = 1; // шаг, см
const BARS = 19; // число насечек-баров на линейке

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Создаёт карточку одного размера (ширина ИЛИ высота).
 * @returns {{card: HTMLElement, setRange: (min:number,max:number,value:number)=>void}}
 */
function createSizeCard({ name, min, max, value, onInput }) {
  let curMin = min;
  let curMax = max;
  let curVal = clamp(value, min, max);

  // Заголовок: имя + редактируемое значение (input number, свои стрелки)
  const nameEl = el('span', { className: 'size-card__name', textContent: name });

  const valueInput = el('input', {
    className: 'size-card__input',
    value: String(curVal),
    attrs: {
      type: 'number',
      min: String(min),
      max: String(max),
      inputmode: 'numeric',
      'aria-label': `${name}, см`,
    },
  });
  const unit = el('span', { className: 'size-card__unit', textContent: 'см' });
  const valueBox = el('span', { className: 'size-card__value' }, [valueInput, unit]);
  const head = el('div', { className: 'size-card__head' }, [nameEl, valueBox]);

  // Бегунок-ромб (без заполнения — только thumb бежит по треку)
  const thumb = el('div', { className: 'slider__thumb' });
  const track = el('div', { className: 'slider__track' });

  // Линейка с насечками: min + BARS баров + max в одном flex-контейнере
  const minLabel = el('span', { className: 'slider__min', textContent: String(curMin) });
  const maxLabel = el('span', { className: 'slider__max', textContent: String(curMax) });
  const rullerChildren = [minLabel];
  for (let i = 0; i < BARS; i += 1) {
    rullerChildren.push(el('div', { className: 'slider__bar' }));
  }
  rullerChildren.push(maxLabel);
  const ruller = el('div', { className: 'slider__ruller' }, rullerChildren);

  // Слайдер = колонка: thumb (сверху) + track + линейка (снизу)
  const slider = el(
    'div',
    {
      className: 'slider',
      attrs: { role: 'slider', tabindex: '0', 'aria-label': name },
    },
    [thumb, track, ruller]
  );

  // Кнопки −/＋
  const btnMinus = el('button', {
    className: 'stepper stepper--minus',
    textContent: '−',
    attrs: { type: 'button', 'aria-label': `Уменьшить: ${name.toLowerCase()}` },
  });
  const btnPlus = el('button', {
    className: 'stepper stepper--plus',
    textContent: '+',
    attrs: { type: 'button', 'aria-label': `Увеличить: ${name.toLowerCase()}` },
  });

  const controls = el('div', { className: 'size-card__controls' }, [btnMinus, slider, btnPlus]);
  const card = el('div', { className: 'size-card' }, [head, controls]);

  // force=true — обновить значение поля даже когда оно в фокусе
  // (нужно для стрелок ↑↓ и кнопок; при ручном наборе force=false,
  //  чтобы не мешать вводу и не двигать курсор).
  function paint(force = false) {
    const percent = curMax === curMin ? 0 : ((curVal - curMin) / (curMax - curMin)) * 100;
    thumb.style.left = `calc(${percent}% - (${8 / 100}px * ${percent}) + ${(5 - (percent / 100) * 10)}px`;
    if (force || document.activeElement !== valueInput) {
      valueInput.value = String(curVal);
    }
    slider.setAttribute('aria-valuenow', String(curVal));
    slider.setAttribute('aria-valuemin', String(curMin));
    slider.setAttribute('aria-valuemax', String(curMax));
  }

  function apply(next, notify = true, force = false) {
    curVal = clamp(Math.round(next), curMin, curMax);
    paint(force);
    if (notify && typeof onInput === 'function') onInput(curVal);
  }

  function valueFromPointer(clientX) {
    const rect = track.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return curMin + ratio * (curMax - curMin);
  }

  // Перетаскивание (кликаем по всей области слайдера)
  let dragging = false;
  slider.addEventListener('pointerdown', (e) => {
    dragging = true;
    slider.setPointerCapture(e.pointerId);
    apply(valueFromPointer(e.clientX));
  });
  slider.addEventListener('pointermove', (e) => {
    if (dragging) apply(valueFromPointer(e.clientX));
  });
  slider.addEventListener('pointerup', () => {
    dragging = false;
  });

  // Клавиши на слайдере
  slider.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      apply(curVal - STEP);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      apply(curVal + STEP);
      e.preventDefault();
    }
  });

  btnMinus.addEventListener('click', () => apply(curVal - STEP, true, true));
  btnPlus.addEventListener('click', () => apply(curVal + STEP, true, true));

  // Ручной ввод (force=false: не трогаем поле, чтобы не сбить курсор)
  valueInput.addEventListener('input', () => {
    const parsed = parseInt(valueInput.value, 10);
    if (!Number.isNaN(parsed)) apply(parsed, true, false);
  });
  // Стрелки в поле значения (force=true: значение обновляется сразу)
  valueInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      apply(curVal + STEP, true, true);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      apply(curVal - STEP, true, true);
      e.preventDefault();
    }
  });
  // На blur — привести поле к валидному значению (напр. если ввели за границу)
  valueInput.addEventListener('blur', () => apply(curVal, true, true));

  paint();

  function setRange(newMin, newMax, newValue) {
    curMin = newMin;
    curMax = newMax;
    valueInput.setAttribute('min', String(newMin));
    valueInput.setAttribute('max', String(newMax));
    minLabel.textContent = String(newMin);
    maxLabel.textContent = String(newMax);
    apply(newValue ?? curVal, true, true);
  }

  return { card, setRange };
}

/**
 * Строит поле «Размеры» — заголовок + ряд из двух карточек (Ширина, Высота).
 * @returns {{field: HTMLElement, setType: (type:Object)=>void, getSize: ()=>Object}}
 */
export function createSizeField(type, onChange) {
  const field = el('div', { className: 'field field--size' });
  field.append(el('h3', { className: 'field__label', textContent: 'Размеры' }));

  const c = type.constraints;
  const start = type.defaultSizes?.[0] || { width: c.minWidth, height: c.minHeight };
  const size = { width: start.width, height: start.height };

  const widthCard = createSizeCard({
    name: 'Ширина',
    min: c.minWidth,
    max: c.maxWidth,
    value: size.width,
    onInput: (v) => {
      size.width = v;
      onChange({ ...size });
    },
  });

  const heightCard = createSizeCard({
    name: 'Высота',
    min: c.minHeight,
    max: c.maxHeight,
    value: size.height,
    onInput: (v) => {
      size.height = v;
      onChange({ ...size });
    },
  });

  // Ряд карточек
  const row = el('div', { className: 'size-cards' }, [widthCard.card, heightCard.card]);
  field.append(row);

  function setType(newType) {
    const nc = newType.constraints;
    const ns = newType.defaultSizes?.[0] || { width: nc.minWidth, height: nc.minHeight };
    size.width = ns.width;
    size.height = ns.height;
    widthCard.setRange(nc.minWidth, nc.maxWidth, ns.width);
    heightCard.setRange(nc.minHeight, nc.maxHeight, ns.height);
    onChange({ ...size });
  }

  return { field, setType, getSize: () => ({ ...size }) };
}
