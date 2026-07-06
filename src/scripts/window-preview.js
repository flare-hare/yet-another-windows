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
   export function buildWindowEl({
     width,
     height,
     sashes,
     frameColor,
     openings,
     handleSides = [],
     activeSash = 0,
     onSashSelect,
     avail,
   }) {
     // Обёртка: рама сверху + ряд шестерён снизу (шестерни ВНЕ рамы)
     const wrap = el('div', { className: 'win-wrap' });

     const frame = el('div', {
       className: 'win',
       attrs: {
         role: 'img',
         'aria-label': `Окно ${width}×${height} см, створок: ${sashes}`,
       },
     });

     // Вписываем окно в доступную область сцены с сохранением пропорций.
     // avail = { w, h } — размеры ПУСТОЙ сцены (замерены до вставки окна,
     // поэтому нет обратной связи «окно раздувает сцену → сцена раздувает окно»).
     const aspectRatio = width / height;
     if (avail && avail.w > 0 && avail.h > 0) {
       let winW = avail.h * aspectRatio;
       let winH = avail.h;
       if (winW > avail.w) {
         winW = avail.w;
         winH = avail.w / aspectRatio;
       }
       frame.style.width = `${winW}px`;
       frame.style.height = `${winH}px`;
     }
     frame.style.setProperty('--frame-color', frameColor);

     // Ряд шестерён под рамой (flex, каждая под своей створкой)
     const gears = el('div', { className: 'win__gears' });

     for (let i = 0; i < sashes; i += 1) {
       const openingId = openings[i] ?? 'fixed';
       const isFixed = openingId === 'fixed';
       const handleSide = handleSides[i] ?? (i === 0 ? 'right' : 'left');
       const isActive = i === activeSash;

       const glass = el('div', { className: 'win__glass' });
       glass.append(createAxisSvg(openingId, handleSide));

       // Створка: глухая — стекло в проёме; открывающаяся — рамка+стекло+ручка
       let sash;
       if (isFixed) {
         sash = el(
           'div',
           {
             className: `win__cell${isActive ? ' win__cell--active' : ''}`,
             dataset: { sash: String(i) },
           },
           [glass]
         );
       } else {
         const handle = el('div', { className: `win__handle win__handle--${handleSide}` });
         sash = el(
           'div',
           {
             className: `win__sash win__cell win__sash--${openingId}${isActive ? ' win__cell--active' : ''}`,
             dataset: { opening: openingId, handle: handleSide, sash: String(i) },
           },
           [glass, handle]
         );
       }
       frame.append(sash);

       // Шестерня под этой створкой (в отдельном ряду под рамой)
       const gear = el('button', {
         className: `win__gear${isActive ? ' win__gear--active' : ''}`,
         attrs: {
           type: 'button',
           'aria-label': `Настроить створку ${i + 1}`,
           'aria-pressed': String(isActive),
         },
       });
       gear.innerHTML =
         '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
       if (typeof onSashSelect === 'function') {
         gear.addEventListener('click', () => onSashSelect(i));
       }
       gears.append(gear);
     }

     wrap.append(frame, gears);
     return wrap;
   }

   /**
    * Рендерит окно в контейнер по состоянию.
    */
   export function renderWindowPreview(container, state, data, onSashSelect) {
     if (!container) return;
     const type = data.windowTypes.find((t) => t.id === state.typeId) || data.windowTypes[0];
     const color = data.colors.find((c) => c.id === state.colorId) || data.colors[0];

     // Сначала очищаем сцену, ЗАТЕМ замеряем её (пустую) — так окно внутри не
     // раздувает контейнер, и нет порочного цикла при ресайзе.
     container.innerHTML = '';
     const cs = getComputedStyle(container);
     const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
     const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
     const avail = {
       w: container.clientWidth - padX,
       h: container.clientHeight - padY,
     };

     const win = buildWindowEl({
       width: state.width,
       height: state.height,
       sashes: type.sashes || 1,
       frameColor: color.hex,
       openings: state.openings,
       handleSides: state.handleSides,
       activeSash: state.activeSash ?? 0,
       onSashSelect,
       avail,
     });

     container.append(win);
   }
