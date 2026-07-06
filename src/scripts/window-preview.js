/* =============================================================================
   МОДУЛЬ: window-preview — отрисовка окна на DIV.
   Иерархия: рама → [створка → стекло | стекло] (комбинации в одной раме).
   Рама/створка прозрачные (виден polka dot), «профиль» рисуется тенями.
   На стекле — SVG-линии оси открывания (/\ откидное, > ручка справа,
   < ручка слева, + глухое).
   ============================================================================= */

import { el } from './dom.js';

const SVGNS = 'http://www.w3.org/2000/svg';

/**
 * Рисует линии оси открывания поверх стекла.
 * @param {string} openingId - 'fixed' | 'tilt' | 'turn-tilt'
 * @param {string} handleSide - 'left' | 'right' (для поворотной оси)
 * @returns {SVGSVGElement}
 */
function createAxisSvg(openingId, handleSide) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'win__axis');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const line = (x1, y1, x2, y2) => {
    const l = document.createElementNS(SVGNS, 'line');
    l.setAttribute('x1', x1);
    l.setAttribute('y1', y1);
    l.setAttribute('x2', x2);
    l.setAttribute('y2', y2);
    l.setAttribute('class', 'win__axis-line');
    l.setAttribute('vector-effect', 'non-scaling-stroke');
    return l;
  };

  if (openingId === 'fixed') {
    // Перекрестье в центре, ~50% ширины (+)
    svg.append(line(25, 50, 75, 50), line(50, 25, 50, 75));
  } else if (openingId === 'tilt') {
    // Откидное: ось сверху → /\ (из нижних углов к центру верха)
    svg.append(line(0, 100, 50, 0), line(100, 100, 50, 0));
  } else {
    // Поворотное / поворотно-откидное: ось со стороны петель (противоположна ручке)
    if (handleSide === 'right') {
      // петли слева → > (из левых углов к центру правой стороны)
      svg.append(line(0, 0, 100, 50), line(0, 100, 100, 50));
      if (openingId === 'turn-tilt') svg.append(line(0, 100, 50, 0), line(100, 100, 50, 0));
    } else {
      // петли справа → < (из правых углов к центру левой стороны)
      svg.append(line(100, 0, 0, 50), line(100, 100, 0, 50));
      if (openingId === 'turn-tilt') svg.append(line(0, 100, 50, 0), line(100, 100, 50, 0));
    }
  }
  return svg;
}

/**
 * Строит DOM окна.
 * @returns {HTMLElement}
 */
export function buildWindowEl({ width, height, sashes, frameColor, openings }) {
  const frame = el('div', {
    className: 'win',
    attrs: {
      role: 'img',
      'aria-label': `Окно ${width}×${height} см, створок: ${sashes}`,
    },
  });
  const aspectRatio = width / height;
  const parent = document.querySelector('.preview__stage');
  const parentWidth = parent.clientWidth - 64;
  const parentHeight = parent.clientHeight - 64;
  let windowWidth = parentHeight * aspectRatio;
  let windowHeight = parentHeight;
  if (windowWidth > parentWidth) {
    windowWidth = parentWidth;
    windowHeight = windowWidth / aspectRatio;
  }
  frame.style.height = `${windowHeight}px`;
  frame.style.width = `${windowWidth}px`;
  console.log(`${width} x ${height} : ${windowWidth} x ${windowHeight}`);
  frame.style.setProperty('--frame-color', frameColor);

  for (let i = 0; i < sashes; i += 1) {
    const openingId = openings[i] ?? 'fixed';
    const isFixed = openingId === 'fixed';

    // Сторона ручки: временно — 1-я створка справа, остальные слева
    const handleSide = i === 0 ? 'right' : 'left';

    const glass = el('div', { className: 'win__glass' });
    glass.append(createAxisSvg(openingId, handleSide));

    if (isFixed) {
      // Глухое: стекло прямо в раме
      frame.append(glass);
    } else {
      // Открывающееся: створка → стекло + ручка
      const handle = el('div', { className: `win__handle win__handle--${handleSide}` });
      const sash = el(
        'div',
        {
          className: `win__sash win__sash--${openingId}`,
          dataset: { opening: openingId, handle: handleSide },
        },
        [glass, handle]
      );
      frame.append(sash);
    }
  }

  return frame;
}

/**
 * Рендерит окно в контейнер по состоянию.
 */
export function renderWindowPreview(container, state, data) {
  if (!container) return;
  const type = data.windowTypes.find((t) => t.id === state.typeId) || data.windowTypes[0];
  const color = data.colors.find((c) => c.id === state.colorId) || data.colors[0];

  const win = buildWindowEl({
    width: state.width,
    height: state.height,
    sashes: type.sashes || 1,
    frameColor: color.hex,
    openings: state.openings,
  });

  container.innerHTML = '';
  container.append(win);
}
