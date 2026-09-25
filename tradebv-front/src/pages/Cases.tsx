import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Play, Search, RefreshCw, AlertCircle, Lock, Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { caseService } from '@/services/caseService';
import { simulationService } from '@/services/simulationService';
import { apiClient } from '@/services/api';
import type { Case } from '@/types/case';
import { formatDate as formatDateUtil } from '@/utils/dateTime';
import { extractLocalizedContent } from '@/utils/localizedContent';

const Cases = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { user, canAccessCase } = useAuth();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launchingCaseId, setLaunchingCaseId] = useState<string | null>(null);

  // Load cases on mount
  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedCases = await caseService.listCases();
      // Filter out draft cases for regular users
      const activeCases = fetchedCases.filter(case_ => !case_.is_draft);
      setCases(activeCases);
    } catch (err: any) {
      const errorMessage = err.message || t('cases.list.failedToLoad');
      setError(errorMessage);
      toast({
        title: t('cases.list.errorLoading'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter cases based on search term and accessibility
  const filteredCases = cases.filter((case_) => {
    // First check if user has access to this case
    if (!canAccessCase(case_.id)) {
      return false; // Hide inaccessible cases
    }

    // Then filter by search term
    const query = searchTerm.toLowerCase();
    const title = (case_.title || '').toLowerCase();
    const introText = (case_.intro_text || '').toLowerCase();

    return title.includes(query) || introText.includes(query);
  });

  const handleRunCase = async (caseId: string) => {
    if (!canAccessCase(caseId)) {
      toast({
        title: t('cases.list.accessDeniedTitle'),
        description: t('cases.list.accessDeniedBody'),
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create a new chat session first
      const response = await apiClient.post<{
        data: {
          id: number;
          case_id: number;
          user_id: string;
          name: string;
          [key: string]: any;
        };
      }>(`/simulation/start/${caseId}`);

      const chatId = response.data.id;
      console.log('💾 Chat created:', chatId);

      // Navigate to simulation with the chat ID
      navigate(`/simulation/${chatId}`);
    } catch (error) {
      console.error('Failed to create chat:', error);
      toast({
        title: t('cases.list.runErrorTitle'),
        description: t('cases.list.runErrorBody'),
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    const locale = language === 'uk' ? 'uk-UA' : 'en-US';
    return formatDateUtil(dateString, locale);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('cases.list.title')}</h1>
        <p className="text-muted-foreground">{t('cases.list.subtitle')}</p>
      </div>

      <div className="mb-6 flex justify-between items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={t('cases.list.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={loadCases}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {t('cases.list.refresh')}
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive mb-6">
          <CardContent className="p-6 flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          {t('cases.list.loading')}
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? t('cases.list.noMatchingSearch') : t('cases.list.noCases')}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCases.map((case_) => {
            return (
              <Card
                key={case_.id}
                className="transition-shadow flex flex-col hover:shadow-lg"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-2 min-w-0 flex-1">
                      {extractLocalizedContent(case_.title, language)}
                    </CardTitle>
                    <Badge className="bg-success text-success-foreground flex-shrink-0">
                      {t('cases.list.badgeAvailable')}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-3">
                    {extractLocalizedContent(case_.intro_text, language)}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  <div className="text-sm text-muted-foreground mb-4">
                    {t('cases.list.createdLabel')}: {formatDate(case_.created_at)}
                  </div>

                  <div className="mt-auto">
                    <Button
                      onClick={() => handleRunCase(case_.id)}
                      className="w-full"
                      variant="default"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {t('cases.list.startSimulation')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Cases;
