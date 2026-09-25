// RETAIL SCANNER TEST
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ChevronLeft, ChevronRight, X, Image as ImageIcon, Check, Trash2, FolderPlus, ZoomIn, ZoomOut, Maximize2, Plus } from 'lucide-react';
import { getTelegramId, getUserId, getTelegramUser } from '@/utils/telegramId';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Расширяем Window для Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
        };
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        BackButton: {
          isVisible: boolean;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          setParams: (params: {
            text?: string;
            color?: string;
            text_color?: string;
            is_active?: boolean;
            is_visible?: boolean;
          }) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        sendData: (data: string) => void;
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
        openTelegramLink: (url: string) => void;
        openInvoice: (url: string, callback?: (status: string) => void) => void;
        showPopup: (params: {
          title?: string;
          message: string;
          buttons?: Array<{
            id?: string;
            type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
            text: string;
          }>;
        }, callback?: (id: string) => void) => void;
        showAlert: (message: string, callback?: () => void) => void;
        showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
        showScanQrPopup: (params: {
          text?: string;
        }, callback?: (data: string) => void) => void;
        closeScanQrPopup: () => void;
        readTextFromClipboard: (callback?: (text: string) => void) => void;
        requestWriteAccess: (callback?: (granted: boolean) => void) => void;
        requestContact: (callback?: (granted: boolean) => void) => void;
        onEvent: (eventType: string, eventHandler: () => void) => void;
        offEvent: (eventType: string, eventHandler: () => void) => void;
      };
    };
  }
}

// Типы данных
interface ImageData {
  id: string;
  binaryData: string; // base64 encoded image или URL
  name?: string;
  index?: number; // Оригинальный index из API (ID изображения)
}

interface FieldData {
  name: string;
  enums: string[];
  value: any;
}

interface ImageGroup {
  id: number;
  name: string;
  images: ImageData[];
  fields?: FieldData[]; // Поля для отображения и редактирования
}

interface ImagesData {
  groups: ImageGroup[];
  originalData?: {
    callback_url?: string;
    confirmation_message?: string;
    user_id?: string;
    [key: string]: any;
  };
}

