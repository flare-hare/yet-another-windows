/* =============================================================================
   МОДУЛЬ: price — расчёт цены окна по ГЕОМЕТРИЧЕСКОЙ модели.
   Чистые функции без DOM (легко тестировать).

   Формула восстановлена из замеров ПО производителя (R²=0.995).
   Подробности и вывод — в src/data/pricing-analysis.md.

   Идея: цена ≈ погонаж_профиля × ставка_профиля
              + площадь × ставка_стекла
              + открывание/фурнитура за каждую открывающуюся створку
              + база.

   Погонаж профиля (метры) = рама + импосты + рамки открывающихся створок:
     рама    = 2 × (Ш + В)
     импосты = (N − 1) × В                       (перегородки между створками)
     рамки   = Σ по открыв. створкам: 2 × (Ш/N + В)   (у глухих рамки нет)

   Створки делятся по ширине ПОРОВНУ: ширина створки = Ш / N.
   Размеры в state — в САНТИМЕТРАХ, внутри переводим в метры.
   ============================================================================= */

/** Находит элемент справочника по id. */
function byId(list, id) {
  return Array.isArray(list) ? list.find((item) => item.id === id) : undefined;
}

/**
 * Геометрия окна из состояния.
 * @param {number} widthCm
 * @param {number} heightCm
 * @param {number} sashes - число створок
 * @param {string[]} openings - id открывания по каждой створке ('fixed' = глухая)
 * @returns {{ area:number, profileMeters:number, openSashes:number }}
 */
function windowGeometry(widthCm, heightCm, sashes, openings) {
  const W = (widthCm || 0) / 100; // м
  const H = (heightCm || 0) / 100; // м
  const N = Math.max(1, sashes || 1);

  const area = W * H; // м²
  const frame = 2 * (W + H); // наружная рама
  const imposts = (N - 1) * H; // вертикальные перегородки между створками

  const sashWidth = W / N;
  // Открывающаяся створка — та, у которой открывание не 'fixed'.
  const openList = Array.isArray(openings) ? openings : [];
  let openSashes = 0;
  for (let i = 0; i < N; i += 1) {
    const opening = openList[i] ?? 'fixed';
    if (opening !== 'fixed') openSashes += 1;
  }
  const sashFrames = openSashes * 2 * (sashWidth + H); // рамки открывающихся створок

  return {
    area,
    profileMeters: frame + imposts + sashFrames,
    openSashes,
  };
}

/**
 * Считает цену и разбивку по конфигурации.
 * @param {import('./state.js').ConfigState} state
 * @param {Object} data - разобранный windows.json
 * @returns {{ total:number, area:number, breakdown:Object }}
 */
export function calcPrice(state, data) {
  const type = byId(data.windowTypes, state.typeId) || {};
  const profile = byId(data.profiles, state.profileId);
  const glazing = byId(data.glazings, state.glazingId);
  const color = byId(data.colors, state.colorId);
  const hardware = byId(data.hardware, state.hardwareId);

  const sashes = type.sashes || 1;
  const geo = windowGeometry(state.width, state.height, sashes, state.openings);

  const base = data.pricing?.base ?? 0;

  // Профиль — по погонным метрам
  const profileRate = profile?.pricePerMeter ?? 0;
  const profilePrice = geo.profileMeters * profileRate;

  // Стеклопакет — по площади
  const glassRate = glazing?.pricePerM2 ?? 0;
  const glassPrice = geo.area * glassRate;

  // Открывание — надбавка за каждую открывающуюся створку
  const openings = Array.isArray(state.openings) ? state.openings : [];
  let openingPrice = 0;
  for (let i = 0; i < sashes; i += 1) {
    const openingId = openings[i] ?? 'fixed';
    const opening = byId(data.openingTypes, openingId);
    openingPrice += opening?.pricePerSash ?? 0;
  }

  // Фурнитура — надбавка за каждую открывающуюся створку
  const hardwareRate = hardware?.pricePerSash ?? 0;
  const hardwarePrice = geo.openSashes * hardwareRate;

  // Доп. опции (пока fixed; появятся позже)
  const extrasPrice = (state.extras || []).reduce((sum, extraId) => {
    const extra = byId(data.extras, extraId);
    return sum + (extra?.price ?? 0);
  }, 0);

  // Промежуточный итог до множителя цвета
  const subtotal = base + profilePrice + glassPrice + openingPrice + hardwarePrice;

  // Цвет — множитель (пока на весь итог; уточним, от чего именно считать)
  const colorMultiplier = color?.multiplier ?? 1;

  const total = subtotal * colorMultiplier + extrasPrice;

  return {
    total: Math.max(0, Math.round(total)),
    area: geo.area,
    breakdown: {
      base,
      profileMeters: Math.round(geo.profileMeters * 100) / 100,
      profile: Math.round(profilePrice),
      glass: Math.round(glassPrice),
      opening: Math.round(openingPrice),
      hardware: Math.round(hardwarePrice),
      openSashes: geo.openSashes,
      colorMultiplier,
      extras: extrasPrice,
      subtotal: Math.round(subtotal),
    },
  };
}

/**
 * Форматирует сумму в рубли: «25 986 ₽» (неразрывные пробелы-разделители).
 * @param {number} amount
 * @param {string} [currency='₽']
 * @returns {string}
 */
export function formatPrice(amount, currency = '₽') {
  const rounded = Math.round(amount || 0);
  return `${rounded.toLocaleString('ru-RU')}\u00A0${currency}`;
}
