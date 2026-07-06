/* =============================================================================
   МОДУЛЬ: data — загрузка данных конфигуратора из windows.json
   ============================================================================= */

/**
 * Загружает данные конфигуратора из JSON-файла.
 * @returns {Promise<Object>} объект с данными об окнах, опциях и ценах
 * @throws {Error} если файл не загрузился (не 2xx статус)
 */
export async function loadWindowsData() {
  // Путь относительно index.html в собранной папке dist.
  const response = await fetch('data/windows.json');

  // fetch НЕ бросает ошибку на 404 — проверяем статус вручную.
  if (!response.ok) {
    throw new Error(`Не удалось загрузить данные: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
