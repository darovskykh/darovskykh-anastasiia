import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiClient } from '@/services/api';
import { useLanguage } from '@/contexts/LanguageContext';

interface NotificationItem {
  id: string;
  type: string;
  chat_id?: string | null;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

const POLL_MS = 60000;

export const NotificationsBell = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        data: { items: NotificationItem[]; unread_count: number };
      }>('/notifications');
      setItems(res.data.items);
      setUnread(res.data.unread_count);
    } catch {
      // Non-critical widget: a transient fetch failure just retries next poll.
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const onItemClick = async (n: NotificationItem) => {
    setOpen(false);
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      try {
        await apiClient.post(`/notifications/${n.id}/read`);
      } catch {
        /* optimistic update already applied; server catches up next poll */
      }
    }
    if (n.chat_id) navigate(`/simulation/${n.chat_id}/results`);
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    try {
      await apiClient.post('/notifications/read-all');
    } catch {
      /* optimistic; server catches up next poll */
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="btn-touch relative" aria-label={t('notifications.title')}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">{t('notifications.title')}</span>
          {unread > 0 && (
            <button onClick={markAll} className="text-xs text-primary hover:underline">
              {t('notifications.markAllRead')}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">
              {t('notifications.empty')}
            </p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => onItemClick(n)}
                className={`w-full text-left px-3 py-3 border-b last:border-0 hover:bg-accent/10 transition-colors ${
                  n.read ? '' : 'bg-primary/5'
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                  <div className={n.read ? 'pl-4' : ''}>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
