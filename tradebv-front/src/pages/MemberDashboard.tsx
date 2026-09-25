import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Play,
  Timer,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/services/api';
import { extractLocalizedContent } from '@/utils/localizedContent';

interface CaseData {
  id: string;
  title: string;
  intro_text: string;
  is_draft: boolean;
  created_at: string;
}

// Subset of ChatPublic we actually consume on this page.
interface ChatRow {
  case_id: string | number;
  status: string;
}

const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const daysBetween = (from: Date, to: Date): number => {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const formatDate = (value: string | Date, lang: string): string =>
  new Date(value).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

interface StatCardProps {
  value: number | string;
  label: string;
  icon: React.ReactNode;
  tone: 'neutral' | 'success' | 'warning';
}

const StatCard: React.FC<StatCardProps> = ({ value, label, icon, tone }) => {
  const valueClass: Record<StatCardProps['tone'], string> = {
    neutral: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
  };
  const iconClass: Record<StatCardProps['tone'], string> = {
    neutral: 'bg-muted text-muted-foreground',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
  };
  return (
    <Card className="p-5 flex items-center justify-between">
      <div>
        <div className={`text-3xl font-bold ${valueClass[tone]}`}>{value}</div>
        <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
      </div>
      <div
        className={`h-10 w-10 rounded-lg flex items-center justify-center ${iconClass[tone]}`}
      >
        {icon}
      </div>
    </Card>
  );
};

const MemberDashboard: React.FC = () => {
  const { t, language } = useLanguage();
  const { user, canAccessCase } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseData[]>([]);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [casesResp, chatsResp] = await Promise.all([
          apiClient.get<{ data: CaseData[] }>('/cases'),
          apiClient.get<{ data: ChatRow[] }>('/simulation'),
        ]);
        if (cancelled) return;
        setCases(casesResp.data ?? []);
        setChats(chatsResp.data ?? []);
      } catch (error) {
        console.error('Failed to load member dashboard:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const assignedCases = useMemo(
    () => cases.filter((c) => !c.is_draft && canAccessCase(c.id)),
    [cases, canAccessCase],
  );

  // Unique case_ids with at least one completed chat, intersected with cases
  // the user still has access to.
  const completedCount = useMemo(() => {
    const done = new Set<string>();
    for (const chat of chats) {
      if (chat.status === 'completed') done.add(String(chat.case_id));
    }
    return assignedCases.filter((c) => done.has(String(c.id))).length;
  }, [chats, assignedCases]);

  // Closest upcoming deadline across assigned cases (or null if none of the
  // assigned cases has an expiry set).
  const nearestExpiry = useMemo<Date | null>(() => {
    const expiry = user?.case_access_expiry ?? {};
    const dates: Date[] = [];
    for (const c of assignedCases) {
      const iso = expiry[c.id];
      if (typeof iso === 'string') dates.push(new Date(iso));
    }
    if (!dates.length) return null;
    return dates.reduce((min, d) => (d < min ? d : min), dates[0]);
  }, [assignedCases, user]);

  const today = useMemo(() => new Date(), []);
  const daysLeft = nearestExpiry ? daysBetween(today, nearestExpiry) : null;
  const isExpired = daysLeft !== null && daysLeft < 0;

  const openCaseIntro = (id: string) => navigate(`/case-intro/${id}/step/1`);

  const greetName = user?.name || user?.email || '';

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#3b5cf6] to-[#5b6cff] text-white px-6 sm:px-10 py-6 sm:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {t('member.dashboard.welcome')}, {greetName}
          </h1>
          <p className="text-white/80 mt-1">
            {t('member.dashboard.bannerSubtitle')}
          </p>
        </div>
        {nearestExpiry && (
          <div className="rounded-xl bg-white/15 backdrop-blur-sm px-5 py-3 text-right min-w-[180px]">
            <div className="text-xs uppercase tracking-widest text-white/70">
              {t('member.dashboard.deadlineLabel')}
            </div>
            <div className="text-xl sm:text-2xl font-bold">
              {formatDate(nearestExpiry, language)}
            </div>
            <div className="text-xs text-white/80 mt-0.5">
              {isExpired
                ? t('member.dashboard.deadlinePassed')
                : t('member.dashboard.deadlineRemaining', { count: daysLeft! })}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          value={assignedCases.length}
          label={t('member.dashboard.statsAssigned')}
          icon={<Calendar className="h-5 w-5" />}
          tone="neutral"
        />
        <StatCard
          value={completedCount}
          label={t('member.dashboard.statsCompleted')}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          value={daysLeft === null ? '—' : Math.max(0, daysLeft)}
          label={t('member.dashboard.statsDaysLeft')}
          icon={<Timer className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      {/* Cases list */}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
          {t('member.dashboard.sectionLearningCase')}
        </p>
        {isLoading ? (
          <p className="text-muted-foreground py-4">
            {t('member.dashboard.loading')}
          </p>
        ) : assignedCases.length === 0 ? (
          <p className="text-muted-foreground py-4">
            {t('member.dashboard.noCases')}
          </p>
        ) : (
          <div className="space-y-4">
            {assignedCases.map((c) => {
              const expiryIso = user?.case_access_expiry?.[c.id];
              const expiryDate = expiryIso ? new Date(expiryIso) : null;
              return (
                <Card
                  key={c.id}
                  className="border-l-4 border-l-primary p-5 flex flex-col md:flex-row md:items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <Badge className="bg-success/15 text-success border border-success/40 mb-2 hover:bg-success/15">
                      ✓ {t('status.available')}
                    </Badge>
                    <h2 className="text-lg sm:text-xl font-bold truncate">
                      {extractLocalizedContent(c.title, language)}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="h-4 w-4" />
                        {t('member.dashboard.cardDefaultKind')}
                      </span>
                      {expiryDate && (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {t('member.dashboard.cardAccessUntil', {
                            date: formatDate(expiryDate, language),
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col md:items-end gap-2 shrink-0">
                    {expiryDate && (
                      <div className="rounded-md bg-warning/15 text-warning border border-warning/30 px-3 py-1 text-xs">
                        <span className="uppercase tracking-wider mr-1 opacity-80">
                          {t('member.dashboard.deadlineLabel')}
                        </span>
                        <span className="font-semibold">
                          {formatDate(expiryDate, language)}
                        </span>
                      </div>
                    )}
                    <Button
                      onClick={() => openCaseIntro(c.id)}
                      className="whitespace-nowrap"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {t('member.dashboard.startWorking')}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberDashboard;
