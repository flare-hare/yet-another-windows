/* =============================================================================
   МОДУЛЬ: dom — маленькие помощники для создания элементов
   ============================================================================= */

/**
 * Создаёт DOM-элемент с атрибутами и детьми.
 * @param {string} tag - имя тега (например 'div')
 * @param {Object} [props] - свойства: className, textContent, dataset, attrs и т.д.
 * @param {Array<Node|string>} [children] - дочерние узлы или строки
 * @returns {HTMLElement}
 *
 * Пример:
 *   el('button', { className: 'btn', textContent: 'ОК' })
 *   el('div', { className: 'card' }, [icon, title])
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (key === 'className') {
      node.className = value;
    } else if (key === 'textContent') {
      node.textContent = value;
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key === 'attrs') {
      // произвольные атрибуты: { type: 'radio', name: 'x' }
      for (const [attr, val] of Object.entries(value)) {
        node.setAttribute(attr, val);
      }
    } else {
      // остальное — как свойство узла (id, value, checked, htmlFor и т.п.)
      node[key] = value;
    }
  }

  for (const child of children) {
    node.append(child); // append принимает и Node, и строку
  }

  return node;
}
