# API Integration Guide

## User Management API Integration

Страница управления пользователями (`UserManagement.tsx`) теперь подключена к бэкенду.

### Созданные файлы:

1. **`src/types/user.ts`** - TypeScript типы для пользователей
   - `User` - основной тип пользователя
   - `UserCreate` - для создания пользователя
   - `UserCreateResponse` - ответ при создании
   - `UserUpdate` - для обновления пользователя

2. **`src/services/api.ts`** - Базовый API клиент
   - Централизованная конфигурация API
   - Автоматическая подстановка JWT токена из localStorage
   - Обработка ошибок
   - Методы: `get`, `post`, `put`, `patch`, `delete`

3. **`src/services/userService.ts`** - Сервис для работы с пользователями
   - `listUsers()` - получить список всех пользователей
   - `createUser(userData)` - создать нового пользователя
   - `updateUser(userId, userData)` - обновить пользователя
   - `deleteUser(userId)` - удалить пользователя
   - `blockUser(userId)` - заблокировать пользователя
   - `unblockUser(userId)` - разблокировать пользователя
   - `toggleUserStatus(userId, currentStatus)` - переключить статус

### Реализованная функциональность:

✅ **Загрузка пользователей** при монтировании компонента
✅ **Создание пользователя** с автогенерацией пароля
✅ **Блокировка/разблокировка** пользователя
✅ **Удаление пользователя** с подтверждением
✅ **Обновление списка** по кнопке
✅ **Обработка ошибок** с toast-уведомлениями
✅ **Индикатор загрузки** (Loading states)
✅ **Фильтрация** по роли и статусу
✅ **Поиск** по имени пользователя

### Конфигурация:

API URL настраивается в файле `.env`:
```
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

### Авторизация:

API клиент автоматически добавляет JWT токен из `localStorage.getItem('auth_token')` к каждому запросу:
```
Authorization: Bearer <token>
```

### Использование в других компонентах:

```typescript
import { userService } from '@/services/userService';

// Получить всех пользователей
const users = await userService.listUsers();

// Создать пользователя
const response = await userService.createUser({
  username: 'user@example.com',
  password: 'password123',
  role: 'user'
});

// Заблокировать пользователя
await userService.blockUser(userId);
```

### Обработка ошибок:

Все ошибки API оборачиваются в объект `ApiError`:
```typescript
interface ApiError {
  message: string;
  status: number;
  details?: any;
}
```

Пример использования:
```typescript
try {
  await userService.createUser(userData);
} catch (err: any) {
  console.error('Error:', err.message);
  console.error('Status:', err.status);
  console.error('Details:', err.details);
}
```

### Следующие шаги:

Аналогичным образом можно подключить другие страницы:
- Cases Management
- Simulations
- Feedback
