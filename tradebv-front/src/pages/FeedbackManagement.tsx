import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { extractLocalizedContent } from "@/utils/localizedContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ArrowUpDown, Eye, MessageSquare, Calendar, User, FileText, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from '@/layouts/AdminLayout';
import { FeedbackLoadingSkeleton } from "@/components/LoadingStates";
import { NoFeedbackFound, NoSearchResults } from "@/components/EmptyStates";
import { formatDateTime as formatDateTimeUtil, formatDate as formatDateUtil, formatTime as formatTimeUtil } from "@/utils/dateTime";
import { feedbackService } from '@/services/feedbackService';
import type { Feedback } from '@/types/feedback';

type FeedbackSourceType = "simulation" | "simulation_results" | "other";
type SourceFilter = "all" | FeedbackSourceType;

const MIN_SCREENSHOT_ZOOM = 0.5;
const MAX_SCREENSHOT_ZOOM = 4;
const SCREENSHOT_ZOOM_STEP = 0.25;

const FeedbackManagement = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortField, setSortField] = useState<keyof Feedback>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [feedbackData, setFeedbackData] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [screenshotModalOpen, setScreenshotModalOpen] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [feedbackStatus, setFeedbackStatus] = useState<string>("pending");
  const [isSaving, setIsSaving] = useState(false);

  // Load feedback on mount
  useEffect(() => {
    loadFeedback();
  }, []);

  // Initialize admin notes and status when feedback is selected
  useEffect(() => {
    if (selectedFeedback) {
      setAdminNotes(selectedFeedback.admin_notes || "");
      setFeedbackStatus(selectedFeedback.status || "pending");
    }
  }, [selectedFeedback]);

  const classifyFeedbackSource = (feedback: Feedback): FeedbackSourceType => {
    if (feedback.source === "simulation_results" || feedback.source === "evaluation_system") {
      return "simulation_results";
    }

    if (!feedback.source || feedback.source === "simulation") {
      return "simulation";
    }

    return "other";
  };

  const getSourceLabel = (sourceType: FeedbackSourceType): string => {
    switch (sourceType) {
      case "simulation_results":
        return t('feedback.sourceTags.simulationResults');
      case "simulation":
        return t('feedback.sourceTags.simulation');
      default:
        return t('feedback.sourceTags.other');
    }
  };

  const getSourceBadgeVariant = (sourceType: FeedbackSourceType) => {
    switch (sourceType) {
      case "simulation_results":
        return "default";
      case "simulation":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getAcceptanceBadgeProps = (feedback: Feedback) => {
    if (classifyFeedbackSource(feedback) !== "simulation_results") {
      return null;
    }

    return {
      variant: feedback.has_accepted_grade ? "default" as const : "destructive" as const,
      label: feedback.has_accepted_grade
        ? t("feedback.gradeStatus.accepted")
        : t("feedback.gradeStatus.notAccepted"),
    };
  };

  const loadFeedback = async () => {
    setIsLoading(true);
    try {
      const data = await feedbackService.listFeedback();
      setFeedbackData(data);
    } catch (err: any) {
      toast({
        title: t('feedback.error'),
        description: err.message || t('feedback.errorLoading'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Извлечение ID из page: simulation/<id>/... -> <id> (число или UUID)
  const extractCaseId = (page: string): string => {
    const match = page.match(/simulation\/([^/]+)/);
    return match ? match[1] : page;
  };

  const getCaseDisplay = (feedback: Feedback): string =>
    feedback.case_title?.trim() || extractCaseId(feedback.page);

  const filteredAndSortedFeedback = useMemo(() => {
    let filtered = feedbackData.filter((feedback) => {
      const matchesSearch =
        (feedback.user_username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (feedback.user_email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        feedback.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (feedback.case_title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        feedback.page.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        feedback.status === statusFilter;

      const matchesSource =
        sourceFilter === "all" ||
        classifyFeedbackSource(feedback) === sourceFilter;

      return matchesSearch && matchesStatus && matchesSource;
    });

    filtered.sort((a, b) => {
      let aValue: string | number | null;
      let bValue: string | number | null;

      // Специальная обработка для разных полей
      if (sortField === "user_username") {
        // Для User: используем username, если нет - email, если нет - пустая строка
        aValue = (a.user_username || a.user_email || '').toLowerCase();
        bValue = (b.user_username || b.user_email || '').toLowerCase();
      } else if (sortField === "case_title") {
        // Для Case: используем getCaseDisplay для получения правильного значения
        aValue = getCaseDisplay(a).toLowerCase();
        bValue = getCaseDisplay(b).toLowerCase();
      } else {
        // Для остальных полей используем стандартную логику
        aValue = a[sortField];
        bValue = b[sortField];
        
        // Приводим к строкам для сравнения, если это не числа
        if (typeof aValue !== 'number' && typeof bValue !== 'number') {
          aValue = (aValue ?? '').toString().toLowerCase();
          bValue = (bValue ?? '').toString().toLowerCase();
        }
      }

      // Сравнение с учетом направления сортировки
      if (sortDirection === "asc") {
        if (aValue < bValue) return -1;
        if (aValue > bValue) return 1;
        return 0;
      } else {
        if (aValue > bValue) return -1;
        if (aValue < bValue) return 1;
        return 0;
      }
    });

    return filtered;
  }, [feedbackData, searchTerm, statusFilter, sortField, sortDirection, sourceFilter]);

  const handleSort = (field: keyof Feedback) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const formatDate = (dateString: string) => {
    const locale = language === 'uk' ? 'uk-UA' : 'en-US';
    return formatDateTimeUtil(dateString, locale);
  };

  // Форматирование даты в 2 строки с сокращенным месяцем
  const formatDateCompact = (dateString: string) => {
    const locale = language === 'uk' ? 'uk-UA' : 'en-US';
    
    // Парсим дату правильно (как в utils/dateTime.ts)
    const hasTimezone = dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString);
    const dateToParse = typeof dateString === 'string' && !hasTimezone && dateString.includes('T')
      ? dateString + 'Z'
      : dateString;
    const dateObj = new Date(dateToParse);
    
    const dateStr = dateObj.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    const timeStr = dateObj.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return { dateStr, timeStr };
  };

  const selectedFeedbackSource = selectedFeedback ? classifyFeedbackSource(selectedFeedback) : null;
  const selectedFeedbackSourceLabel = selectedFeedbackSource ? getSourceLabel(selectedFeedbackSource) : null;
  const selectedFeedbackSourceBadgeVariant = selectedFeedbackSource ? getSourceBadgeVariant(selectedFeedbackSource) : "outline";
  const selectedFeedbackAcceptance = selectedFeedback ? getAcceptanceBadgeProps(selectedFeedback) : null;

  const handleScreenshotOpen = (url: string) => {
    setSelectedScreenshot(url);
    setZoomLevel(1);
    setScreenshotModalOpen(true);
  };

  const handleScreenshotModalChange = (open: boolean) => {
    setScreenshotModalOpen(open);
    if (!open) {
      setZoomLevel(1);
    }
  };

  const zoomPercentage = Math.round(zoomLevel * 100);

  const handleSaveAdminNotes = async () => {
    if (!selectedFeedback) return;

    setIsSaving(true);
    try {
      const updatedFeedback = await feedbackService.updateFeedback(
        selectedFeedback.id,
        feedbackStatus,
        adminNotes || null
      );

      // Update feedback in list
      setFeedbackData(prev =>
        prev.map(f => f.id === updatedFeedback.id ? updatedFeedback : f)
      );

      // Update selected feedback
      setSelectedFeedback(updatedFeedback);

      toast({
        title: t('feedback.toasts.success'),
        description: t('feedback.toasts.feedbackUpdated'),
      });
    } catch (err: any) {
      toast({
        title: t('feedback.toasts.error'),
        description: err.message || t('feedback.toasts.updateError'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout
      title={t('feedback.title')}
      subtitle={t('feedback.subtitle')}
      headerActions={
        <Button
          variant="outline"
          size="sm"
          onClick={loadFeedback}
          disabled={isLoading}
          className="text-xs sm:text-sm"
        >
          <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t('feedback.refresh')}</span>
          <span className="sm:hidden">{t('feedback.refresh')}</span>
        </Button>
      }
    >
      <div className="p-3 sm:p-6">
        <div className="w-full space-y-3 sm:space-y-6">

            {/* Filters - Mobile Responsive */}
            <Card>
              <CardContent className="p-3 sm:p-6">
                <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder={t('feedback.searchPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 btn-touch text-sm sm:text-base"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] btn-touch">
                      <SelectValue placeholder={t('feedback.filters.filterByStatus')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('feedback.filters.allStatus')}</SelectItem>
                      <SelectItem value="pending">{t('feedback.filters.pending')}</SelectItem>
                      <SelectItem value="reviewed">{t('feedback.filters.reviewed')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as SourceFilter)}>
                    <SelectTrigger className="w-full sm:w-[200px] btn-touch">
                      <SelectValue placeholder={t('feedback.filters.filterBySource')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('feedback.filters.allSources')}</SelectItem>
                      <SelectItem value="simulation">{t('feedback.sourceTags.simulation')}</SelectItem>
                      <SelectItem value="simulation_results">{t('feedback.sourceTags.simulationResults')}</SelectItem>
                      <SelectItem value="other">{t('feedback.sourceTags.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Feedback Table - Mobile Responsive */}
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="truncate">{t('feedback.feedbackEntries', { count: filteredAndSortedFeedback.length })}</span>
                  {feedbackData.filter(f => f.status === "pending").length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {feedbackData.filter(f => f.status === "pending").length} {t('feedback.filters.pending')}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <FeedbackLoadingSkeleton />
                ) : filteredAndSortedFeedback.length === 0 ? (
                  searchTerm ? (
                    <NoSearchResults />
                  ) : (
                    <NoFeedbackFound />
                  )
                ) : (
                  <>
                    {/* Mobile Card View */}
                    <div className="block sm:hidden space-y-3">
                      {filteredAndSortedFeedback.map((feedback) => {
                        const sourceType = classifyFeedbackSource(feedback);
                        const sourceLabel = getSourceLabel(sourceType);
                        const badgeVariant = getSourceBadgeVariant(sourceType);
                        const acceptanceBadge = getAcceptanceBadgeProps(feedback);

                        return (
                          <Card key={feedback.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedFeedback(feedback)}>
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 pr-3">
                                {feedback.user_username || feedback.user_email ? (
                                  <Link
                                    to={`/admin-dashboard/users/${feedback.user_id}`}
                                    className="font-medium text-primary hover:text-primary/80 hover:underline text-sm break-words"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {feedback.user_username ? (
                                      <div>
                                        <div>{feedback.user_username}</div>
                                        <div className="text-xs text-muted-foreground">{feedback.user_email}</div>
                                      </div>
                                    ) : (
                                      feedback.user_email
                                    )}
                                  </Link>
                                ) : (
                                  <p className="font-medium text-foreground text-sm">{t('feedback.anonymous')}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <p className="text-xs text-muted-foreground break-words truncate flex-1 min-w-[160px]">
                                    {getCaseDisplay(feedback)}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={badgeVariant}
                                      className="text-[10px] uppercase tracking-wide"
                                    >
                                      {sourceLabel}
                                    </Badge>
                                    {acceptanceBadge && (
                                      <Badge
                                        variant={acceptanceBadge.variant}
                                        className="text-[10px] uppercase tracking-wide"
                                      >
                                        {acceptanceBadge.label}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground line-clamp-3 break-words">
                                {feedback.text}
                              </p>
                              {feedback.screenshot_url && (
                                <div
                                  className="w-20 h-20 bg-gray-100 dark:bg-gray-800 border rounded cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScreenshotOpen(feedback.screenshot_url!);
                                  }}
                                >
                                  <img
                                    src={feedback.screenshot_url}
                                    alt={t('feedbackManagement.alt.screenshotPreview')}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(feedback.created_at)}
                                </p>
                                <Badge
                                  variant={feedback.status === "reviewed" ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {feedback.status === "reviewed" ? t('feedback.filters.reviewed') : t('feedback.filters.pending')}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead
                              className="cursor-pointer select-none hover:bg-muted/50 min-w-[100px]"
                              onClick={() => handleSort("created_at")}
                            >
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                {t('feedback.table.dateTime')}
                                <ArrowUpDown className="h-3 w-3" />
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer select-none hover:bg-muted/50 min-w-[150px]"
                              onClick={() => handleSort("user_username")}
                            >
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {t('feedback.table.user')}
                                <ArrowUpDown className="h-3 w-3" />
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer select-none hover:bg-muted/50 min-w-[120px]"
                              onClick={() => handleSort("case_title")}
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                {t('feedback.table.case')}
                                <ArrowUpDown className="h-3 w-3" />
                              </div>
                            </TableHead>
                            <TableHead className="min-w-[160px]">{t('feedback.table.gradeAccepted')}</TableHead>
                            <TableHead className="min-w-[200px]">{t('feedback.table.feedbackText')}</TableHead>
                            <TableHead className="min-w-[100px]">{t('feedback.table.screenshot')}</TableHead>
                            <TableHead
                              className="cursor-pointer select-none hover:bg-muted/50 min-w-[100px]"
                              onClick={() => handleSort("status")}
                            >
                              <div className="flex items-center gap-2">
                                {t('feedback.table.status')}
                                <ArrowUpDown className="h-3 w-3" />
                              </div>
                            </TableHead>
                            <TableHead className="min-w-[80px]">{t('feedback.table.actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAndSortedFeedback.map((feedback) => {
                            const sourceType = classifyFeedbackSource(feedback);
                            const sourceLabel = getSourceLabel(sourceType);
                            const badgeVariant = getSourceBadgeVariant(sourceType);
                            const acceptanceBadge = getAcceptanceBadgeProps(feedback);

                            return (
                              <TableRow key={feedback.id} className="hover:bg-muted/50">
                              <TableCell className="font-medium">
                                {(() => {
                                  const { dateStr, timeStr } = formatDateCompact(feedback.created_at);
                                  return (
                                    <div className="text-sm leading-tight">
                                      <div>{dateStr}</div>
                                      <div className="text-xs text-muted-foreground">{timeStr}</div>
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="min-w-0">
                                {feedback.user_username || feedback.user_email ? (
                                  <Link
                                    to={`/admin-dashboard/users/${feedback.user_id}`}
                                    className="font-medium text-primary hover:text-primary/80 hover:underline block"
                                  >
                                    {feedback.user_username ? (
                                      <div>
                                        <div className="truncate">{feedback.user_username}</div>
                                        <div className="text-xs text-muted-foreground truncate">{feedback.user_email}</div>
                                      </div>
                                    ) : (
                                      <div className="truncate">{feedback.user_email}</div>
                                    )}
                                  </Link>
                                ) : (
                                  <div className="font-medium">{t('feedback.anonymous')}</div>
                                )}
                              </TableCell>
                              <TableCell className="min-w-0">
                                <div className="font-medium truncate">{getCaseDisplay(feedback)}</div>
                                <Badge
                                  variant={badgeVariant}
                                  className="mt-1 text-[10px] uppercase tracking-wide"
                                >
                                  {sourceLabel}
                                </Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {acceptanceBadge ? (
                                  <Badge
                                    variant={acceptanceBadge.variant}
                                    className="text-[10px] uppercase tracking-wide"
                                  >
                                    {acceptanceBadge.label}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {t('feedback.gradeStatus.notApplicable')}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="min-w-0">
                                <div className="max-w-xs text-sm line-clamp-2">
                                  {feedback.text}
                                </div>
                              </TableCell>
                              <TableCell>
                                {feedback.screenshot_url ? (
                                  <div
                                    className="w-16 h-16 bg-gray-100 dark:bg-gray-800 border rounded cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleScreenshotOpen(feedback.screenshot_url!);
                                    }}
                                  >
                                    <img
                                      src={feedback.screenshot_url}
                                      alt={t('feedbackManagement.alt.screenshotPreview')}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.parentElement!.classList.add('flex', 'items-center', 'justify-center');
                                        e.currentTarget.parentElement!.innerHTML = `<span class="text-xs text-muted-foreground">${t('feedback.screenshot.error')}</span>`;
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="w-20 h-16 bg-gray-100 dark:bg-gray-800 border rounded flex items-center justify-center">
                                    <span className="text-xs text-muted-foreground" style={{ textAlign: 'center' }}>{t('feedback.screenshot.noImage')}</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={feedback.status === "reviewed" ? "default" : "secondary"}
                                  className="whitespace-nowrap"
                                >
                                  {feedback.status === "reviewed" ? t('feedback.filters.reviewed') : t('feedback.filters.pending')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="btn-touch"
                                    onClick={() => setSelectedFeedback(feedback)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
        </div>
      </div>

    {/* Detail Modal */}
      <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="truncate">{t('feedback.detail.title')}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-6">
              {/* Two-column grid for User Information and Case Context */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* User Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('feedback.detail.userInformation')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">{t('feedback.detail.name')}</Label>
                      {selectedFeedback.user_username ? (
                        <p className="text-foreground">{selectedFeedback.user_username}</p>
                      ) : (
                        <p className="text-foreground">{t('feedback.anonymous')}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium">{t('feedback.detail.email')}</Label>
                      <p className="text-foreground">{selectedFeedback.user_email || 'N/A'}</p>
                    </div>
                    {selectedFeedbackSourceLabel && (
                      <div>
                        <Label className="text-sm font-medium">{t('feedback.detail.source')}</Label>
                        <div className="mt-1">
                          <Badge
                            variant={selectedFeedbackSourceBadgeVariant}
                            className="text-[10px] uppercase tracking-wide"
                          >
                            {selectedFeedbackSourceLabel}
                          </Badge>
                        </div>
                      </div>
                    )}
                    {selectedFeedbackAcceptance && (
                      <div>
                        <Label className="text-sm font-medium">{t('feedback.detail.gradeAccepted')}</Label>
                        <div className="mt-1">
                          <Badge
                            variant={selectedFeedbackAcceptance.variant}
                            className="text-[10px] uppercase tracking-wide"
                          >
                            {selectedFeedbackAcceptance.label}
                          </Badge>
                        </div>
                      </div>
                    )}
                    {selectedFeedback.user_role && (
                      <div>
                        <Label className="text-sm font-medium">{t('feedback.detail.role')}</Label>
                        <p className="text-foreground">{selectedFeedback.user_role}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-sm font-medium">{t('feedback.detail.submitted')}</Label>
                      <p className="text-foreground">{formatDate(selectedFeedback.created_at)}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Case Context */}
                {selectedFeedback.case_title && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t('feedback.caseContext.title')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">{t('feedback.caseContext.caseName')}</Label>
                        <p className="text-foreground">{selectedFeedback.case_title}</p>
                      </div>
                      {selectedFeedback.case_description && extractLocalizedContent(selectedFeedback.case_description, language) && (
                        <div>
                          <Label className="text-sm font-medium">{t('feedback.caseContext.description')}</Label>
                          <p className="text-foreground text-sm">{extractLocalizedContent(selectedFeedback.case_description, language)}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Feedback Content */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('feedback.detail.feedbackText')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{selectedFeedback.text}</p>
                </CardContent>
              </Card>

              {/* Screenshot */}
              {selectedFeedback.screenshot_url && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('feedback.table.screenshot')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="border rounded-lg overflow-hidden bg-gray-50 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleScreenshotOpen(selectedFeedback.screenshot_url!)}
                    >
                      <img
                        src={selectedFeedback.screenshot_url}
                        alt={t('feedbackManagement.alt.feedbackScreenshot')}
                        className="w-full h-auto"
                        onError={(e) => {
                          console.error('Failed to load screenshot:', selectedFeedback.screenshot_url);
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = `
                            <div class="p-4 text-center text-muted-foreground">
                              <p>${t('feedback.screenshot.loadError')}</p>
                              <p class="text-xs mt-2 break-all">${selectedFeedback.screenshot_url}</p>
                            </div>
                          `;
                        }}
                        onLoad={() => {
                          console.log('Screenshot loaded successfully:', selectedFeedback.screenshot_url);
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      {t('feedback.screenshot.clickToView')}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Admin Review Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('feedback.detail.adminReview')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current Status Display */}
                  {selectedFeedback.admin_notes && (
                    <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">{t('feedback.detail.currentStatus')}</Label>
                        <Badge variant={selectedFeedback.status === "reviewed" ? "default" : "secondary"}>
                          {selectedFeedback.status === "reviewed" ? `✓ ${t('feedback.detail.reviewed')}` : `⏳ ${t('feedback.detail.pending')}`}
                        </Badge>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">{t('feedback.detail.savedNotes')}:</Label>
                        <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap bg-background p-3 rounded border">
                          {selectedFeedback.admin_notes}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Edit Section */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      {selectedFeedback.admin_notes ? t('feedback.detail.addReview') : t('feedback.detail.addReview')}
                    </Label>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="feedback-status"
                        checked={feedbackStatus === "reviewed"}
                        onCheckedChange={(checked) =>
                          setFeedbackStatus(checked ? "reviewed" : "pending")
                        }
                      />
                      <Label htmlFor="feedback-status" className="cursor-pointer text-sm">
                        {t('feedback.detail.markAs')} {feedbackStatus === "pending" ? t('feedback.detail.reviewed') : t('feedback.detail.pending')}
                      </Label>
                      <Badge
                        variant={feedbackStatus === "reviewed" ? "default" : "secondary"}
                        className="ml-auto"
                      >
                        {feedbackStatus === "reviewed" ? t('feedback.detail.reviewed') : t('feedback.detail.pending')}
                      </Badge>
                    </div>

                    <div>
                      <Label htmlFor="admin-notes" className="text-sm font-medium">
                        {t('feedback.detail.adminNotes')}
                      </Label>
                      <Textarea
                        id="admin-notes"
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder={t('feedback.detail.addNotesPlaceholder')}
                        className="mt-2 min-h-[120px]"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {adminNotes.length} {t('feedback.detail.characters')}
                      </p>
                    </div>

                    <Button
                      onClick={handleSaveAdminNotes}
                      disabled={isSaving}
                      className="w-full"
                      size="lg"
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          {t('feedback.detail.saving')}
                        </>
                      ) : (
                        <>
                          {t('feedback.detail.saveNotes')}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Screenshot Modal */}
      <Dialog open={screenshotModalOpen} onOpenChange={handleScreenshotModalChange}>
        <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh]">
          <DialogHeader>
            <DialogTitle>{t('feedback.screenshot.title')}</DialogTitle>
          </DialogHeader>
          {selectedScreenshot && (
            <div className="space-y-4">
              <TransformWrapper
                initialScale={1}
                minScale={MIN_SCREENSHOT_ZOOM}
                maxScale={MAX_SCREENSHOT_ZOOM}
                wheel={{ step: SCREENSHOT_ZOOM_STEP }}
                pinch={{ step: SCREENSHOT_ZOOM_STEP }}
                doubleClick={{ disabled: true }}
                onTransformed={({ state }) => setZoomLevel(Number(state.scale.toFixed(2)))}
              >
                {({ zoomIn, zoomOut, resetTransform, setTransform, state }) => {
                  const clampScale = (value: number) =>
                    Math.min(MAX_SCREENSHOT_ZOOM, Math.max(MIN_SCREENSHOT_ZOOM, value));

                  const handleZoomOut = () => {
                    zoomOut(SCREENSHOT_ZOOM_STEP);
                  };

                  const handleZoomIn = () => {
                    zoomIn(SCREENSHOT_ZOOM_STEP);
                  };

                  const handleZoomReset = () => {
                    resetTransform();
                    setZoomLevel(1);
                  };

                  const handleZoomSliderChange = (value: number[]) => {
                    if (!value.length) return;
                    const [nextValue] = value;
                    const clamped = clampScale(nextValue);
                    setTransform(state.positionX, state.positionY, clamped);
                    setZoomLevel(Number(clamped.toFixed(2)));
                  };

                  return (
                    <>
                      <div className="flex flex-wrap items-center gap-3 justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleZoomOut}
                            disabled={zoomLevel <= MIN_SCREENSHOT_ZOOM}
                            aria-label={t('feedback.screenshot.zoomOut')}
                          >
                            <ZoomOut className="h-4 w-4" />
                          </Button>
                          <div className="w-44 min-w-[160px] flex-1 sm:flex-none">
                            <Slider
                              value={[zoomLevel]}
                              min={MIN_SCREENSHOT_ZOOM}
                              max={MAX_SCREENSHOT_ZOOM}
                              step={SCREENSHOT_ZOOM_STEP}
                              onValueChange={handleZoomSliderChange}
                              aria-label={t('feedback.screenshot.zoomLabel')}
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleZoomIn}
                            disabled={zoomLevel >= MAX_SCREENSHOT_ZOOM}
                            aria-label={t('feedback.screenshot.zoomIn')}
                          >
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                          <span className="text-xs font-medium text-muted-foreground min-w-[48px] text-right">
                            {zoomPercentage}%
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleZoomReset}
                            disabled={zoomLevel === 1}
                            className="btn-touch"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            {t('feedback.screenshot.reset')}
                          </Button>
                          <span className="text-xs text-muted-foreground hidden md:inline">
                            {t('feedback.screenshot.zoomHint')}
                          </span>
                        </div>
                      </div>
                      <TransformComponent
                        wrapperClass="relative max-h-[80vh] overflow-auto rounded-lg bg-muted p-4"
                        contentClass="flex justify-center min-h-[300px]"
                      >
                        <img
                          src={selectedScreenshot}
                          alt={t('feedbackManagement.alt.screenshotFullView')}
                          className="h-auto w-full object-contain rounded-lg max-w-none select-none"
                          draggable={false}
                        />
                      </TransformComponent>
                    </>
                  );
                }}
              </TransformWrapper>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default FeedbackManagement;
