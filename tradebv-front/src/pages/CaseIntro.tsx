import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, Play, ArrowLeft, Check } from 'lucide-react';
import {
  useLanguage,
  LANGUAGE_OPTIONS,
  type Language,
} from '@/contexts/LanguageContext';
import { persistUserLanguage } from '@/services/userLanguage';
import { apiClient } from '@/services/api';
import { RichTextContent } from '@/components/RichTextContent';
import { extractLocalizedContent } from '@/utils/localizedContent';

interface CaseIntroData {
  title?: string;
  role_in_simulation?: string | null;
  persona_description?: string | null;
  case_overview?: string | null;
}

interface PersonaIntroData {
  name?: string;
  role?: string;
}

// Step 1 picks the language everything else — this intro, the simulation and
// the final report — is delivered in, so it has to come before any case text.
const STEP_LANGUAGE = 1;
const TOTAL_STEPS = 4;

const initialsOf = (name?: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const CaseIntro: React.FC = () => {
  const { caseId, step } = useParams<{ caseId: string; step: string }>();
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const [currentStep, setCurrentStep] = useState(parseInt(step || '1', 10));
  const [caseData, setCaseData] = useState<CaseIntroData | null>(null);
  const [personaData, setPersonaData] = useState<PersonaIntroData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);
  const [languageError, setLanguageError] = useState<string | null>(null);

  useEffect(() => {
    const stepNum = parseInt(step || '1', 10);
    if (stepNum >= 1 && stepNum <= TOTAL_STEPS) {
      setCurrentStep(stepNum);
    } else {
      navigate(`/case-intro/${caseId}/step/1`, { replace: true });
    }
  }, [step, caseId, navigate]);

  useEffect(() => {
    const fetchCaseData = async () => {
      if (!caseId) return;
      setIsLoading(true);
      try {
        const response = await apiClient.get<{
          data: { case: CaseIntroData; persona?: PersonaIntroData };
        }>(`/cases/${caseId}/all_data`);
        setCaseData(response.data.case);
        setPersonaData(response.data.persona || null);
      } catch (error) {
        console.error('Failed to load case intro data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCaseData();
  }, [caseId]);

  const handleLanguageSelect = (next: Language) => {
    setLanguage(next);
    setLanguageError(null);
    // Mirror onto the profile: the backend builds the report from `user.lang`,
    // so a choice that only lived in this tab would produce a report in the
    // wrong language.
    setIsSavingLanguage(true);
    persistUserLanguage(next)
      .catch(error => {
        console.error('Failed to persist language:', error);
        setLanguageError(t('member.caseIntro.languageSaveError'));
      })
      .finally(() => setIsSavingLanguage(false));
  };

  const handleContinue = () => {
    if (currentStep < TOTAL_STEPS) {
      navigate(`/case-intro/${caseId}/step/${currentStep + 1}`);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      navigate(`/case-intro/${caseId}/step/${currentStep - 1}`);
    }
  };

  const handleStart = async () => {
    if (!caseId) return;
    setIsStarting(true);
    try {
      const response = await apiClient.post<{
        event: string;
        success: boolean;
        data: { id: number; user_id: string; case_id: number; name: string; [key: string]: any };
        error: any;
      }>(`/simulation/start/${caseId}`);
      navigate(`/simulation/${response.data.id}`);
    } catch (error) {
      console.error('Failed to create chat:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const stepTitles = [
    t('member.caseIntro.languageTitle'),
    t('member.caseIntro.roleInSimulation'),
    t('member.caseIntro.personaDescription'),
    t('member.caseIntro.caseOverview'),
  ];

  const stepSubtitles = [
    t('member.caseIntro.languageSubtitle'),
    t('member.caseIntro.roleSubtitle'),
    t('member.caseIntro.personaSubtitle'),
    t('member.caseIntro.overviewSubtitle'),
  ];

  const stepContent = (): string => {
    if (!caseData) return '';
    const raw =
      currentStep === 2
        ? caseData.role_in_simulation
        : currentStep === 3
          ? caseData.persona_description
          : caseData.case_overview;
    if (!raw) return '';
    return extractLocalizedContent(raw, language);
  };

  const caseTitle = caseData?.title ? extractLocalizedContent(caseData.title, language) : '';
  const personaName = personaData?.name ?? '';
  const personaRole = personaData?.role
    ? extractLocalizedContent(personaData.role, language)
    : '';

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      {/* Sidebar */}
      <aside className="w-[280px] flex-shrink-0 border-r border-border bg-white px-5 py-8 hidden md:flex md:flex-col overflow-y-auto">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('member.caseIntro.preparation')}
        </p>
        <nav className="flex flex-col gap-0.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => {
            const isActive = currentStep === n;
            const isDone = currentStep > n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => navigate(`/case-intro/${caseId}/step/${n}`)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none'
                }`}
              >
                <div
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'border-[1.5px] border-border text-muted-foreground'
                  }`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : n}
                </div>
                {stepTitles[n - 1]}
              </button>
            );
          })}
        </nav>
        <hr className="my-5 border-border" />
        <p className="text-[11px] text-muted-foreground">{t('member.caseIntro.case')}</p>
        <p className="mt-1 text-sm font-medium text-foreground">{caseTitle}</p>
      </aside>

      {/* Main content — fixed viewport height, header pinned top, footer pinned bottom, body scrolls. */}
      <main className="flex flex-1 flex-col min-h-0">
        <div className="flex-shrink-0 px-6 pt-10 sm:px-12 sm:pt-11">
          <div
            className={`mb-4 inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-medium ${
              currentStep === TOTAL_STEPS
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {t('member.caseIntro.stepBadge', { current: currentStep, total: TOTAL_STEPS })}
          </div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground sm:text-[26px]">
            {stepTitles[currentStep - 1]}
          </h1>
          <p className="text-[15px] text-muted-foreground">
            {stepSubtitles[currentStep - 1]}
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-12 pt-7 pb-6">
          {currentStep === 3 && personaName && (
            <div className="mb-6 flex items-center gap-4 rounded-[10px] border border-border bg-muted/30 p-[18px_20px]">
              <div className="flex flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[17px] font-semibold text-primary" style={{ width: '52px', height: '52px' }}>
                {initialsOf(personaName)}
              </div>
              <div className="min-w-0">
                <p className="text-[17px] font-semibold text-foreground">{personaName}</p>
                {personaRole && (
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{personaRole}</p>
                )}
              </div>
            </div>
          )}

          {currentStep === STEP_LANGUAGE ? (
            // Six options and a whole empty panel: a dropdown left the choice
            // looking like an afterthought on wide screens and hid five of the
            // six languages behind a click.
            <div className="max-w-3xl">
              <p className="mb-3 text-[15px] font-medium text-foreground">
                {t('member.caseIntro.languageLabel')}
              </p>
              <div
                role="radiogroup"
                aria-label={t('member.caseIntro.languageLabel')}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {LANGUAGE_OPTIONS.map(({ code, native, label }) => {
                  const isSelected = language === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isSavingLanguage}
                      onClick={() => handleLanguageSelect(code)}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/40 hover:bg-muted/40 focus-visible:border-primary focus-visible:outline-none'
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
                        {native}
                      </span>
                      {isSelected && (
                        <Check className="h-[18px] w-[18px] flex-shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {t('member.caseIntro.languageHint')}
              </p>
              {languageError && (
                <p className="mt-2 text-sm text-destructive">{languageError}</p>
              )}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <RichTextContent html={stepContent()} className="leading-relaxed" plainHeadings />
          )}
        </div>

        <div className="flex-shrink-0 flex justify-end gap-2.5 border-t border-border bg-white px-6 py-5 sm:px-12 sm:py-6">
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
              className="rounded-lg"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {t('member.caseIntro.back')}
            </Button>
          )}
          {currentStep < TOTAL_STEPS ? (
            <Button
              onClick={handleContinue}
              // The language step has nothing to wait on but its own save; the
              // case text steps wait on the case fetch.
              disabled={currentStep === STEP_LANGUAGE ? isSavingLanguage : isLoading}
              className="rounded-lg"
            >
              {t('member.caseIntro.continue')} →
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={isLoading || isStarting} className="rounded-lg">
              {isStarting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('member.caseIntro.starting') ?? 'Starting...'}
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-4 w-4" />
                  {t('member.dashboard.startWorking')}
                </>
              )}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default CaseIntro;