// Обёртка для перетаскиваемой картинки (DnD)
function DraggableImage({
  id,
  groupId,
  image,
  disabled,
  children,
}: {
  id: string;
  groupId: number;
  image: ImageData;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { groupId, image },
    disabled,
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  if (disabled) return <>{children}</>;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-none ${isDragging ? 'opacity-50 z-50 cursor-grabbing' : 'cursor-grab'}`}
    >
      {children}
    </div>
  );
}

// Обёртка для зоны сброса (карточка группы)
function DroppableGroup({
  groupId,
  children,
}: {
  groupId: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-${groupId}` });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg transition-all duration-150 ${
        isOver
          ? 'ring-2 ring-primary ring-offset-2 bg-primary/10 shadow-md'
          : ''
      }`}
    >
      {children}
    </div>
  );
}

const HelloPage: React.FC = () => {
  const [imagesData, setImagesData] = useState<ImagesData>({ groups: [] });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [telegramUser, setTelegramUser] = useState<ReturnType<typeof getTelegramId>>(null);
  const [selectedImages, setSelectedImages] = useState<Array<{ image: ImageData; groupId: number }>>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewingImage, setViewingImage] = useState<ImageData | null>(null);
  const [viewingImageGroupId, setViewingImageGroupId] = useState<number | null>(null);
  const [viewingImageIndex, setViewingImageIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMovedImages, setHasMovedImages] = useState(false); // Флаг для отслеживания перемещения фоток
  const [showSuccessModal, setShowSuccessModal] = useState(false); // Флаг для показа модального окна успеха
  const [successMessage, setSuccessMessage] = useState<string>(''); // Сообщение об успехе
  const [currentSkuIndex, setCurrentSkuIndex] = useState(0); // Индекс текущего SKU для пагинации в стадии Analysis
  const [groupSize, setGroupSize] = useState<2 | 3 | 4 | 5>(2); // Размер группы для defaultgrouping
  const hasAppliedInitialGroupIndex = useRef(false); // Применяем groupIndex из бэка только один раз после загрузки

  // Определение стадии: Analysis если есть fields, иначе Grouping
  const isAnalysisStage = imagesData.groups.some(group => group.fields && group.fields.length > 0);
  
  // Получаем SKU с полями для стадии Analysis
  const analysisSkus = imagesData.groups.filter(group => group.fields && group.fields.length > 0);

  // Сенсоры DnD: активация при сдвиге 5px (клик без движения = выделение, сдвиг = драг)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Определение типа устройства и окружения
  const isTelegramWebApp = () => {
    return !!window.Telegram?.WebApp;
  };

  const isMobileDevice = () => {
    // Проверяем через Telegram WebApp platform
    if (window.Telegram?.WebApp?.platform) {
      const platform = window.Telegram.WebApp.platform.toLowerCase();
      return platform === 'ios' || platform === 'android';
    }
    // Fallback: проверяем user agent
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const isDesktopTelegram = () => {
    // Проверяем, что это Telegram WebApp на десктопе
    if (window.Telegram?.WebApp?.platform) {
      const platform = window.Telegram.WebApp.platform.toLowerCase();
      // Десктопные платформы Telegram: tdesktop, web, macos, windows, linux
      const desktopPlatforms = ['tdesktop', 'web', 'macos', 'windows', 'linux', 'mac', 'win'];
      return desktopPlatforms.includes(platform);
    }
    return false;
  };

  const openFullscreen = () => {
    // Пытаемся открыть на весь экран через Fullscreen API
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(err => {
        console.log('Не удалось открыть на весь экран:', err);
      });
    } else if ((element as any).webkitRequestFullscreen) {
      // Safari
      (element as any).webkitRequestFullscreen();
    } else if ((element as any).mozRequestFullScreen) {
      // Firefox
      (element as any).mozRequestFullScreen();
    } else if ((element as any).msRequestFullscreen) {
      // IE/Edge
      (element as any).msRequestFullscreen();
    }
  };

  const openInBrowserFullscreen = () => {
    // Открываем текущую страницу в системном браузере на весь экран
    const currentUrl = window.location.href;
    
    // Используем window.open с максимальными параметрами для полноэкранного режима
    const screenWidth = screen.width || window.innerWidth;
    const screenHeight = screen.height || window.innerHeight;
    
    const features = [
      `width=${screenWidth}`,
      `height=${screenHeight}`,
      'left=0',
      'top=0',
      'fullscreen=yes',
      'resizable=yes',
      'scrollbars=yes',
      'status=no',
      'toolbar=no',
      'menubar=no',
      'location=no'
    ].join(',');
    
    try {
      const newWindow = window.open(currentUrl, '_blank', features);
      
      if (newWindow) {
        console.log('✅ Открыто новое окно браузера');
        
        // Пытаемся сделать fullscreen в новом окне после загрузки
        newWindow.addEventListener('load', () => {
          setTimeout(() => {
            if (newWindow.document.documentElement.requestFullscreen) {
              newWindow.document.documentElement.requestFullscreen().catch(err => {
                console.log('Не удалось открыть новое окно на весь экран через Fullscreen API:', err);
                // Пытаемся максимизировать окно программно
                try {
                  newWindow.moveTo(0, 0);
                  newWindow.resizeTo(screenWidth, screenHeight);
                } catch (e) {
                  console.log('Не удалось изменить размер окна:', e);
                }
              });
            }
          }, 500);
        });
        
        // Если окно уже загружено, пытаемся сразу
        if (newWindow.document.readyState === 'complete') {
          setTimeout(() => {
            if (newWindow.document.documentElement.requestFullscreen) {
              newWindow.document.documentElement.requestFullscreen().catch(() => {});
            }
          }, 500);
        }
      } else {
        // Если window.open заблокирован, используем Telegram WebApp API
        if (window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink(currentUrl, { try_instant_view: false });
          console.log('📱 Открыто через Telegram WebApp API');
        }
      }
    } catch (error) {
      console.error('Ошибка при открытии в браузере:', error);
      // Fallback: используем Telegram WebApp API
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(currentUrl, { try_instant_view: false });
      }
    }
  };

  // Инициализация Telegram пользователя
  useEffect(() => {
    const userInfo = getTelegramId();
    setTelegramUser(userInfo);
    
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      
      const telegramUser = getTelegramUser();
      if (telegramUser) {
        setUserName(telegramUser.first_name);
      }
      
      // Логирование для отладки
      console.log('📱 Telegram WebApp detected');
      console.log('Platform:', tg.platform);
      console.log('Is mobile:', isMobileDevice());
      console.log('Is desktop Telegram:', isDesktopTelegram());
      console.log('Is expanded:', tg.isExpanded);
      
      // Для десктопной версии Telegram - агрессивно расширяем окно бота
      if (isDesktopTelegram()) {
        console.log('🖥️ Desktop Telegram detected - expanding bot window');
        
        // Вызываем expand() несколько раз с задержками для надежности
        tg.expand();
        
        // Проверяем и расширяем повторно через небольшие задержки
        const expandInterval = setInterval(() => {
          if (!tg.isExpanded) {
            console.log('🔄 Bot window not expanded yet, trying again...');
            tg.expand();
          } else {
            console.log('✅ Bot window is now expanded');
            clearInterval(expandInterval);
          }
        }, 200);
        
        // Останавливаем попытки через 3 секунды
        setTimeout(() => {
          clearInterval(expandInterval);
          if (tg.isExpanded) {
            console.log('✅ Bot window expansion completed');
            // Даже если расширилось, пытаемся открыть на весь экран браузера
            setTimeout(() => {
              openFullscreen();
            }, 500);
          } else {
            console.warn('⚠️ Bot window expansion may have failed');
            // Если не удалось расширить, открываем в браузере на весь экран
            console.log('💡 Открываем в браузере на весь экран...');
            openInBrowserFullscreen();
          }
        }, 3000);
        
        // Также пытаемся открыть на весь экран браузера сразу
        setTimeout(() => {
          openFullscreen();
        }, 500);
      } else {
        // Для мобильных устройств просто вызываем expand() один раз
        tg.expand();
      }
    } else {
      // Обычный браузер
      console.log('🌐 Regular browser detected');
      console.log('Is mobile:', isMobileDevice());
    }
  }, []);

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    const loadData = async () => {
      const userId = getUserId();

      if (!userId) {
        // Если userId не найден, просто показываем "No data available"
        setImagesData({ groups: [] });
        setLoadError(null);
        setIsLoading(false);
        return;
      }

      const isTestMode = new URLSearchParams(window.location.search).get('test') === '1';
      const webhookPath = isTestMode ? 'front-asks-data-test' : 'front-asks-data';

      setIsLoading(true);
      try {
        // Загружаем данные с webhook (тестовый или прод в зависимости от ?test=1)
        const response = await fetch(`https://gttech.app.n8n.cloud/webhook/${webhookPath}?user_id=${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          // Если ошибка ответа, просто показываем "No data available"
          setImagesData({ groups: [] });
          setLoadError(null);
          setIsLoading(false);
          return;
        }

        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          // Если ошибка парсинга JSON, просто показываем "No data available"
          setImagesData({ groups: [] });
          setLoadError(null);
          setIsLoading(false);
          return;
        }

        // Обработка формата с groups напрямую в ответе
        if (data.groups && typeof data.groups === 'object') {
          let groups: ImageGroup[] = [];
          
          // Проверяем новый формат: groups - это объект с вложенным массивом groups (когда пришли fields)
          if (data.groups.groups && Array.isArray(data.groups.groups)) {
            // Обработка формата с объектом groups, содержащим массив groups внутри
            const groupsArray = data.groups.groups;
            groups = groupsArray.map((groupItem: any, groupIndex: number) => {
              let images: ImageData[] = [];
              let fields: FieldData[] | undefined = undefined;
              
              // Сохраняем fields если они есть
              if (groupItem.fields && Array.isArray(groupItem.fields)) {
                fields = groupItem.fields.map((field: any) => ({
                  name: field.name || '',
                  enums: Array.isArray(field.enums) ? field.enums : [],
                  value: field.value !== undefined ? field.value : null,
                }));
              }
              
              // Если у группы есть images напрямую
              if (groupItem.images && Array.isArray(groupItem.images)) {
                images = groupItem.images.map((img: any, imgIndex: number) => {
                  // Если это строка
                  if (typeof img === 'string') {
                    // Проверяем, является ли это Google Drive ID
                    if (isGoogleDriveId(img)) {
                      const driveUrl = convertGoogleDriveIdToUrl(img);
                      return {
                        id: `img-${groupIndex}-${imgIndex}`,
                        binaryData: driveUrl,
                        name: `Image ${imgIndex + 1}`,
                        index: imgIndex,
                      };
                    }
                    
                    // Иначе обрабатываем как base64
                    const base64Data = img;
                    let imageType = 'image/png';
                    if (base64Data.startsWith('/9j/')) {
                      imageType = 'image/jpeg';
                    }
                    const dataUrl = base64Data.startsWith('data:image') 
                      ? base64Data 
                      : `data:${imageType};base64,${base64Data}`;
                    
                    return {
                      id: `img-${groupIndex}-${imgIndex}`,
                      binaryData: dataUrl,
                      name: `Image ${imgIndex + 1}`,
                      index: imgIndex,
                    };
                  }
                  
                  // Если это объект с image_value
                  if (img.image_value) {
                    const imageValue = img.image_value;
                    
                    // Проверяем, является ли это Google Drive ID
                    if (typeof imageValue === 'string' && isGoogleDriveId(imageValue)) {
                      const driveUrl = convertGoogleDriveIdToUrl(imageValue);
                      return {
                        id: `img-${groupIndex}-${img.index ?? imgIndex}`,
                        binaryData: driveUrl,
                        name: `Image ${(img.index ?? imgIndex) + 1}`,
                        index: img.index ?? imgIndex,
                      };
                    }
                    
                    // Иначе обрабатываем как base64
                    const base64Data = imageValue;
                    let imageType = 'image/png';
                    if (base64Data.startsWith('/9j/')) {
                      imageType = 'image/jpeg';
                    }
                    const dataUrl = base64Data.startsWith('data:image') 
                      ? base64Data 
                      : `data:${imageType};base64,${base64Data}`;
                    
                    return {
                      id: `img-${groupIndex}-${img.index ?? imgIndex}`,
                      binaryData: dataUrl,
                      name: `Image ${(img.index ?? imgIndex) + 1}`,
                      index: img.index ?? imgIndex,
                    };
                  }
                  
                  // Если это объект с fields (изображение может быть в другом месте)
                  if (img.fields && Array.isArray(img.fields)) {
                    // Пропускаем объекты с fields без image_value
                    return null;
                  }
                  
                  return null;
                }).filter((img: ImageData | null): img is ImageData => img !== null);
              }
              
              return {
                id: groupItem.group_id || groupItem.id || groupIndex,
                name: `SKU ${groupIndex + 1}`,
                images,
                fields,
              };
            });
          }
          // Проверяем, является ли groups массивом (новый формат с fields)
          else if (Array.isArray(data.groups)) {
            // Обработка формата с массивом groups, где каждый элемент может иметь fields
            groups = data.groups.map((groupItem: any, groupIndex: number) => {
              let images: ImageData[] = [];
              let fields: FieldData[] | undefined = undefined;
              
              // Сохраняем fields если они есть
              if (groupItem.fields && Array.isArray(groupItem.fields)) {
                fields = groupItem.fields.map((field: any) => ({
                  name: field.name || '',
                  enums: Array.isArray(field.enums) ? field.enums : [],
                  value: field.value !== undefined ? field.value : null,
                }));
              }
              
              // Если у группы есть images напрямую
              if (groupItem.images && Array.isArray(groupItem.images)) {
                images = groupItem.images.map((img: any, imgIndex: number) => {
                  // Если это строка
                  if (typeof img === 'string') {
                    // Проверяем, является ли это Google Drive ID
                    if (isGoogleDriveId(img)) {
                      const driveUrl = convertGoogleDriveIdToUrl(img);
                      return {
                        id: `img-${groupIndex}-${imgIndex}`,
                        binaryData: driveUrl, // Используем binaryData для хранения URL (для обратной совместимости)
                        name: `Image ${imgIndex + 1}`,
                        index: imgIndex,
                      };
                    }
                    
                    // Иначе обрабатываем как base64
                    const base64Data = img;
                    let imageType = 'image/png';
                    if (base64Data.startsWith('/9j/')) {
                      imageType = 'image/jpeg';
                    }
                    const dataUrl = base64Data.startsWith('data:image') 
                      ? base64Data 
                      : `data:${imageType};base64,${base64Data}`;
                    
                    return {
                      id: `img-${groupIndex}-${imgIndex}`,
                      binaryData: dataUrl,
                      name: `Image ${imgIndex + 1}`,
                      index: imgIndex,
                    };
                  }
                  
                  // Если это объект с image_value
                  if (img.image_value) {
                    const imageValue = img.image_value;
                    
                    // Проверяем, является ли это Google Drive ID
                    if (typeof imageValue === 'string' && isGoogleDriveId(imageValue)) {
                      const driveUrl = convertGoogleDriveIdToUrl(imageValue);
                      return {
                        id: `img-${groupIndex}-${img.index ?? imgIndex}`,
                        binaryData: driveUrl,
                        name: `Image ${(img.index ?? imgIndex) + 1}`,
                        index: img.index ?? imgIndex,
                      };
                    }
                    
                    // Иначе обрабатываем как base64
                    const base64Data = imageValue;
                    let imageType = 'image/png';
                    if (base64Data.startsWith('/9j/')) {
                      imageType = 'image/jpeg';
                    }
                    const dataUrl = base64Data.startsWith('data:image') 
                      ? base64Data 
                      : `data:${imageType};base64,${base64Data}`;
                    
                    return {
                      id: `img-${groupIndex}-${img.index ?? imgIndex}`,
                      binaryData: dataUrl,
                      name: `Image ${(img.index ?? imgIndex) + 1}`,
                      index: img.index ?? imgIndex,
                    };
                  }
                  
                  // Если это объект с fields (изображение может быть в другом месте)
                  if (img.fields && Array.isArray(img.fields)) {
                    // Пропускаем объекты с fields без image_value
                    return null;
                  }
                  
                  return null;
                }).filter((img: ImageData | null): img is ImageData => img !== null);
              }
              
              return {
                id: groupItem.id || groupIndex,
                name: `SKU ${groupIndex + 1}`,
                images,
                fields,
              };
            });
            
            // Если есть отдельный массив images на верхнем уровне, обрабатываем его
            if (data.images && Array.isArray(data.images)) {
              // Если groups пустые, создаем группы из images
              if (groups.length === 0 || groups.every(g => g.images.length === 0)) {
                // Если количество images совпадает с количеством groups, связываем их по индексу
                if (groups.length > 0 && data.images.length === groups.length) {
                  groups = groups.map((group, groupIndex) => {
                    const img = data.images[groupIndex];
                    if (!img) return group;
                    
                    let imageData: ImageData | null = null;
                    let additionalFields: FieldData[] | undefined = undefined;
                    
                    // Если это строка
                    if (typeof img === 'string') {
                      // Проверяем, является ли это Google Drive ID
                      if (isGoogleDriveId(img)) {
                        const driveUrl = convertGoogleDriveIdToUrl(img);
                        imageData = {
                          id: `img-${groupIndex}-0`,
                          binaryData: driveUrl,
                          name: `Image 1`,
                          index: 0,
                        };
                      } else {
                        // Иначе обрабатываем как base64
                        const base64Data = img;
                        let imageType = 'image/png';
                        if (base64Data.startsWith('/9j/')) {
                          imageType = 'image/jpeg';
                        }
                        const dataUrl = base64Data.startsWith('data:image') 
                          ? base64Data 
                          : `data:${imageType};base64,${base64Data}`;
                        
                        imageData = {
                          id: `img-${groupIndex}-0`,
                          binaryData: dataUrl,
                          name: `Image 1`,
                          index: 0,
                        };
                      }
                    } else if (img.image_value) {
                      // Если это объект с image_value
                      const imageValue = img.image_value;
                      
                      // Проверяем, является ли это Google Drive ID
                      if (typeof imageValue === 'string' && isGoogleDriveId(imageValue)) {
                        const driveUrl = convertGoogleDriveIdToUrl(imageValue);
                        imageData = {
                          id: `img-${groupIndex}-${img.index ?? 0}`,
                          binaryData: driveUrl,
                          name: `Image ${(img.index ?? 0) + 1}`,
                          index: img.index ?? 0,
                        };
                      } else {
                        // Иначе обрабатываем как base64
                        const base64Data = imageValue;
                        let imageType = 'image/png';
                        if (base64Data.startsWith('/9j/')) {
                          imageType = 'image/jpeg';
                        }
                        const dataUrl = base64Data.startsWith('data:image') 
                          ? base64Data 
                          : `data:${imageType};base64,${base64Data}`;
                        
                        imageData = {
                          id: `img-${groupIndex}-${img.index ?? 0}`,
                          binaryData: dataUrl,
                          name: `Image ${(img.index ?? 0) + 1}`,
                          index: img.index ?? 0,
                        };
                      }
                    }
                    
                    // Если у изображения есть fields, добавляем их к группе
                    if (img.fields && Array.isArray(img.fields)) {
                      additionalFields = img.fields.map((field: any) => ({
                        name: field.name || '',
                        enums: Array.isArray(field.enums) ? field.enums : [],
                        value: field.value !== undefined ? field.value : null,
                      }));
                    }
                    
                    return {
                      ...group,
                      images: imageData ? [imageData] : group.images,
                      // Объединяем fields из группы и из изображения (приоритет у группы)
                      fields: group.fields || additionalFields,
                    };
                  });
                } else {
                  // Иначе создаем одну группу со всеми images
                  const imagesGroup: ImageGroup = {
                    id: 0,
                    name: 'SKU 1',
                    images: data.images.map((img: any, imgIndex: number) => {
                    // Если это строка
                    if (typeof img === 'string') {
                      // Проверяем, является ли это Google Drive ID
                      if (isGoogleDriveId(img)) {
                        const driveUrl = convertGoogleDriveIdToUrl(img);
                        return {
                          id: `img-0-${imgIndex}`,
                          binaryData: driveUrl,
                          name: `Image ${imgIndex + 1}`,
                          index: imgIndex,
                        };
                      }
                      
                      // Иначе обрабатываем как base64
                      const base64Data = img;
                      let imageType = 'image/png';
                      if (base64Data.startsWith('/9j/')) {
                        imageType = 'image/jpeg';
                      }
                      const dataUrl = base64Data.startsWith('data:image') 
                        ? base64Data 
                        : `data:${imageType};base64,${base64Data}`;
                      
                      return {
                        id: `img-0-${imgIndex}`,
                        binaryData: dataUrl,
                        name: `Image ${imgIndex + 1}`,
                        index: imgIndex,
                      };
                    }
                    
                    // Если это объект с image_value
                    if (img.image_value) {
                      const imageValue = img.image_value;
                      
                      // Проверяем, является ли это Google Drive ID
                      if (typeof imageValue === 'string' && isGoogleDriveId(imageValue)) {
                        const driveUrl = convertGoogleDriveIdToUrl(imageValue);
                        return {
                          id: `img-0-${img.index ?? imgIndex}`,
                          binaryData: driveUrl,
                          name: `Image ${(img.index ?? imgIndex) + 1}`,
                          index: img.index ?? imgIndex,
                        };
                      }
                      
                      // Иначе обрабатываем как base64
                      const base64Data = imageValue;
                      let imageType = 'image/png';
                      if (base64Data.startsWith('/9j/')) {
                        imageType = 'image/jpeg';
                      }
                      const dataUrl = base64Data.startsWith('data:image') 
                        ? base64Data 
                        : `data:${imageType};base64,${base64Data}`;
                      
                      return {
                        id: `img-0-${img.index ?? imgIndex}`,
                        binaryData: dataUrl,
                        name: `Image ${(img.index ?? imgIndex) + 1}`,
                        index: img.index ?? imgIndex,
                      };
                    }
                    
                    // Если это объект с fields, но без image_value, проверяем, может быть это base64 строка напрямую
                    // или изображение в другом формате
                    if (img.fields && Array.isArray(img.fields)) {
                      // Если есть fields, но нет image_value, пропускаем (изображение может быть в другом месте)
                      return null;
                    }
                    
                    // Если это объект, но не строка и не имеет image_value, пропускаем
                    return null;
                  }).filter((img: ImageData | null): img is ImageData => img !== null),
                };
                
                  if (imagesGroup.images.length > 0) {
                    groups = [imagesGroup];
                  }
                }
              } else {
                // Если groups уже есть, добавляем images в первую группу или создаем новую
                const additionalImages = data.images.map((img: any, imgIndex: number) => {
                  if (typeof img === 'string') {
                    // Проверяем, является ли это Google Drive ID
                    if (isGoogleDriveId(img)) {
                      const driveUrl = convertGoogleDriveIdToUrl(img);
                      return {
                        id: `img-${groups.length}-${imgIndex}`,
                        binaryData: driveUrl,
                        name: `Image ${imgIndex + 1}`,
                        index: imgIndex,
                      };
                    }
                    
                    // Иначе обрабатываем как base64
                    const base64Data = img;
                    let imageType = 'image/png';
                    if (base64Data.startsWith('/9j/')) {
                      imageType = 'image/jpeg';
                    }
                    const dataUrl = base64Data.startsWith('data:image') 
                      ? base64Data 
                      : `data:${imageType};base64,${base64Data}`;
                    
                    return {
                      id: `img-${groups.length}-${imgIndex}`,
                      binaryData: dataUrl,
                      name: `Image ${imgIndex + 1}`,
                      index: imgIndex,
                    };
                  }
                  
                  if (img.image_value) {
                    const imageValue = img.image_value;
                    
                    // Проверяем, является ли это Google Drive ID
                    if (typeof imageValue === 'string' && isGoogleDriveId(imageValue)) {
                      const driveUrl = convertGoogleDriveIdToUrl(imageValue);
                      return {
                        id: `img-${groups.length}-${img.index ?? imgIndex}`,
                        binaryData: driveUrl,
                        name: `Image ${(img.index ?? imgIndex) + 1}`,
                        index: img.index ?? imgIndex,
                      };
                    }
                    
                    // Иначе обрабатываем как base64
                    const base64Data = imageValue;
                    let imageType = 'image/png';
                    if (base64Data.startsWith('/9j/')) {
                      imageType = 'image/jpeg';
                    }
                    const dataUrl = base64Data.startsWith('data:image') 
                      ? base64Data 
                      : `data:${imageType};base64,${base64Data}`;
                    
                    return {
                      id: `img-${groups.length}-${img.index ?? imgIndex}`,
                      binaryData: dataUrl,
                      name: `Image ${(img.index ?? imgIndex) + 1}`,
                      index: img.index ?? imgIndex,
                    };
                  }
                  
                  return null;
                }).filter((img: ImageData | null): img is ImageData => img !== null);
                
                if (additionalImages.length > 0) {
                  if (groups.length > 0) {
                    groups[0].images = [...groups[0].images, ...additionalImages];
                  } else {
                    groups.push({
                      id: 0,
                      name: 'SKU 1',
                      images: additionalImages,
                    });
                  }
                }
              }
            }
          } else {
            // Старый формат: groups - это объект с ключами-группами
            const groupEntries = Object.entries(data.groups);
            groupEntries.sort(([a], [b]) => {
              const numA = Number(a) || 0;
              const numB = Number(b) || 0;
              return numA - numB;
            });
            
            groups = groupEntries.map(([groupId, imagesArray], index) => {
              const images = Array.isArray(imagesArray) ? imagesArray : [];
              
              return {
                id: Number(groupId) || Date.now(),
                name: `SKU ${index + 1}`,
                images: images.map((img: any) => {
                  const imageValue = img.image_value || '';
                  
                  // Если image_value - это строка, проверяем, является ли это Google Drive ID
                  if (typeof imageValue === 'string' && isGoogleDriveId(imageValue)) {
                    const driveUrl = convertGoogleDriveIdToUrl(imageValue);
                    return {
                      id: `img-${groupId}-${img.index ?? 0}`,
                      binaryData: driveUrl,
                      name: `Image ${(img.index ?? 0) + 1}`,
                      index: img.index ?? 0,
                    };
                  }

                  // Проверяем, есть ли уже префикс data:image
                  if (imageValue.startsWith('data:image')) {
                    return {
                      id: `img-${groupId}-${img.index ?? 0}`,
                      binaryData: imageValue,
                      name: `Image ${(img.index ?? 0) + 1}`,
                      index: img.index ?? 0,
                    };
                  }

                  // Определяем формат изображения по первым байтам base64
                  // JPEG начинается с /9j/
                  let imageType = 'image/png'; // по умолчанию PNG
                  if (imageValue.startsWith('/9j/')) {
                    imageType = 'image/jpeg';
                  }

                  const dataUrl = `data:${imageType};base64,${imageValue}`;

                  return {
                    id: `img-${groupId}-${img.index ?? 0}`,
                    binaryData: dataUrl,
                    name: `Image ${(img.index ?? 0) + 1}`,
                    index: img.index ?? 0,
                  };
                }),
              };
            });
          }

          // Сохраняем исходные данные для отправки обратно (включая fields если они есть)
          const originalData: any = {};
          Object.keys(data).forEach(key => {
            if (key !== 'groups') {
              originalData[key] = data[key];
            }
          });
          
          // Сохраняем также структуру groups с fields для последующей отправки
          originalData.groups = data.groups;
          
          // Сохраняем groupIndex если он есть в ответе
          if (data.groupIndex !== undefined && data.groupIndex !== null) {
            originalData.groupIndex = data.groupIndex;
          }

          setImagesData({ groups, originalData });
          setLoadError(null);
          hasAppliedInitialGroupIndex.current = false;
          // Сбрасываем индекс SKU при загрузке новых данных (useEffect установит правильный, если есть groupIndex)
          setCurrentSkuIndex(0);
        } else {
          setImagesData({ groups: [] });
        }
      } catch (error) {
        // При любой ошибке просто показываем "No data available" вместо ошибки
        console.error('Load data failed:', error);
        setImagesData({ groups: [] });
        setLoadError(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Обработка groupIndex из ответа для перехода на нужную страницу
  useEffect(() => {
    if (hasAppliedInitialGroupIndex.current) {
      return;
    }

    if (imagesData.originalData?.groupIndex !== undefined && imagesData.originalData.groupIndex !== null) {
      const receivedGroupIndex = imagesData.originalData.groupIndex;
      const analysisSkus = imagesData.groups.filter(group => group.fields && group.fields.length > 0);
      
      if (analysisSkus.length > 0) {
        // Находим группу в оригинальных данных по group_id или id
        const originalGroups = imagesData.originalData.groups;
        let targetGroupId: number | null = null;
        
        if (originalGroups) {
          let originalGroupsArray: any[] = [];
          
          if (typeof originalGroups === 'object' && !Array.isArray(originalGroups) && originalGroups.groups && Array.isArray(originalGroups.groups)) {
            originalGroupsArray = originalGroups.groups;
          } else if (Array.isArray(originalGroups)) {
            originalGroupsArray = originalGroups;
          }
          
          // Находим группу с нужным group_id или id
          const targetOriginalGroup = originalGroupsArray.find((og: any) => 
            og.group_id === receivedGroupIndex || og.id === receivedGroupIndex
          );
          
          if (targetOriginalGroup) {
            // Берем group_id или id из найденной группы
            targetGroupId = targetOriginalGroup.group_id || targetOriginalGroup.id;
          }
        }
        
        // Если нашли ID группы, находим её индекс в analysisSkus
        if (targetGroupId !== null) {
          const skuIndex = analysisSkus.findIndex(sku => sku.id === targetGroupId);
          if (skuIndex !== -1) {
            setCurrentSkuIndex(skuIndex);
            hasAppliedInitialGroupIndex.current = true;
          }
        }
      }
    }
  }, [imagesData]);

  // Функция для преобразования Google Drive ID в прямую ссылку
  const convertGoogleDriveIdToUrl = (driveId: string): string => {
    return `https://drive.google.com/uc?export=view&id=${driveId}`;
  };

  // Функция для извлечения Google Drive ID из URL
  const extractGoogleDriveId = (url: string): string | null => {
    // Извлекаем ID из разных форматов URL
    let driveId: string | undefined;
    
    if (url.includes('id=')) {
      driveId = url.match(/[?&]id=([^&=\/]+)/)?.[1];
    } else if (url.includes('/d/')) {
      // Извлекаем ID из URL вида /d/ID или /d/ID=w2000
      // ID может заканчиваться на =, ?, &, / или конец строки
      const match = url.match(/\/d\/([^\/\?=&]+?)(?:[=\?&\/]|$)/);
      driveId = match?.[1];
    }
    
    return driveId || null;
  };

  // Функция для определения, является ли строка Google Drive ID
  const isGoogleDriveId = (str: string): boolean => {
    // Google Drive ID обычно длинные строки (15-40 символов) из букв, цифр, дефисов и подчеркиваний
    // Не начинаются с data:image, /9j/, iVBORw0KGgo (PNG base64)
    if (str.startsWith('data:image') || str.startsWith('/9j/') || str.startsWith('iVBORw0KGgo')) {
      return false;
    }
    // Проверяем формат: только буквы, цифры, дефисы, подчеркивания, длина от 15 до 50 символов
    return /^[a-zA-Z0-9_-]{15,50}$/.test(str);
  };

  // Кеш для нормализованных URL (используем useRef чтобы не триггерить ререндеры)
  const urlCacheRef = useRef(new Map<string, string>());

  // Функция для нормализации URL изображения (мемоизированная)
  const normalizeImageUrl = useCallback((url: string): string => {
    // Проверяем кеш
    if (urlCacheRef.current.has(url)) {
      return urlCacheRef.current.get(url)!;
    }

    let normalizedUrl: string;

    // Если это base64 или data URL, возвращаем как есть
    if (url.startsWith('data:') || url.startsWith('/9j/') || url.startsWith('iVBORw0KGgo')) {
      normalizedUrl = url;
    }
    // Если это Google Drive ID (просто ID без URL), преобразуем в URL
    else if (isGoogleDriveId(url) && !url.includes('drive.google.com') && !url.includes('googleusercontent.com')) {
      normalizedUrl = convertGoogleDriveIdToUrl(url);
    }
    // Если URL содержит lh3.googleusercontent.com или другие googleusercontent.com домены
    else if (url.includes('googleusercontent.com')) {
      // Если URL не начинается с протокола, добавляем https://
      let processedUrl = url;
      if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
        processedUrl = 'https://' + processedUrl;
      }
      // Извлекаем ID из URL вида lh3.googleusercontent.com/d/ID=w2000 или lh3.googleusercontent.com/d/ID
      // ID может заканчиваться на =, ?, &, / или конец строки
      const driveIdMatch = processedUrl.match(/\/d\/([^\/\?=&]+?)(?:[=\?&\/]|$)/);
      if (driveIdMatch) {
        const driveId = driveIdMatch[1];
        // Используем правильный формат для просмотра
        normalizedUrl = `https://drive.google.com/uc?export=view&id=${driveId}`;
      } else {
        normalizedUrl = processedUrl;
      }
    }
    // Если URL содержит drive.google.com
    else if (url.includes('drive.google.com')) {
      // Если URL не начинается с протокола, добавляем https://
      let processedUrl = url;
      if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
        processedUrl = 'https://' + processedUrl;
      }
      // Извлекаем ID и используем правильный формат
      const driveId = extractGoogleDriveId(processedUrl);
      if (driveId) {
        normalizedUrl = `https://drive.google.com/uc?export=view&id=${driveId}`;
      } else {
        normalizedUrl = processedUrl;
      }
    }
    // Если URL не начинается с протокола, добавляем https://
    else if (url && !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
      normalizedUrl = 'https://' + url;
    }
    else {
      normalizedUrl = url;
    }

    // Сохраняем в кеш
    urlCacheRef.current.set(url, normalizedUrl);
    return normalizedUrl;
  }, []);

  // Функция для выбора/снятия выбора картинки
  // Поддерживает множественный выбор фоток
  // После действий (перемещение, создание группы, удаление) при клике на НЕ выбранную фотку - очищает весь предыдущий выбор
  // Для стадии Analysis: клик открывает фото вместо выбора
  const handleImageClick = (image: ImageData, groupId: number, event?: React.MouseEvent) => {
    // Для стадии Analysis: клик открывает фото вместо выбора
    if (isAnalysisStage) {
      if (event) {
        handleViewImage(image, groupId, event);
      }
      return;
    }

    // Для стадии Grouping: обычное поведение выбора
    setSelectedImages(prev => {
      const existingIndex = prev.findIndex(
        item => item.image.id === image.id && item.groupId === groupId
      );

      if (existingIndex !== -1) {
        // Если фото уже выбрано - убираем из выбранных (toggle off)
        setHasMovedImages(false); // Сбрасываем флаг при toggle
        return prev.filter((_, index) => index !== existingIndex);
      } else {
        // Если фото НЕ выбрано
        // Если было действие (перемещение, создание группы, удаление) - очищаем весь предыдущий выбор и выбираем только это фото
        if (hasMovedImages) {
          setHasMovedImages(false); // Сбрасываем флаг после сброса выбора
          return [{ image, groupId }];
        }
        
        // Если не было действий - добавляем к существующему выбору (multi-select)
        // Поддержка Ctrl/Cmd для явного multi-select (опционально, но работает и без него)
        return [...prev, { image, groupId }];
      }
    });
  };

  // Функция для открытия изображения в полный экран
  const handleViewImage = (image: ImageData, groupId: number, e: React.MouseEvent) => {
    // Находим группу и индекс изображения в группе
    const group = imagesData.groups.find(g => g.id === groupId);
    if (group) {
      const imageIndex = group.images.findIndex(img => img.id === image.id);
      if (imageIndex !== -1) {
        setViewingImageGroupId(groupId);
        setViewingImageIndex(imageIndex);
        setViewingImage(image);
        setZoomLevel(1);
        setImagePosition({ x: 0, y: 0 });
      }
    }
  };

  // Функция для закрытия просмотра
  const handleCloseView = useCallback(() => {
    setViewingImage(null);
    setViewingImageGroupId(null);
    setViewingImageIndex(0);
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  }, []);

  // Функция для навигации к предыдущему изображению в группе
  const handlePreviousImage = useCallback(() => {
    if (viewingImageGroupId === null || !viewingImage) return;
    
    const group = imagesData.groups.find(g => g.id === viewingImageGroupId);
    if (!group || group.images.length === 0) return;
    
    const newIndex = viewingImageIndex > 0 
      ? viewingImageIndex - 1 
      : group.images.length - 1; // Переход к последнему, если мы на первом
    
    setViewingImageIndex(newIndex);
    setViewingImage(group.images[newIndex]);
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  }, [viewingImageGroupId, viewingImageIndex, viewingImage, imagesData.groups]);

  // Функция для навигации к следующему изображению в группе
  const handleNextImage = useCallback(() => {
    if (viewingImageGroupId === null || !viewingImage) return;
    
    const group = imagesData.groups.find(g => g.id === viewingImageGroupId);
    if (!group || group.images.length === 0) return;
    
    const newIndex = viewingImageIndex < group.images.length - 1 
      ? viewingImageIndex + 1 
      : 0; // Переход к первому, если мы на последнем
    
    setViewingImageIndex(newIndex);
    setViewingImage(group.images[newIndex]);
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  }, [viewingImageGroupId, viewingImageIndex, viewingImage, imagesData.groups]);

  // Функции для управления zoom
  const handleZoomIn = () => {
    setZoomLevel( prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // Обработчик скролла мыши для зума (только для стадии Analysis)
  const handleWheel = (e: React.WheelEvent) => {
    if (!isAnalysisStage) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Определяем направление скролла и изменяем zoom
    const delta = e.deltaY;
    const zoomStep = 0.1;
    
    if (delta < 0) {
      // Скролл вверх - увеличение
      setZoomLevel(prev => Math.min(prev + zoomStep, 5));
    } else {
      // Скролл вниз - уменьшение
      setZoomLevel(prev => Math.max(prev - zoomStep, 0.5));
    }
  };

  // Обработчики для перетаскивания изображения при зуме
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - imagePosition.x,
        y: e.clientY - imagePosition.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Обработчики для touch событий (для мобильных устройств)
  const [touchDistance, setTouchDistance] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState(1);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch-to-zoom: два пальца
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setTouchDistance(distance);
      setInitialZoom(zoomLevel);
      setIsDragging(false); // Отключаем перетаскивание при pinch
    } else if (e.touches.length === 1 && zoomLevel > 1) {
      // Перетаскивание: один палец при зуме
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - imagePosition.x,
        y: e.touches[0].clientY - imagePosition.y,
      });
      setTouchDistance(null); // Сбрасываем pinch
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistance !== null) {
      // Pinch-to-zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const scale = distance / touchDistance;
      setZoomLevel(Math.max(0.5, Math.min(initialZoom * scale, 5)));
    } else if (isDragging && zoomLevel > 1 && e.touches.length === 1) {
      // Перетаскивание
      setImagePosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchDistance(null);
  };

  // Обработка клавиш для закрытия модального окна и навигации
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewingImage) return;
      
      if (e.key === 'Escape') {
        handleCloseView();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePreviousImage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextImage();
      }
    };

    if (viewingImage) {
      window.addEventListener('keydown', handleKeyDown);
      // Предотвращаем скролл страницы при открытом модальном окне
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [viewingImage, handleCloseView, handlePreviousImage, handleNextImage]);

  // Функция для пересчета номеров групп по порядку
  const renumberGroups = (groups: ImageGroup[]): ImageGroup[] => {
    return groups.map((group, index) => ({
      ...group,
      name: `SKU ${index + 1}`,
    }));
  };

  // Общая функция перемещения картинок в группу (для кнопки "Add to group" и для DnD)
  const moveImagesToGroup = useCallback((
    items: Array<{ image: ImageData; groupId: number }>,
    targetGroupId: number,
    clearSelection: boolean
  ) => {
    if (items.length === 0) return;

    const sourceGroupIds = new Set(items.map(i => i.groupId));
    if (sourceGroupIds.size === 1 && sourceGroupIds.has(targetGroupId)) return; // уже в этой группе

    setImagesData(prev => {
      const newGroups = prev.groups.map(group => ({
        ...group,
        images: [...group.images],
      }));

      items.forEach(({ image, groupId }) => {
        const sourceIdx = newGroups.findIndex(g => g.id === groupId);
        if (sourceIdx === -1) return;
        const imgIdx = newGroups[sourceIdx].images.findIndex(img => img.id === image.id);
        if (imgIdx !== -1) newGroups[sourceIdx].images.splice(imgIdx, 1);
      });

      const targetIdx = newGroups.findIndex(g => g.id === targetGroupId);
      if (targetIdx !== -1) {
        newGroups[targetIdx].images.push(...items.map(i => i.image));
      }

      const filtered = newGroups.filter(g => g.images.length > 0);
      return { ...prev, groups: renumberGroups(filtered) };
    });

    if (clearSelection) setSelectedImages([]);
    setHasMovedImages(true);
  }, []);

  // Функция для удаления выбранных картинок
  const handleDeleteSelected = () => {
    if (selectedImages.length === 0) return;

    const newGroups = imagesData.groups.map(group => ({
      ...group,
      images: group.images.filter(image => 
        !selectedImages.some(selected => 
          selected.image.id === image.id && selected.groupId === group.id
        )
      ),
    }));

    // Удаляем пустые группы
    const filteredGroups = newGroups.filter(group => group.images.length > 0);

    // Пересчитываем номера групп по порядку
    const renumberedGroups = renumberGroups(filteredGroups);

    setImagesData(prev => ({ ...prev, groups: renumberedGroups }));
    setSelectedImages([]);
    
    // Устанавливаем флаг что было действие (удаление)
    setHasMovedImages(true);
  };

  // Функция для обновления значения поля в группе
  const handleFieldChange = (groupId: number, fieldIndex: number, newValue: any) => {
    setImagesData(prev => {
      const updatedGroups = prev.groups.map(group => {
        if (group.id === groupId && group.fields) {
          return {
            ...group,
            fields: group.fields.map((field, idx) => 
              idx === fieldIndex ? { ...field, value: newValue } : field
            ),
          };
        }
        return group;
      });
      
      // Также обновляем originalData для сохранения изменений
      let updatedOriginalData = prev.originalData;
      if (updatedOriginalData?.groups && Array.isArray(updatedOriginalData.groups)) {
        const groupIndex = prev.groups.findIndex(g => g.id === groupId);
        if (groupIndex !== -1 && updatedOriginalData.groups[groupIndex]) {
          updatedOriginalData = {
            ...updatedOriginalData,
            groups: updatedOriginalData.groups.map((originalGroup: any, idx: number) => {
              if (idx === groupIndex && originalGroup.fields && Array.isArray(originalGroup.fields)) {
                return {
                  ...originalGroup,
                  fields: originalGroup.fields.map((field: any, fIdx: number) => 
                    fIdx === fieldIndex ? { ...field, value: newValue } : field
                  ),
                };
              }
              return originalGroup;
            }),
          };
        }
      }
      
      return {
        ...prev,
        groups: updatedGroups,
        originalData: updatedOriginalData,
      };
    });
  };

  // Функция для создания новой группы с выбранными картинками
  const handleCreateNewGroup = () => {
    if (selectedImages.length === 0) return;

    const newGroupId = Date.now();
    const newGroupNumber = imagesData.groups.length + 1;

    // Создаем новую группу с выбранными изображениями
    const newGroup: ImageGroup = {
      id: newGroupId,
      name: `SKU ${newGroupNumber}`,
      images: selectedImages.map(item => item.image),
    };

    // Удаляем выбранные изображения из их текущих групп
    const newGroups = imagesData.groups.map(group => ({
      ...group,
      images: group.images.filter(image => 
        !selectedImages.some(selected => 
          selected.image.id === image.id && selected.groupId === group.id
        )
      ),
    }));

    // Удаляем пустые группы
    const filteredGroups = newGroups.filter(group => group.images.length > 0);

    // Добавляем новую группу
    const updatedGroups = [...filteredGroups, newGroup];

    // Пересчитываем номера групп по порядку
    const renumberedGroups = renumberGroups(updatedGroups);

    setImagesData(prev => ({ ...prev, groups: renumberedGroups }));
    setSelectedImages([]);
    
    // Устанавливаем флаг что было перемещение (создание новой группы - это тоже перемещение)
    setHasMovedImages(true);
  };

  // Функция для добавления выбранных картинок в указанную группу
  const handleAddToGroup = (targetGroupId: number) => {
    if (selectedImages.length === 0) return;
    moveImagesToGroup(selectedImages, targetGroupId, true);
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    console.log('[DnD] Drag started', { activeId: event.active.id, data: event.active.data.current });
  }, []);

  // Обработчик завершения перетаскивания (DnD): перенос картинки/выделенных картинок в другую группу
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    console.log('[DnD] Drag ended', { activeId: active.id, overId: over?.id ?? null });

    if (!over) {
      console.log('[DnD] Drop target missing — отпустили не над группой');
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith('drag-') || !overId.startsWith('group-')) {
      console.log('[DnD] Invalid ids', { activeId, overId });
      return;
    }

    const targetGroupId = Number(overId.replace('group-', ''));
    const parts = activeId.split('-');
    if (parts.length < 3) {
      console.log('[DnD] Cannot parse activeId', { activeId, parts });
      return;
    }
    const sourceGroupId = Number(parts[1]);
    const imageId = parts.slice(2).join('-');

    if (sourceGroupId === targetGroupId) {
      console.log('[DnD] Same group, skip', { sourceGroupId, targetGroupId });
      return;
    }

    const sourceGroup = imagesData.groups.find(g => g.id === sourceGroupId);
    const image = sourceGroup?.images.find(img => img.id === imageId);
    if (!image) {
      console.log('[DnD] Image not found', { sourceGroupId, imageId, groupIds: imagesData.groups.map(g => g.id) });
      return;
    }

    const draggedInSelection = selectedImages.some(
      s => s.image.id === image.id && s.groupId === sourceGroupId
    );
    console.log('[DnD] Move', {
      targetGroupId,
      draggedInSelection,
      selectedCount: selectedImages.length,
      moveAllSelected: draggedInSelection && selectedImages.length > 0,
    });
    if (draggedInSelection && selectedImages.length > 0) {
      moveImagesToGroup(selectedImages, targetGroupId, true);
    } else {
      moveImagesToGroup([{ image, groupId: sourceGroupId }], targetGroupId, false);
    }
  }, [imagesData.groups, moveImagesToGroup, selectedImages]);

  // Функция для группировки всех картинок по умолчанию
  const handleDefaultGrouping = () => {
    // Собираем все изображения из всех групп (учитывая актуальное состояние)
    const allImages: ImageData[] = [];
    imagesData.groups.forEach(group => {
      allImages.push(...group.images);
    });

    if (allImages.length === 0) return;

    // Проверяем, есть ли fields и одинаковые ли они во всех группах
    let commonFields: FieldData[] | undefined = undefined;
    if (imagesData.groups.length > 0 && imagesData.groups[0]?.fields) {
      const firstGroupFields = imagesData.groups[0].fields;
      const allGroupsHaveSameFields = imagesData.groups.every(group => {
        if (!group.fields || group.fields.length !== firstGroupFields.length) {
          return false;
        }
        return group.fields.every((field, index) => 
          field.name === firstGroupFields[index]?.name &&
          JSON.stringify(field.enums) === JSON.stringify(firstGroupFields[index]?.enums)
        );
      });
      
      if (allGroupsHaveSameFields) {
        commonFields = firstGroupFields;
      }
    }

    // Группируем изображения по выбранному размеру
    const newGroups: ImageGroup[] = [];
    for (let i = 0; i < allImages.length; i += groupSize) {
      const groupImages = allImages.slice(i, i + groupSize);
      newGroups.push({
        id: Date.now() + i,
        name: `SKU ${newGroups.length + 1}`,
        images: groupImages,
        // Сохраняем fields только если они одинаковые во всех исходных группах
        fields: commonFields,
      });
    }

    // Пересчитываем номера групп по порядку
    const renumberedGroups = renumberGroups(newGroups);

    setImagesData(prev => ({ ...prev, groups: renumberedGroups }));
    setSelectedImages([]);
    
    // Устанавливаем флаг что было перемещение
    setHasMovedImages(true);
  };

  // Функция для AI группировки - отправляет фотки с тегом на сервер
  const handleAIGrouping = async () => {
    try {
      const userId = getUserId();
      
      if (!userId) {
        throw new Error('User ID not found');
      }

      // Проверяем наличие callback_url
      const callbackUrl = imagesData.originalData?.callback_url;
      if (!callbackUrl) {
        throw new Error('Callback URL not found in response data');
      }

      // Подготавливаем данные в формате исходного ответа (такой же как формат GET)
      // Передаем оригинальную структуру groups для сохранения fields
      const originalGroups = imagesData.originalData?.groups;
      const groups = prepareGroupsForSend(imagesData.groups, originalGroups);
      
      const payload: any = {
        user_id: userId,
        grouping_type: 'ai_grouping', // Тег для AI группировки
      };
      
      // Если groups - это объект с вложенным массивом (новый формат), используем его напрямую
      if (groups && typeof groups === 'object' && !Array.isArray(groups) && groups.groups) {
        payload.groups = groups;
      } else {
        // Иначе используем groups как есть (массив или объект)
        payload.groups = groups;
      }

      // Добавляем сохраненные исходные данные (confirmation_message и т.д., но не callback_url и не groups)
      if (imagesData.originalData) {
        Object.keys(imagesData.originalData).forEach(key => {
          if (key !== 'groups' && key !== 'user_id' && key !== 'callback_url') {
            payload[key] = imagesData.originalData![key];
          }
        });
      }
      
      // Если в оригинальных данных был массив images на верхнем уровне, обновляем его
      if (imagesData.originalData?.images && Array.isArray(imagesData.originalData.images)) {
        // Обновляем images на основе текущих групп
        // Собираем все изображения из всех групп
        const allImages: any[] = [];
        imagesData.groups.forEach((group) => {
          group.images.forEach((image) => {
            // Если это URL Google Drive, извлекаем только ID
            const driveId = extractGoogleDriveId(image.binaryData);
            if (driveId) {
              allImages.push(driveId);
            } else {
              // Иначе обрабатываем как base64
              let base64Data = image.binaryData;
              if (base64Data.startsWith('data:image')) {
                base64Data = base64Data.split(',')[1] || base64Data;
              }
              allImages.push(base64Data);
            }
          });
        });
        payload.images = allImages;
      }

      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

      // Показываем сообщение об успехе
      const message = 'AI grouping in progress. You will receive a message when it is ready!';
      
      // Очищаем все данные и показываем пустой экран с попапом
      setImagesData({ groups: [] });
      setSelectedImages([]);
      setSuccessMessage(message);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('AI Grouping failed:', error);
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`AI Grouping error: ${errorMessage}`);
      } else {
        alert(`AI Grouping error: ${errorMessage}`);
      }
    }
  };

  // Функция для преобразования groups в формат для отправки (такой же как формат ответа GET)
  const prepareGroupsForSend = (groups: ImageGroup[], originalGroups?: any) => {
    // Проверяем новый формат: groups - это объект с вложенным массивом groups
    if (originalGroups && typeof originalGroups === 'object' && !Array.isArray(originalGroups) && originalGroups.groups && Array.isArray(originalGroups.groups)) {
      // Обрабатываем формат с объектом groups, содержащим массив groups внутри
      const originalGroupsArray = originalGroups.groups;
      const resultGroups = groups.map((currentGroup, groupIndex: number) => {
        const originalGroup = originalGroupsArray[groupIndex];
        
        // Если это новая группа (не было в оригинальных данных)
        if (!originalGroup) {
          // Создаем новую структуру для новой группы
          const newGroup: any = {
            group_id: currentGroup.id || (groupIndex + 1),
          };
          
          // Если у текущей группы есть fields, добавляем их
          if (currentGroup.fields && Array.isArray(currentGroup.fields)) {
            newGroup.fields = currentGroup.fields.map((field) => ({
              name: field.name,
              enums: field.enums || [],
              value: field.value,
            }));
          }
          
          // Добавляем images
          newGroup.images = currentGroup.images.map((image) => {
            // Если это URL Google Drive, извлекаем только ID
            const driveId = extractGoogleDriveId(image.binaryData);
            if (driveId) {
              return driveId;
            }
            
            // Иначе обрабатываем как base64
            let base64Data = image.binaryData;
            if (base64Data.startsWith('data:image')) {
              base64Data = base64Data.split(',')[1] || base64Data;
            }
            return base64Data;
          });
          
          return newGroup;
        }
        
        // Если у оригинальной группы есть fields, сохраняем их с обновленными значениями
        if (originalGroup.fields && Array.isArray(originalGroup.fields)) {
          // Обновляем fields с актуальными значениями из currentGroup
          const updatedFields = originalGroup.fields.map((originalField: any, fieldIndex: number) => {
            if (currentGroup.fields && currentGroup.fields[fieldIndex]) {
              return {
                ...originalField,
                value: currentGroup.fields[fieldIndex].value,
              };
            }
            return originalField;
          });
          
          return {
            ...originalGroup,
            fields: updatedFields,
            // Обновляем images если они есть в оригинальной структуре
            images: currentGroup.images.map((image) => {
              // Если это URL Google Drive, извлекаем только ID
              const driveId = extractGoogleDriveId(image.binaryData);
              if (driveId) {
                return driveId;
              }
              
              // Иначе обрабатываем как base64
              let base64Data = image.binaryData;
              if (base64Data.startsWith('data:image')) {
                base64Data = base64Data.split(',')[1] || base64Data;
              }
              return base64Data; // В формате с fields images может быть массивом строк
            }),
          };
        }
        
        // Если у оригинальной группы есть images как массив объектов
        if (originalGroup.images && Array.isArray(originalGroup.images)) {
          return {
            ...originalGroup,
            images: currentGroup.images.map((image, imgIndex) => {
              // Если это URL Google Drive, извлекаем только ID
              const driveId = extractGoogleDriveId(image.binaryData);
              let imageValue: string;
              
              if (driveId) {
                imageValue = driveId;
              } else {
                // Иначе обрабатываем как base64
                let base64Data = image.binaryData;
                if (base64Data.startsWith('data:image')) {
                  base64Data = base64Data.split(',')[1] || base64Data;
                }
                imageValue = base64Data;
              }
              
              // Если оригинальный элемент был объектом с fields, сохраняем структуру
              const originalImage = originalGroup.images[imgIndex];
              if (originalImage && typeof originalImage === 'object' && originalImage.fields) {
                return {
                  ...originalImage,
                  image_value: imageValue,
                };
              }
              
              // Если оригинальный элемент был объектом с image_value
              if (originalImage && typeof originalImage === 'object' && originalImage.image_value !== undefined) {
                return {
                  ...originalImage,
                  image_value: imageValue,
                };
              }
              
              // Иначе возвращаем просто строку (ID или base64)
              return imageValue;
            }),
          };
        }
        
        // Если оригинальная группа не имеет fields или images, создаем базовую структуру
        return {
          ...originalGroup,
          group_id: currentGroup.id || originalGroup.group_id || (groupIndex + 1),
          images: currentGroup.images.map((image) => {
            const driveId = extractGoogleDriveId(image.binaryData);
            if (driveId) {
              return driveId;
            }
            let base64Data = image.binaryData;
            if (base64Data.startsWith('data:image')) {
              base64Data = base64Data.split(',')[1] || base64Data;
            }
            return base64Data;
          }),
        };
      });
      
      // Возвращаем в формате объекта с вложенным массивом groups
      return {
        groups: resultGroups,
      };
    }
    // Проверяем, был ли исходный формат массивом (с fields)
    else if (originalGroups && Array.isArray(originalGroups)) {
      // Обрабатываем все группы из текущего состояния, а не только из originalGroups
      const resultGroups = groups.map((currentGroup, groupIndex: number) => {
        const originalGroup = originalGroups[groupIndex];
        
        // Если это новая группа (не было в оригинальных данных)
        if (!originalGroup) {
          // Создаем новую структуру для новой группы
          const newGroup: any = {
            id: currentGroup.id?.toString() || (groupIndex + 1).toString(),
          };
          
          // Если у текущей группы есть fields, добавляем их
          if (currentGroup.fields && Array.isArray(currentGroup.fields)) {
            newGroup.fields = currentGroup.fields.map((field) => ({
              name: field.name,
              enums: field.enums || [],
              value: field.value,
            }));
          }
          
          // Добавляем images
          newGroup.images = currentGroup.images.map((image) => {
            // Если это URL Google Drive, извлекаем только ID
            const driveId = extractGoogleDriveId(image.binaryData);
            if (driveId) {
              return driveId;
            }
            
            // Иначе обрабатываем как base64
            let base64Data = image.binaryData;
            if (base64Data.startsWith('data:image')) {
              base64Data = base64Data.split(',')[1] || base64Data;
            }
            return base64Data;
          });
          
          return newGroup;
        }
        
        // Если у оригинальной группы есть fields, сохраняем их с обновленными значениями
        if (originalGroup.fields && Array.isArray(originalGroup.fields)) {
          // Обновляем fields с актуальными значениями из currentGroup
          const updatedFields = originalGroup.fields.map((originalField: any, fieldIndex: number) => {
            if (currentGroup.fields && currentGroup.fields[fieldIndex]) {
              return {
                ...originalField,
                value: currentGroup.fields[fieldIndex].value,
              };
            }
            return originalField;
          });
          
          return {
            ...originalGroup,
            fields: updatedFields,
            // Обновляем images если они есть в оригинальной структуре
            images: currentGroup.images.map((image) => {
              // Если это URL Google Drive, извлекаем только ID
              const driveId = extractGoogleDriveId(image.binaryData);
              if (driveId) {
                return driveId;
              }
              
              // Иначе обрабатываем как base64
              let base64Data = image.binaryData;
              if (base64Data.startsWith('data:image')) {
                base64Data = base64Data.split(',')[1] || base64Data;
              }
              return base64Data; // В формате с fields images может быть массивом строк
            }),
          };
        }
        
        // Если у оригинальной группы есть images как массив объектов
        if (originalGroup.images && Array.isArray(originalGroup.images)) {
          return {
            ...originalGroup,
            images: currentGroup.images.map((image, imgIndex) => {
              // Если это URL Google Drive, извлекаем только ID
              const driveId = extractGoogleDriveId(image.binaryData);
              let imageValue: string;
              
              if (driveId) {
                imageValue = driveId;
              } else {
                // Иначе обрабатываем как base64
                let base64Data = image.binaryData;
                if (base64Data.startsWith('data:image')) {
                  base64Data = base64Data.split(',')[1] || base64Data;
                }
                imageValue = base64Data;
              }
              
              // Если оригинальный элемент был объектом с fields, сохраняем структуру
              const originalImage = originalGroup.images[imgIndex];
              if (originalImage && typeof originalImage === 'object' && originalImage.fields) {
                return {
                  ...originalImage,
                  image_value: imageValue,
                };
              }
              
              // Если оригинальный элемент был объектом с image_value
              if (originalImage && typeof originalImage === 'object' && originalImage.image_value !== undefined) {
                return {
                  ...originalImage,
                  image_value: imageValue,
                };
              }
              
              // Иначе возвращаем просто строку (ID или base64)
              return imageValue;
            }),
          };
        }
        
        // Если оригинальная группа не имеет fields или images, создаем базовую структуру
        return {
          ...originalGroup,
          id: currentGroup.id?.toString() || originalGroup.id || (groupIndex + 1).toString(),
          images: currentGroup.images.map((image) => {
            const driveId = extractGoogleDriveId(image.binaryData);
            if (driveId) {
              return driveId;
            }
            let base64Data = image.binaryData;
            if (base64Data.startsWith('data:image')) {
              base64Data = base64Data.split(',')[1] || base64Data;
            }
            return base64Data;
          }),
        };
      });
      
      return resultGroups;
    }
    
    // Старый формат: объект с ключами-группами
    const groupsObject: { [key: string]: Array<{ index: number; image_value: string }> } = {};
    
    groups.forEach((group, groupIndex) => {
      const groupKey = (groupIndex + 1).toString();
      groupsObject[groupKey] = group.images.map((image) => {
        // Если это URL Google Drive, извлекаем только ID
        const driveId = extractGoogleDriveId(image.binaryData);
        let imageValue: string;
        
        if (driveId) {
          imageValue = driveId;
        } else {
          // Иначе обрабатываем как base64
          let base64Data = image.binaryData;
          if (base64Data.startsWith('data:image')) {
            base64Data = base64Data.split(',')[1] || base64Data;
          }
          imageValue = base64Data;
        }
        
        return {
          index: image.index ?? 0,
          image_value: imageValue,
        };
      });
    });
    
    return groupsObject;
  };

  // Функция для отправки подтверждения
  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const userId = getUserId();
      
      if (!userId) {
        throw new Error('User ID not found');
      }

      // Проверяем наличие callback_url
      const callbackUrl = imagesData.originalData?.callback_url;
      if (!callbackUrl) {
        throw new Error('Callback URL not found in response data');
      }

      // Подготавливаем данные в формате исходного ответа (такой же как формат GET)
      // Передаем оригинальную структуру groups для сохранения fields
      const originalGroups = imagesData.originalData?.groups;
      const groups = prepareGroupsForSend(imagesData.groups, originalGroups);
      
      const payload: any = {
        user_id: userId,
      };
      
      // Если groups - это объект с вложенным массивом (новый формат), используем его напрямую
      if (groups && typeof groups === 'object' && !Array.isArray(groups) && groups.groups) {
        payload.groups = groups;
      } else {
        // Иначе используем groups как есть (массив или объект)
        payload.groups = groups;
      }

      // Добавляем сохраненные исходные данные (confirmation_message и т.д., но не callback_url и не groups и не status и не groupIndex)
      if (imagesData.originalData) {
        Object.keys(imagesData.originalData).forEach(key => {
          if (key !== 'groups' && key !== 'user_id' && key !== 'callback_url' && key !== 'status' && key !== 'groupIndex') {
            payload[key] = imagesData.originalData![key];
          }
        });
      }
      
      // Если в оригинальных данных был массив images на верхнем уровне, обновляем его
      if (imagesData.originalData?.images && Array.isArray(imagesData.originalData.images)) {
        // Обновляем images на основе текущих групп
        // Собираем все изображения из всех групп
        const allImages: any[] = [];
        imagesData.groups.forEach((group) => {
          group.images.forEach((image) => {
            // Если это URL Google Drive, извлекаем только ID
            const driveId = extractGoogleDriveId(image.binaryData);
            if (driveId) {
              allImages.push(driveId);
            } else {
              // Иначе обрабатываем как base64
              let base64Data = image.binaryData;
              if (base64Data.startsWith('data:image')) {
                base64Data = base64Data.split(',')[1] || base64Data;
              }
              allImages.push(base64Data);
            }
          });
        });
        payload.images = allImages;
      }

      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

      // Показываем сообщение об успехе
      const message = imagesData.originalData?.confirmation_message || 'Changes confirmed successfully!';
      
      // Очищаем все данные и показываем пустой экран с попапом
      setImagesData({ groups: [] });
      setSelectedImages([]);
      setSuccessMessage(message);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Confirm failed:', error);
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`Confirm error: ${errorMessage}`);
      } else {
        alert(`Confirm error: ${errorMessage}`);
      }
    } finally {
      setIsConfirming(false);
    }
  };

  // Функция для сохранения текущей группы (аналогична handleConfirm, но с дополнительными полями)
  const handleSave = async (groupIndex: number) => {
    setIsSaving(true);
    try {
      const userId = getUserId();
      
      if (!userId) {
        throw new Error('User ID not found');
      }

      // Проверяем наличие callback_url
      const callbackUrl = imagesData.originalData?.callback_url;
      if (!callbackUrl) {
        throw new Error('Callback URL not found in response data');
      }

      // Подготавливаем данные в формате исходного ответа (такой же как формат GET)
      // Передаем оригинальную структуру groups для сохранения fields
      const originalGroups = imagesData.originalData?.groups;
      const groups = prepareGroupsForSend(imagesData.groups, originalGroups);
      
      const payload: any = {
        user_id: userId,
        status: 'save',
        groupIndex: groupIndex,
      };
      
      // Если groups - это объект с вложенным массивом (новый формат), используем его напрямую
      if (groups && typeof groups === 'object' && !Array.isArray(groups) && groups.groups) {
        payload.groups = groups;
      } else {
        // Иначе используем groups как есть (массив или объект)
        payload.groups = groups;
      }

      // Добавляем сохраненные исходные данные (confirmation_message и т.д., но не callback_url и не groups и не groupIndex)
      if (imagesData.originalData) {
        Object.keys(imagesData.originalData).forEach(key => {
          if (key !== 'groups' && key !== 'user_id' && key !== 'callback_url' && key !== 'groupIndex') {
            payload[key] = imagesData.originalData![key];
          }
        });
      }
      
      // Если в оригинальных данных был массив images на верхнем уровне, обновляем его
      if (imagesData.originalData?.images && Array.isArray(imagesData.originalData.images)) {
        // Обновляем images на основе текущих групп
        // Собираем все изображения из всех групп
        const allImages: any[] = [];
        imagesData.groups.forEach((group) => {
          group.images.forEach((image) => {
            // Если это URL Google Drive, извлекаем только ID
            const driveId = extractGoogleDriveId(image.binaryData);
            if (driveId) {
              allImages.push(driveId);
            } else {
              // Иначе обрабатываем как base64
              let base64Data = image.binaryData;
              if (base64Data.startsWith('data:image')) {
                base64Data = base64Data.split(',')[1] || base64Data;
              }
              allImages.push(base64Data);
            }
          });
        });
        payload.images = allImages;
      }

      // Устанавливаем groupIndex в самом конце, чтобы он точно не перезаписался
      payload.groupIndex = groupIndex;

      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

      // Показываем сообщение об успехе без закрытия приложения
      const message = imagesData.originalData?.confirmation_message || 'Changes saved successfully!';
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(message);
      } else {
        alert(message);
      }
    } catch (error) {
      console.error('Save failed:', error);
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`Save error: ${errorMessage}`);
      } else {
        alert(`Save error: ${errorMessage}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isTestMode = new URLSearchParams(window.location.search).get('test') === '1';

  return (
    <div className="min-h-screen bg-gradient-subtle p-4">
      <div className="max-w-7xl mx-auto pt-4">
        {isTestMode && (
          <div className="mb-4">
            <Badge variant="secondary" className="bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40">
              Тестовый режим (test bot)
            </Badge>
          </div>
        )}
        {telegramUser && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Твой Telegram ID: <strong className="text-foreground">{telegramUser.id}</strong>
            </p>
          </div>
        )}
        {/* Custom instruction text at top of screen */}
        {!isLoading && imagesData.groups.length > 0 && (
          <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm sm:text-base text-foreground font-medium">
              {isAnalysisStage 
                ? "Review each SKU analysis. Click on any photo to zoom. Edit fields if needed and confirm."
                : "Check the correct grouping of each SKU. Confirm if all SKUs are grouped correctly."}
            </p>
          </div>
        )}
        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Loading images...</p>
          </div>
        )}

        {!isLoading && (
          imagesData.groups.length === 0 && !showSuccessModal ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No data available</p>
            </div>
          ) : imagesData.groups.length === 0 && showSuccessModal ? (
            <div className="text-center py-12">
              {/* Пустой экран - модальное окно показывается отдельно */}
            </div>
          ) : (
            <div className="space-y-6 pb-32">
              {/* Для стадии Analysis: показываем только текущий SKU с пагинацией */}
              {isAnalysisStage && analysisSkus.length > 0 ? (
                (() => {
                  const currentGroup = analysisSkus[currentSkuIndex];
                  const isMobile = isMobileDevice();
                  const isLastSku = currentSkuIndex === analysisSkus.length - 1;
                  const isFirstSku = currentSkuIndex === 0;
                  
                  return (
                    <Card 
                      key={currentGroup.id}
                      onTouchStart={(e) => {
                        // Предотвращаем случайные свайпы назад в Safari при взаимодействии с формой
                        const target = e.target as HTMLElement;
                        if (target.tagName === 'INPUT' || target.closest('input') || target.tagName === 'BUTTON' || target.closest('button')) {
                          e.stopPropagation();
                        }
                      }}
                      style={{ touchAction: 'pan-y' }}
                    >
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                          <span>{currentGroup.name}</span>
                          <Badge variant="secondary" className="text-xs sm:text-sm">
                            {currentSkuIndex + 1} / {analysisSkus.length} • {currentGroup.images.length} images
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      
                      {/* Для стадии Analysis: специальный layout */}
                      <div className="flex flex-col md:flex-row">
                        {/* Фотографии: вверху на mobile (горизонтальный скролл), слева на desktop (вертикальный скролл) */}
                        <div className="p-4 sm:p-6 border-b md:border-b-0 md:border-r md:w-64 md:flex-shrink-0 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto md:max-h-[600px]">
                          <div className="flex gap-2 sm:gap-4 pb-2 md:pb-0 md:flex-col">
                            {currentGroup.images.map((image) => {
                              return (
                                <div
                                  key={`${currentGroup.id}-${image.id}`}
                                  className="relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all border-border hover:border-primary/50 flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 md:w-full md:aspect-square"
                                  onClick={(e) => handleImageClick(image, currentGroup.id, e)}
                                >
                                  <div className="w-full h-full bg-muted flex items-center justify-center relative overflow-hidden">
                                    <img
                                      src={normalizeImageUrl(image.binaryData)}
                                      alt={image.name || image.id}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        const src = target.src;
                                        
                                        // Пытаемся извлечь ID из исходного binaryData или из текущего src
                                        let driveId: string | null = null;
                                        
                                        // Сначала проверяем исходный binaryData
                                        if (isGoogleDriveId(image.binaryData) && !image.binaryData.includes('drive.google.com') && !image.binaryData.includes('googleusercontent.com') && !image.binaryData.startsWith('data:')) {
                                          driveId = image.binaryData;
                                        } else {
                                          // Пытаемся извлечь ID из binaryData или src
                                          driveId = extractGoogleDriveId(image.binaryData) || extractGoogleDriveId(src);
                                        }
                                        
                                        if (driveId) {
                                          // Пробуем разные форматы Google Drive URL
                                          if (src.includes('uc?export=view')) {
                                            target.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
                                          } else if (src.includes('thumbnail')) {
                                            target.src = `https://drive.google.com/uc?export=view&id=${driveId}`;
                                          } else {
                                            // Если ничего не помогло, пробуем thumbnail
                                            target.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
                                          }
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Поля: внизу на mobile, справа на desktop */}
                        <div 
                          className="px-4 sm:px-6 py-4 sm:py-6 md:flex-1"
                          onTouchStart={(e) => {
                            // Предотвращаем случайные свайпы назад в Safari при взаимодействии с полями
                            const target = e.target as HTMLElement;
                            if (target.tagName === 'INPUT' || target.closest('input')) {
                              e.stopPropagation();
                            }
                          }}
                          style={{ touchAction: 'pan-y' }}
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {currentGroup.fields.map((field, fieldIndex) => (
                              <div key={fieldIndex} className="space-y-2">
                                <Label htmlFor={`field-${currentGroup.id}-${fieldIndex}`} className="text-sm font-medium">
                                  {field.name}
                                </Label>
                                {field.enums && field.enums.length > 0 ? (
                                  // Dropdown для полей с enum
                                  <Select
                                    value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                                    onValueChange={(value) => handleFieldChange(currentGroup.id, fieldIndex, value)}
                                  >
                                    <SelectTrigger id={`field-${currentGroup.id}-${fieldIndex}`} className="w-full">
                                      <SelectValue placeholder="Select value..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {field.enums.map((enumValue, enumIndex) => (
                                        <SelectItem key={enumIndex} value={String(enumValue)}>
                                          {String(enumValue)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  // Input для полей без enum
                                  <Input
                                    id={`field-${currentGroup.id}-${fieldIndex}`}
                                    type={typeof field.value === 'number' ? 'number' : 'text'}
                                    value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                                    onChange={(e) => {
                                      const newValue = typeof field.value === 'number' 
                                        ? parseFloat(e.target.value) || 0
                                        : e.target.value;
                                      handleFieldChange(currentGroup.id, fieldIndex, newValue);
                                    }}
                                    onFocus={(e) => {
                                      // Предотвращаем автозаполнение Safari
                                      e.target.setAttribute('autocomplete', 'off');
                                    }}
                                    onTouchStart={(e) => {
                                      // Предотвращаем случайные свайпы назад в Safari
                                      e.stopPropagation();
                                    }}
                                    onTouchMove={(e) => {
                                      // Предотвращаем случайные свайпы назад в Safari при вводе
                                      e.stopPropagation();
                                    }}
                                    autoComplete="off"
                                    placeholder={`Enter ${field.name.toLowerCase()}...`}
                                    className="w-full"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Кнопки пагинации для стадии Analysis */}
                      <div className="p-4 sm:p-6 border-t flex gap-2 sm:gap-3 min-w-0">
                        <Button
                          onClick={() => setCurrentSkuIndex(prev => Math.max(0, prev - 1))}
                          disabled={isFirstSku}
                          variant="outline"
                          size="lg"
                          className="flex-1 sm:flex-initial sm:min-w-[120px] min-w-0 shrink"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
                          <span className="truncate">Back</span>
                        </Button>
                        <Button
                          onClick={() => {
                            const pageNumber = currentSkuIndex + 1;
                            console.log('Номер страницы:', pageNumber);
                            handleSave(currentSkuIndex + 1);
                          }}
                          disabled={isSaving}
                          size="lg"
                          variant="outline"
                          className="flex-1 sm:flex-initial sm:min-w-[120px] min-w-0 shrink"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 sm:mr-2 animate-spin shrink-0" />
                              <span className="truncate">Saving...</span>
                            </>
                          ) : (
                            <>
                              <span className="truncate">Save</span>
                            </>
                          )}
                        </Button>
                        {isLastSku ? (
                          <Button
                            onClick={handleConfirm}
                            disabled={isConfirming}
                            size="lg"
                            className="flex-1 sm:flex-initial sm:min-w-[120px] min-w-0 shrink shadow-lg bg-green-600 hover:bg-green-700 text-white border-0"
                          >
                            {isConfirming ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 sm:mr-2 animate-spin shrink-0" />
                                <span className="truncate">Confirming...</span>
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
                                <span className="truncate">Confirm</span>
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setCurrentSkuIndex(prev => Math.min(analysisSkus.length - 1, prev + 1))}
                            size="lg"
                            className="flex-1 sm:flex-initial sm:min-w-[120px] min-w-0 shrink bg-primary hover:bg-primary/90 text-white"
                          >
                            <span className="truncate">Next</span>
                            <ChevronRight className="h-4 w-4 ml-1 sm:ml-2 shrink-0" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })()
              ) : (
                // Для стадии Grouping: показываем все группы с DnD
                <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} sensors={sensors}>
                {imagesData.groups.map((group) => {
                  const isMobile = isMobileDevice();
                  const hasFields = group.fields && group.fields.length > 0;
                  
                  return (
                  <DroppableGroup key={group.id} groupId={group.id}>
                  <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                      <span>{group.name}</span>
                      <Badge variant="secondary" className="text-xs sm:text-sm">{group.images.length} images</Badge>
                    </CardTitle>
                  </CardHeader>
                  
                  {/* Для стадии Grouping: обычный layout */}
                  {hasFields && (
                    <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-b">
                      <div 
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                        onTouchStart={(e) => {
                          // Предотвращаем случайные свайпы назад в Safari при взаимодействии с полями
                          const target = e.target as HTMLElement;
                          if (target.tagName === 'INPUT' || target.closest('input')) {
                            e.stopPropagation();
                          }
                        }}
                        style={{ touchAction: 'pan-y' }}
                      >
                        {group.fields.map((field, fieldIndex) => (
                          <div key={fieldIndex} className="space-y-2">
                            <Label htmlFor={`field-${group.id}-${fieldIndex}`} className="text-sm font-medium">
                              {field.name}
                            </Label>
                            {field.enums && field.enums.length > 0 ? (
                              // Dropdown для полей с enum
                              <Select
                                value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                                onValueChange={(value) => handleFieldChange(group.id, fieldIndex, value)}
                              >
                                <SelectTrigger id={`field-${group.id}-${fieldIndex}`} className="w-full">
                                  <SelectValue placeholder="Select value..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {field.enums.map((enumValue, enumIndex) => (
                                    <SelectItem key={enumIndex} value={String(enumValue)}>
                                      {String(enumValue)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              // Input для полей без enum
                              <Input
                                id={`field-${group.id}-${fieldIndex}`}
                                type={typeof field.value === 'number' ? 'number' : 'text'}
                                value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                                onChange={(e) => {
                                  const newValue = typeof field.value === 'number' 
                                    ? parseFloat(e.target.value) || 0
                                    : e.target.value;
                                  handleFieldChange(group.id, fieldIndex, newValue);
                                }}
                                onFocus={(e) => {
                                  // Предотвращаем автозаполнение Safari
                                  e.target.setAttribute('autocomplete', 'off');
                                }}
                                onTouchStart={(e) => {
                                  // Предотвращаем случайные свайпы назад в Safari
                                  e.stopPropagation();
                                }}
                                onTouchMove={(e) => {
                                  // Предотвращаем случайные свайпы назад в Safari при вводе
                                  e.stopPropagation();
                                }}
                                autoComplete="off"
                                placeholder={`Enter ${field.name.toLowerCase()}...`}
                                className="w-full"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
                      {group.images.map((image) => {
                        const isSelected = selectedImages.some(
                          item => item.image.id === image.id && item.groupId === group.id
                        );

                        return (
                          <DraggableImage
                            key={`${group.id}-${image.id}`}
                            id={`drag-${group.id}-${image.id}`}
                            groupId={group.id}
                            image={image}
                            disabled={isAnalysisStage}
                          >
                          <div
                            className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                              !isAnalysisStage && isSelected
                                ? 'border-primary ring-2 ring-primary'
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={(e) => handleImageClick(image, group.id, e)}
                          >
                            <div className="aspect-square bg-muted flex items-center justify-center relative overflow-hidden select-none">
                              <img
                                src={normalizeImageUrl(image.binaryData)}
                                alt={image.name || image.id}
                                className="w-full h-full object-cover pointer-events-none"
                                draggable={false}
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  const src = target.src;
                                  
                                  // Пытаемся извлечь ID из исходного binaryData или из текущего src
                                  let driveId: string | null = null;
                                  
                                  // Сначала проверяем исходный binaryData
                                  if (isGoogleDriveId(image.binaryData) && !image.binaryData.includes('drive.google.com') && !image.binaryData.includes('googleusercontent.com') && !image.binaryData.startsWith('data:')) {
                                    driveId = image.binaryData;
                                  } else {
                                    // Пытаемся извлечь ID из binaryData или src
                                    driveId = extractGoogleDriveId(image.binaryData) || extractGoogleDriveId(src);
                                  }
                                  
                                  if (driveId) {
                                    // Пробуем разные форматы Google Drive URL
                                    if (src.includes('uc?export=view')) {
                                      target.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
                                    } else if (src.includes('thumbnail')) {
                                      target.src = `https://drive.google.com/uc?export=view&id=${driveId}`;
                                    } else {
                                      // Если ничего не помогло, пробуем thumbnail
                                      target.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
                                    }
                                  }
                                }}
                              />
                              {!isAnalysisStage && isSelected && (
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                                  <ImageIcon className="h-8 w-8 text-white" />
                                </div>
                              )}
                              {/* Кнопка для просмотра в полный экран - только для стадии Grouping */}
                              {!isAnalysisStage && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewImage(image, group.id, e);
                                  }}
                                  className="absolute top-2 left-2 z-10 p-1.5 bg-black/50 hover:bg-black/70 rounded-md transition-all"
                                  title="View fullscreen"
                                >
                                  <Maximize2 className="h-4 w-4 text-white" />
                                </button>
                              )}
                            </div>
                            {!isAnalysisStage && isSelected && (
                              <div className="absolute top-2 right-2 z-10">
                                <Badge className="bg-primary">
                                  <Check className="h-3 w-3 mr-1" />
                                  Selected
                                </Badge>
                              </div>
                            )}
                          </div>
                          </DraggableImage>
                        );
                      })}
                      {/* Кнопка добавления выбранных картинок в группу — слот с + всегда виден в Grouping */}
                      {!isAnalysisStage && (
                        <button
                          type="button"
                          onClick={() => selectedImages.length > 0 && handleAddToGroup(group.id)}
                          disabled={selectedImages.length === 0}
                          className="relative rounded-lg overflow-hidden border-2 border-dashed aspect-square bg-muted flex items-center justify-center transition-all min-h-[80px] disabled:opacity-50 disabled:cursor-not-allowed enabled:cursor-pointer enabled:border-border enabled:hover:border-primary/50 enabled:hover:bg-primary/5"
                          title={selectedImages.length > 0 ? `Добавить ${selectedImages.length} выбр. в эту группу` : 'Выделите картинки, чтобы добавить в группу'}
                        >
                          <Plus className={`h-6 w-6 ${selectedImages.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
                  </DroppableGroup>
                  );
                })}
                </DndContext>
              )}
              
            </div>
          )
        )}

        {/* Кнопки управления группировкой и выбором - адаптивный блок (только для стадии Grouping) */}
        {!showSuccessModal && !isAnalysisStage && (
          <div 
            className="fixed bottom-4 left-4 right-4 z-20"
            style={{ 
              position: 'fixed',
              bottom: '1rem',
              left: '1rem',
              right: '1rem',
              zIndex: 20,
              maxWidth: 'calc(100% - 2rem)',
            }}
          >
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center max-w-full">
              {/* Кнопки управления выбором (показываются когда есть выбранные изображения) - всегда в одну строку */}
              {selectedImages.length > 0 && (
                <Card className="shadow-lg border">
                  <CardContent className="p-3">
                    <div className="flex flex-row items-center gap-2">
                      <div className="flex items-center justify-center min-w-[32px] h-9 px-2.5 bg-primary/10 rounded-md">
                        <span className="text-sm font-semibold text-primary">
                          {selectedImages.length}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-border" />
                      <Button
                        onClick={handleDeleteSelected}
                        variant="outline"
                        size="sm"
                        className="h-9 hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                        title="Delete selected images"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={handleCreateNewGroup}
                        variant="outline"
                        size="sm"
                        className="h-9 hover:bg-primary/10 hover:text-primary hover:border-primary"
                        title="Create new SKU with selected images"
                      >
                        <FolderPlus className="h-4 w-4" />
                      </Button>
                      <div className="h-6 w-px bg-border" />
                      <Button
                        onClick={() => setSelectedImages([])}
                        variant="ghost"
                        size="sm"
                        className="h-9 hover:bg-destructive/10 hover:text-destructive"
                        title="Clear selection"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Кнопки управления группировкой */}
              {imagesData.groups.length > 0 && (
                <Card className="shadow-lg border">
                  <CardContent className="p-3">
                    <div className="flex flex-row items-center gap-2">
                      <Select
                        value={String(groupSize)}
                        onValueChange={(value) => setGroupSize(Number(value) as 2 | 3 | 4 | 5)}
                      >
                        <SelectTrigger className="w-20 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleDefaultGrouping}
                        variant="outline"
                        size="sm"
                        className="h-9"
                        title="Group all images by selected size"
                      >
                        Default Grouping
                      </Button>
                      <Button
                        onClick={handleAIGrouping}
                        variant="outline"
                        size="sm"
                        className="h-9"
                        title="AI Grouping - send images for AI grouping"
                      >
                        AI Grouping
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Кнопка подтверждения */}
              <Button
                onClick={handleConfirm}
                disabled={isConfirming || imagesData.groups.length === 0}
                size="lg"
                className="shadow-lg bg-green-600 hover:bg-green-700 text-white border-0 transition-all duration-200 hover:shadow-xl hover:scale-105 disabled:hover:scale-100 disabled:opacity-70 text-sm sm:text-base px-4 sm:px-6 w-full sm:w-auto"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Confirm Changes</span>
                    <span className="sm:hidden">Confirm</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Модальное окно для просмотра изображения в полный экран */}
        {viewingImage && viewingImageGroupId !== null && (() => {
          const currentGroup = imagesData.groups.find(g => g.id === viewingImageGroupId);
          const canNavigate = currentGroup && currentGroup.images.length > 1;
          const currentImageNumber = viewingImageIndex + 1;
          const totalImages = currentGroup?.images.length || 0;
          
          return (
            <div
              className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
              onClick={handleCloseView}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Кнопка закрытия */}
              <button
                onClick={handleCloseView}
                className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-all"
                title="Close (Esc)"
              >
                <X className="h-6 w-6 text-white" />
              </button>

              {/* Кнопка навигации влево */}
              {canNavigate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreviousImage();
                  }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-50 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-all"
                  title="Previous image (←)"
                >
                  <ChevronLeft className="h-8 w-8 text-white" />
                </button>
              )}

              {/* Кнопка навигации вправо */}
              {canNavigate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextImage();
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-50 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-all"
                  title="Next image (→)"
                >
                  <ChevronRight className="h-8 w-8 text-white" />
                </button>
              )}

              {/* Индикатор текущего изображения */}
              {canNavigate && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-black/50 rounded-full">
                  <span className="text-white text-sm font-medium">
                    {currentImageNumber} / {totalImages}
                  </span>
                </div>
              )}

            {/* Панель управления zoom */}
            <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomIn();
                }}
                className="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-all"
                title="Zoom in"
              >
                <ZoomIn className="h-5 w-5 text-white" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomOut();
                }}
                className="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-all"
                title="Zoom out"
              >
                <ZoomOut className="h-5 w-5 text-white" />
              </button>
              {zoomLevel !== 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetZoom();
                  }}
                  className="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-all text-white text-xs"
                  title="Reset zoom"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Индикатор уровня zoom */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-3 py-1.5 bg-black/50 rounded-full">
              <span className="text-white text-sm font-medium">
                {Math.round(zoomLevel * 100)}%
              </span>
            </div>

            {/* Изображение */}
            <div
              className="relative w-full h-full flex items-center justify-center overflow-hidden"
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={normalizeImageUrl(viewingImage.binaryData)}
                alt={viewingImage.name || viewingImage.id}
                className="max-w-full max-h-full object-contain select-none"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const src = target.src;
                  
                  // Пытаемся извлечь ID из исходного binaryData или из текущего src
                  let driveId: string | null = null;
                  
                  // Сначала проверяем исходный binaryData
                  if (isGoogleDriveId(viewingImage.binaryData) && !viewingImage.binaryData.includes('drive.google.com') && !viewingImage.binaryData.includes('googleusercontent.com') && !viewingImage.binaryData.startsWith('data:')) {
                    driveId = viewingImage.binaryData;
                  } else {
                    // Пытаемся извлечь ID из binaryData или src
                    driveId = extractGoogleDriveId(viewingImage.binaryData) || extractGoogleDriveId(src);
                  }
                  
                  if (driveId) {
                    // Пробуем разные форматы Google Drive URL
                    if (src.includes('uc?export=view')) {
                      target.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
                    } else if (src.includes('thumbnail')) {
                      target.src = `https://drive.google.com/uc?export=view&id=${driveId}`;
                    } else {
                      // Если ничего не помогло, пробуем thumbnail
                      target.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
                    }
                  }
                }}
                style={{
                  transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
                  cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                }}
                draggable={false}
              />
            </div>
          </div>
          );
        })()}

        {/* Модальное окно успешного подтверждения */}
        <Dialog open={showSuccessModal} onOpenChange={(open) => {
          // Не позволяем закрыть модальное окно кликом вне его или ESC
          // Пользователь должен нажать OK
          if (!open) {
            // Можно добавить логику закрытия если нужно
            // setShowSuccessModal(false);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                Success
              </DialogTitle>
              <DialogDescription className="pt-2">
                {successMessage}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end pt-4">
              <Button onClick={() => {
                setShowSuccessModal(false);
                // Auto-return to Telegram bot after confirmation
                if (window.Telegram?.WebApp) {
                  // Для мобильных: закрываем приложение
                  if (isMobileDevice()) {
                    window.Telegram.WebApp.close();
                  } else {
                    // Для десктопа: редиректим на Telegram бота
                    window.Telegram.WebApp.openTelegramLink('https://t.me/skifo_trade_bot');
                  }
                } else {
                  // Если не в Telegram WebApp, пытаемся закрыть окно или вернуться назад
                  if (window.history.length > 1) {
                    window.history.back();
                  } else {
                    // Если нет истории, просто закрываем окно (если это popup)
                    window.close();
                  }
                }
              }}>
                OK
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default HelloPage;
