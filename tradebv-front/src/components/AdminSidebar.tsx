import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Users,
  BookOpen,
  MessageSquare,
  Settings,
  BarChart3,
  Home,
  FileText,
  Shield
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function AdminSidebar() {
  const { state } = useSidebar();
  const { t } = useLanguage();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const navigationItems = [
    {
      title: t('admin.sidebar.home'),
      url: "/admin-dashboard",
      icon: Home,
      exact: true
    },
    {
      title: t('admin.sidebar.users'),
      url: "/admin-dashboard/users",
      icon: Users
    },
    {
      title: t('admin.sidebar.caseManagement'),
      url: "/admin-dashboard/case-management",
      icon: BookOpen
    },
    {
      title: t('admin.sidebar.basePrompt'),
      url: "/admin-dashboard/base-prompt",
      icon: Shield
    },
    {
      title: t('admin.sidebar.feedback'),
      url: "/admin-dashboard/feedback",
      icon: FileText
    }
  ];

  const isActive = (path: string, exact = false) => {
    if (exact) {
      return currentPath === path;
    }
    return currentPath.startsWith(path);
  };

  const getNavCls = (isActiveState: boolean) =>
    isActiveState
      ? "bg-primary text-primary-foreground font-medium hover:bg-primary/90"
      : "hover:bg-accent hover:text-accent-foreground";

  const mainGroupExpanded = navigationItems.some((item) =>
    isActive(item.url, item.exact)
  );

  return (
    <Sidebar 
      className={`${collapsed ? "w-14" : "w-64"} z-50`}
      collapsible="icon"
      defaultOpen={false}
    >
      <SidebarContent className="bg-card border-r">
        {/* Header */}
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-semibold text-foreground">{t('admin.sidebar.title')}</h2>
                <p className="text-xs text-muted-foreground">{t('admin.sidebar.subtitle')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup className="px-2">
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            {t('admin.sidebar.navigation')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="w-full">
                    <NavLink 
                      to={item.url} 
                      end={item.exact}
                      className={({ isActive: navIsActive }) => 
                        `flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${getNavCls(navIsActive)}`
                      }
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}