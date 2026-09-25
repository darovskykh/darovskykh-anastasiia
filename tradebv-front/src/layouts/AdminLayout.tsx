import React from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title, subtitle, headerActions }) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />

        <div className="flex-1 flex flex-col w-full min-w-0">
          {/* Header with sidebar trigger */}
          <header className="h-16 w-full flex items-center justify-between border-b bg-background px-3 sm:px-6 relative z-40">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <SidebarTrigger className="flex-shrink-0 btn-touch" />
              <div className="min-w-0 flex-1 pe-2">
                {title && (
                  <h1 className="text-base sm:text-xl font-semibold text-foreground truncate">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {headerActions && (
              <div className="flex-shrink-0 ms-2">
                {headerActions}
              </div>
            )}
          </header>

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};