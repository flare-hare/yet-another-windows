/* =============================================================================
   ПОЛЕ: Профиль + Цвет — одна секция.
   Сверху 3 карточки профиля (Эконом/Стандарт/Премиум), разделитель,
   ниже — образцы цвета (кружок + название).
   ============================================================================= */

import { el } from '../dom.js';

/**
 * Строит блок выбора профиля (карточки в ряд).
 * @returns {HTMLElement}
 */
function buildProfiles(profiles, onSelect) {
  const options = el('div', { className: 'options options--profile' });

  profiles.forEach((profile, index) => {
    const inputId = `profile-${profile.id}`;
    const input = el('input', {
      className: 'option__input visually-hidden',
      id: inputId,
      checked: index === 0,
      attrs: { type: 'radio', name: 'profile', value: profile.id },
    });

    const title = el('span', { className: 'option__title', textContent: profile.name });
    const desc = el('span', { className: 'option__desc', textContent: profile.description });
    const meta = el('span', {
      className: 'option__meta',
      textContent: `${profile.chambers} камеры`,
    });
    const label = el('label', { className: 'option option--profile', htmlFor: inputId }, [
      title,
      meta,
      desc,
    ]);

    input.addEventListener('change', () => {
      if (input.checked && typeof onSelect === 'function') onSelect(profile.id);
    });

    options.append(input, label);
  });

  return options;
}

/**
 * Строит блок выбора цвета (кружок-образец + название).
 * @returns {HTMLElement}
 */
function buildColors(colors, onSelect) {
  const wrap = el('div', { className: 'swatches' });

  colors.forEach((color, index) => {
    const inputId = `color-${color.id}`;
    const input = el('input', {
      className: 'swatch__input visually-hidden',
      id: inputId,
      checked: index === 0,
      attrs: { type: 'radio', name: 'color', value: color.id },
    });

    // Кружок-образец: цвет задаём инлайново (значение из данных)
    const dot = el('span', { className: 'swatch__dot' });
    dot.style.backgroundColor = color.hex;

    const name = el('span', { className: 'swatch__name', textContent: color.name });
    const label = el('label', { className: 'swatch', htmlFor: inputId }, [dot, name]);

    input.addEventListener('change', () => {
      if (input.checked && typeof onSelect === 'function') onSelect(color.id);
    });

    wrap.append(input, label);
  });

  return wrap;
}

/**
 * Строит объединённое поле «Профиль + Цвет».
 * @param {Array} profiles - data.profiles
 * @param {Array} colors - data.colors
 * @param {(sel:{profileId:string, colorId:string})=>void} onChange
 * @returns {{field: HTMLElement, getValue: ()=>Object}}
 */
export function createProfileField(profiles, colors, onChange) {
  const field = el('div', { className: 'field' });

  const selected = {
    profileId: profiles[0]?.id ?? null,
    colorId: colors[0]?.id ?? null,
  };

  // Профиль
  field.append(el('h3', { className: 'field__label', textContent: 'Профиль' }));
  field.append(
    buildProfiles(profiles, (id) => {
      selected.profileId = id;
      onChange({ ...selected });
    })
  );

  // Разделитель
  field.append(el('hr', { className: 'field__divider' }));

  // Цвет
  field.append(el('h3', { className: 'field__label', textContent: 'Цвет профиля' }));
  field.append(
    buildColors(colors, (id) => {
      selected.colorId = id;
      onChange({ ...selected });
    })
  );

  return { field, getValue: () => ({ ...selected }) };
}
