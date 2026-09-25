import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AdminLayout } from '@/layouts/AdminLayout';
import { DashboardLoadingSkeleton } from '@/components/LoadingStates';
import {
  BookOpen,
  MessageSquare,
  Activity,
  TrendingUp,
  Clock,
  UserPlus,
  Zap,
  Bell,
  RefreshCw,
  ArrowLeft,
  ClipboardCheck,
  FileText,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import type { AdminDashboardData, PendingReportItem } from '@/types/user';

const AdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [pendingReports, setPendingReports] = useState<PendingReportItem[]>([]);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const activities = dashboardData?.last_activity || [];
  const hasMoreActivity = activities.length > 5;
  const visibleActivities = showAllActivity && hasMoreActivity ? activities : activities.slice(0, 5);
  
  // Check if user came from case management
  const cameFromCaseManagement = location.state?.fromCaseManagement || 
    document.referrer.includes('/case-management') ||
    sessionStorage.getItem('lastAdminPage') === '/admin-dashboard/case-management';

  // Load data on mount
  useEffect(() => {
    loadDashboardData();
    // Clear the last admin page marker when leaving dashboard (unless coming from case management)
    const wasOnCaseManagement = sessionStorage.getItem('lastAdminPage') === '/admin-dashboard/case-management';
    if (!wasOnCaseManagement && !location.state?.fromCaseManagement && !document.referrer.includes('/case-management')) {
      sessionStorage.removeItem('lastAdminPage');
    }
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    // The pending-reviews widget is secondary — fetched independently so its
    // failure can't blank the whole dashboard.
    const [data, pending] = await Promise.allSettled([
      userService.getAdminDashboard(),
      userService.getPendingReports(),
    ]);
    if (data.status === 'fulfilled') setDashboardData(data.value);
    else console.error('Failed to load dashboard data:', data.reason);
    if (pending.status === 'fulfilled') setPendingReports(pending.value);
    else console.error('Failed to load pending reports:', pending.reason);
    setIsLoading(false);
  };

  const stats = [
    {
      title: t('admin.stats.activeSimulations'),
      value: dashboardData?.active_simulations.count.toString() || '0',
      change: dashboardData?.active_simulations.percentageGrowth || '0',
      changeLabel: 'newSimulationsThisWeek',
      icon: Activity,
      color: 'text-success'
    },
    {
      title: t('admin.stats.completedSimulations'),
      value: dashboardData?.completed_simulations.count.toString() || '0',
      change: dashboardData?.completed_simulations.percentageGrowth || '0',
      changeLabel: 'completedThisWeek',
      icon: MessageSquare,
      color: 'text-warning'
    },
    {
      title: t('admin.stats.totalChats'),
      value: dashboardData?.all_chats.count.toString() || '0',
      change: dashboardData?.all_chats.percentageGrowth || '0',
      changeLabel: 'newChatsThisWeek',
      icon: Clock,
      color: 'text-accent'
    }
  ];

  const getTimeAgo = (timestamp: string) => {
    // Parse UTC time properly - if no 'Z' suffix, add it
    let dateStr = timestamp;
    const hasTimezone = dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr);

    if (!hasTimezone) {
      if (dateStr.includes('T')) {
        dateStr = dateStr + 'Z';
      } else {
        dateStr = dateStr + 'T00:00:00Z';
      }
    }

    const now = new Date();
    const time = new Date(dateStr);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t('admin.timeAgo.justNow');
    if (diffMins < 60) return t('admin.timeAgo.minutesAgo', { count: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('admin.timeAgo.hoursAgo', { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    return t('admin.timeAgo.daysAgo', { count: diffDays });
  };

  const handleViewAllActivity = () => {
    if (!hasMoreActivity) return;
    setShowAllActivity((prev) => !prev);
  };

  return (
    <AdminLayout
      title={t('admin.dashboard.title')}
      subtitle={`${t('admin.dashboard.welcome')}, ${user?.name}`}
    >
      <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 animate-fade-in">
        {isLoading ? (
          <DashboardLoadingSkeleton />
        ) : (
          <>
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center gap-4 mb-2">
                {cameFromCaseManagement && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      sessionStorage.removeItem('lastAdminPage');
                      navigate('/admin-dashboard/case-management');
                    }}
                    className="flex-shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t('caseEditor.back')}
                  </Button>
                )}
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {t('admin.dashboard.title')}
                  </h1>
                  <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                    {t('admin.dashboard.overview')}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {stats.map((stat, index) => {
                const IconComponent = stat.icon;
                return (
                  <Card key={index} className="hover:shadow-medium transition-shadow">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                            {stat.title}
                          </p>
                          <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                            {isLoading ? '...' : stat.value}
                          </p>
                          {!isLoading && stat.change && (
                            <p className={`text-xs sm:text-sm mt-1 truncate ${stat.change.startsWith('+') ? 'text-success' : stat.change.startsWith('-') ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {stat.change}%
                            </p>
                          )}
                        </div>
                        <div className="p-2 sm:p-3 rounded-lg bg-primary-light flex-shrink-0">
                          <IconComponent className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* Recent Activity */}
                  <Card className="lg:col-span-2">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                        <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <span className="truncate">{t('admin.dashboard.recentActivity')}</span>
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {t('admin.dashboard.recentActivityDescription')}
                      </CardDescription>
                    </div>
                    {hasMoreActivity && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full sm:w-auto flex-shrink-0"
                        onClick={handleViewAllActivity}
                      >
                        {showAllActivity ? t('admin.dashboard.viewLess') : t('admin.dashboard.viewAll')}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                      <p className="text-muted-foreground">{t('admin.dashboard.loadingActivity')}</p>
                    </div>
                  ) : activities.length > 0 ? (
                    <div className="space-y-4">
                      {visibleActivities.map((activity) => {
                        const initials = activity.user_name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
                        return (
                          <Link
                            key={activity.chat_id}
                            to={`/admin-dashboard/users/${activity.user_id}`}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors gap-3 block"
                          >
                            <div className="flex items-center space-x-4 min-w-0 flex-1">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-medium text-sm">
                                  {initials}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground truncate">{activity.user_name}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {activity.chat_name}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end space-x-3 sm:flex-shrink-0">
                              <span className="text-sm text-muted-foreground whitespace-nowrap">
                                {getTimeAgo(activity.created_at)}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>{t('admin.dashboard.noRecentActivity')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                    <Zap className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <span className="truncate">{t('admin.dashboard.quickActions')}</span>
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t('admin.dashboard.quickActionsDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3">
                  <Button className="w-full justify-start bg-primary hover:bg-primary/90 text-primary-foreground text-sm sm:text-base" asChild>
                    <Link to="/admin-dashboard/users">
                      <UserPlus className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{t('admin.dashboard.createUser')}</span>
                    </Link>
                  </Button>
                  <Button className="w-full justify-start bg-success hover:bg-success/90 text-white text-sm sm:text-base" asChild>
                    <Link to="/admin-dashboard/case-management">
                      <BookOpen className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{t('admin.dashboard.createCase')}</span>
                    </Link>
                  </Button>
                  <Button className="w-full justify-start text-sm sm:text-base" variant="outline" asChild>
                    <Link to="/admin-dashboard/feedback">
                      <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{t('admin.dashboard.viewFeedback')}</span>
                    </Link>
                  </Button>
                  <Button className="w-full justify-start text-sm sm:text-base" variant="outline">
                    <Bell className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">{t('admin.dashboard.systemNotifications')}</span>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Reports awaiting confirmation */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                  <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="truncate">{t('admin.dashboard.pendingReports')}</span>
                  {pendingReports.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {pendingReports.length}
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-sm">
                  {t('admin.dashboard.pendingReportsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingReports.length > 0 ? (
                  <div className="space-y-3">
                    {pendingReports.map((report) => (
                      <div
                        key={report.chat_id}
                        className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{report.user_name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {report.case_title}
                            {report.completed_at && ` · ${getTimeAgo(report.completed_at)}`}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-shrink-0"
                          onClick={() => navigate(`/simulation/${report.chat_id}/results`)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {t('admin.dashboard.reviewReport')}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t('admin.dashboard.noPendingReports')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
