/**
 * Утилита для получения Telegram ID пользователя
 * Использует только Telegram WebApp API (безопасный источник)
 * RETAIL SCANNER TEST
 */

/**
 * Получает информацию о Telegram пользователе из Telegram WebApp API
 * @returns Объект с информацией о пользователе и WebApp или null, если не найден
 */
export const getTelegramId = (): {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  webAppInfo?: {
    version: string;
    platform: string;
    colorScheme: 'light' | 'dark';
    initData: string;
    initDataUnsafe: any;
    themeParams?: any;
    viewportHeight?: number;
    viewportStableHeight?: number;
  };
} | null => {
  console.log('🔍 Поиск информации о Telegram пользователе через Telegram WebApp API...');

  // Проверяем Telegram WebApp API
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
    const user = window.Telegram.WebApp.initDataUnsafe.user;
    const webApp = window.Telegram.WebApp;

    const userInfo = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      language_code: user.language_code,
      webAppInfo: {
        version: webApp.version || 'unknown',
        platform: webApp.platform || 'unknown',
        colorScheme: webApp.colorScheme || 'light',
        initData: webApp.initData || '',
        initDataUnsafe: webApp.initDataUnsafe || {},
        themeParams: webApp.themeParams || {},
        viewportHeight: webApp.viewportHeight,
        viewportStableHeight: webApp.viewportStableHeight,
      }
    };

    console.log('✅ Информация о Telegram пользователе найдена:', userInfo);
    console.log('📋 Полная информация о пользователе:', user);
    console.log('📋 Информация о WebApp:', userInfo.webAppInfo);

    return userInfo;
  }

  console.error('❌ Telegram WebApp API недоступен или не содержит user.id');

  // В режиме разработки проверяем URL параметры
  if (import.meta.env.DEV) {
    console.log('🛠️ Dev mode: проверяем URL параметры...');

    const urlParams = new URLSearchParams(window.location.search);
    const userIdFromQuery = urlParams.get('user_id');

    if (userIdFromQuery) {
      const userId = parseInt(userIdFromQuery, 10);
      if (!isNaN(userId)) {
        const firstName = urlParams.get('first_name') || `User ${userId}`;
        const lastName = urlParams.get('last_name') || undefined;
        const username = urlParams.get('username') || undefined;

        const devUser = {
          id: userId,
          first_name: firstName,
          last_name: lastName,
          username: username,
          language_code: 'en',
          webAppInfo: {
            version: 'dev',
            platform: 'browser',
            colorScheme: 'light' as const,
            initData: '',
            initDataUnsafe: {},
            themeParams: {},
            viewportHeight: window.innerHeight,
            viewportStableHeight: window.innerHeight,
          }
        };

        console.log('✅ Dev mode: используется user из URL:', devUser);
        return devUser;
      }
    }

    console.error('💡 Dev mode: добавьте ?user_id=YOUR_ID в URL для разработки');
  }

  console.error('💡 Страница должна быть открыта в Telegram WebView или в dev mode с ?user_id=');

  if (window.Telegram?.WebApp) {
    console.log('📋 initDataUnsafe:', window.Telegram.WebApp.initDataUnsafe);
    console.log('📋 WebApp объект:', {
      version: window.Telegram.WebApp.version,
      platform: window.Telegram.WebApp.platform,
      colorScheme: window.Telegram.WebApp.colorScheme,
    });
  } else {
    console.log('❌ window.Telegram.WebApp не существует - страница открыта не в Telegram');
  }

  return null;
};

/**
 * Получает user_id в формате для API
 * Приоритет:
 * 1. Telegram WebApp API (initDataUnsafe.user.id)
 * 2. Query параметр user_id в URL
 * 3. Значение по умолчанию
 * @returns user_id в виде строки или "284282163" по умолчанию
 */
export const getUserId = (): string => {
  // 1. Пытаемся получить из Telegram WebApp API
  const telegramUser = getTelegramId();
  if (telegramUser !== null && telegramUser.id) {
    return `${telegramUser.id}`;
  }
  
  // 2. Пытаемся получить из query параметров URL
  const urlParams = new URLSearchParams(window.location.search);
  const userIdFromQuery = urlParams.get('user_id');
  
  if (userIdFromQuery) {
    const userId = parseInt(userIdFromQuery, 10);
    if (!isNaN(userId) && userId > 0) {
      console.log(`✅ User ID получен из query параметров: ${userId}`);
      return `${userId}`;
    }
  }
  
  // 3. Возвращаем значение по умолчанию
  console.warn('⚠️ User ID не найден, используется значение по умолчанию');
  // return "380949152";
  return "284282163";
  // return "3809491522";
};

/**
 * Получает информацию о пользователе из Telegram WebApp
 * @returns Объект с информацией о пользователе или null
 */
export const getTelegramUser = (): {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
} | null => {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    return window.Telegram.WebApp.initDataUnsafe.user;
  }

  // В dev режиме используем getTelegramId для получения данных из URL
  const telegramId = getTelegramId();
  if (telegramId) {
    return {
      id: telegramId.id,
      first_name: telegramId.first_name,
      last_name: telegramId.last_name,
      username: telegramId.username,
      language_code: telegramId.language_code,
    };
  }

  return null;
};


