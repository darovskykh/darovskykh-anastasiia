/**
 * Вспомогательные функции для разработки
 * Автоматически загружаются в dev режиме
 * RETAIL SCANNER TEST
 */

import {getUserId, getTelegramId } from './telegramId';

/**
 * Показывает справку по доступным командам в консоли
 */
export const help = () => {
  console.log('%c📚 Доступные способы тестирования:', 'font-size: 16px; font-weight: bold; color: #2563eb;');
  console.log('');
  console.log('%c1. Через URL query параметры (РЕКОМЕНДУЕТСЯ):', 'font-weight: bold; color: #059669;');
  console.log('  http://localhost:8080?user_id=123456789');
  console.log('    - Быстро переключаться между пользователями');
  console.log('');
  console.log('  http://localhost:8080?user_id=123456789&first_name=Dmitry&last_name=Ivanov');
  console.log('    - С дополнительными параметрами');
  console.log('');
  console.log('%c2. Через консоль браузера:', 'font-weight: bold; color: #059669;');
  console.log('  setMockTelegramUser({ id: 123456789, first_name: "Name" })');
  console.log('    - Установить мок-пользователя');
  console.log('');
  console.log('  clearMockTelegramUser()');
  console.log('    - Очистить мок-данные (вернуться к дефолтному)');
  console.log('');
  console.log('%c3. Информация о текущем пользователе:', 'font-weight: bold; color: #059669;');
  console.log('  getUserId()');
  console.log('    - Получить user_id для API');
  console.log('');
  console.log('  getTelegramId()');
  console.log('    - Получить полную информацию о пользователе');
  console.log('');
  console.log('%c4. Примеры:', 'font-weight: bold; color: #059669;');
  console.log('  // Способ 1: Открыть URL с вашим ID');
  console.log('  http://localhost:8080?user_id=284282163&first_name=Dmitry');
  console.log('');
  console.log('  // Способ 2: Через консоль');
  console.log('  setMockTelegramUser({ id: 284282163, first_name: "Dmitry" })');
  console.log('  location.reload(); // Перезагрузить страницу');
  console.log('');
  console.log('  // Проверить текущий ID');
  console.log('  getUserId()');
  console.log('');
  console.log('%c💡 Query параметры сохраняются в localStorage', 'color: #f59e0b; font-style: italic;');
  console.log('%c💡 Чтобы сменить пользователя - просто откройте новый URL', 'color: #f59e0b; font-style: italic;');
  console.log('');
  console.log('%c📖 Подробнее: см. файл TESTING.md в корне проекта', 'color: #6b7280;');
};

// Экспортируем в window для использования в консоли
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).help = help;
  (window as any).getUserId = getUserId;
  (window as any).getTelegramId = getTelegramId;

  // Показываем подсказку при загрузке
  console.log('%c🛠️ Dev Mode активен', 'font-size: 14px; font-weight: bold; color: #2563eb; background: #dbeafe; padding: 4px 8px; border-radius: 4px;');
  console.log('%cВведите %chelp()%c для списка доступных команд', 'color: #6b7280;', 'font-weight: bold; color: #059669;', 'color: #6b7280;');
  console.log('');
}

export default {
  help,
  setMockTelegramUser,
  clearMockTelegramUser,
  getUserId,
  getTelegramId,
};
