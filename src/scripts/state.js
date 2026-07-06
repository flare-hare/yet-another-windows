/* =============================================================================
   МОДУЛЬ: state — состояние конфигуратора + подписка на изменения.
   Простой «стор»: хранит текущий выбор, оповещает подписчиков при изменении.
   ============================================================================= */

/**
 * @typedef {Object} ConfigState
 * @property {string} typeId    - id выбранного типа окна
 * @property {number} width     - ширина, см
 * @property {number} height    - высота, см
 * @property {string[]} openings - id способа открывания по каждой створке
 * @property {string} profileId - id профиля
 * @property {string} colorId   - id цвета
 * @property {string} glazingId - id стеклопакета
 * @property {string} hardwareId- id фурнитуры
 * @property {string[]} extras  - id выбранных доп. опций
 */

/** @type {ConfigState} */
const state = {
  typeId: null,
  width: 0,
  height: 0,
  openings: [],
  profileId: null,
  colorId: null,
  glazingId: null,
  hardwareId: null,
  extras: [],
};

/** Список подписчиков (функций), которых зовём при изменении. */
const listeners = new Set();

/**
 * Возвращает копию текущего состояния (чтобы снаружи не мутировали напрямую).
 * @returns {ConfigState}
 */
export function getState() {
  return { ...state };
}

/**
 * Обновляет состояние и оповещает подписчиков.
 * @param {Partial<ConfigState>} patch - поля для изменения
 */
export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(getState()));
}

/**
 * Подписаться на изменения состояния.
 * @param {(state: ConfigState) => void} fn
 * @returns {() => void} функция отписки
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
