import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AdminLayout } from '@/layouts/AdminLayout';
import { Plus, Search, Filter, Play, Edit, Trash2, RefreshCw, AlertCircle, Copy, Check, MessageSquare, ChevronDown, ChevronUp, TestTube2, Loader2, Send } from "lucide-react";
import { AITestRunnerModal } from "@/components/AITestRunnerModal";
import { AssignCaseDialog } from "@/components/AssignCaseDialog";
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { extractLocalizedContent } from '@/utils/localizedContent';
import { caseService } from '@/services/caseService';
import { simulationService } from '@/services/simulationService';
import type { Case } from '@/types/case';
import { formatDate as formatDateUtil } from '@/utils/dateTime';

const CaseManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useLanguage();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('cases');
  const [expandedDrafts, setExpandedDrafts] = useState<Record<string, boolean>>({});
  const [showApplyDraftDialog, setShowApplyDraftDialog] = useState(false);
  const [draftToApply, setDraftToApply] = useState<string | null>(null);
  const [aiTestModal, setAITestModal] = useState<{ isOpen: boolean; caseId: string; caseTitle: string }>({ isOpen: false, caseId: '', caseTitle: '' });
  const [assignModal, setAssignModal] = useState<{ isOpen: boolean; caseId: string; caseTitle: string }>({ isOpen: false, caseId: '', caseTitle: '' });
  const [launchingCaseId, setLaunchingCaseId] = useState<string | null>(null);
  const [creatingDraftForCaseId, setCreatingDraftForCaseId] = useState<string | null>(null);

  // API data
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test personas - removed, now using real personas from backend

  // Load data on mount
  useEffect(() => {
    loadCases();
    // Mark that user is on case management page for back button navigation
    sessionStorage.setItem('lastAdminPage', '/admin-dashboard/case-management');
  }, []);

  const loadCases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedCases = await caseService.listCases();
      setCases(fetchedCases);
    } catch (err: any) {
      const errorMessage = err.message || t('caseManagement.toasts.errorLoading');
      setError(errorMessage);
      toast({
        title: t('caseManagement.toasts.error'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  

  // Filter cases and personas (exclude drafts from main list - they show under their parent)
  const filteredCases = cases.filter((case_) => !case_.is_draft).filter((case_) => {
    const query = searchTerm.toLowerCase();
    const title = extractLocalizedContent(case_.title || '', language).toLowerCase();
    const introText = extractLocalizedContent(case_.intro_text || '', language).toLowerCase();
    
    return title.includes(query) || introText.includes(query);
  });

    

  // Get drafts for a specific case
  const getDraftsForCase = (caseId: string) => {
    return cases.filter(c => c.original_case_id === caseId && c.is_draft);
  };

  // Get status badge for draft/active
  const getStatusBadge = (isDraft: boolean) => {
    return isDraft ? (
        <Badge className="bg-muted text-muted-foreground">{t('caseManagement.case.status.draft')}</Badge>
    ) : (
        <Badge className="bg-success text-success-foreground">{t('caseManagement.case.status.active')}</Badge>
    );
  };

  const getEmotionBadgeColor = (index: number) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800',
      'bg-gray-100 text-gray-800'
    ];
    return colors[index % colors.length];
  };

  // Handlers
  // Always route through the 3-step case intro (Role / Persona / Overview)
  // — same path the member dashboard uses. The chat itself is created at
  // the end of the intro flow, not here. Previously this handler skipped
  // the intro screens entirely.
  const handleRunCase = (caseId: string) => {
    navigate(`/case-intro/${caseId}/step/1`);
  };

  const handleRunAITest = (caseId: string) => {
    const case_ = cases.find(c => c.id === caseId);
    if (case_) {
      setAITestModal({ isOpen: true, caseId: case_.id, caseTitle: case_.title });
    }
  };

  const handleAssignCase = (caseId: string) => {
    const case_ = cases.find(c => c.id === caseId);
    if (case_) {
      setAssignModal({ isOpen: true, caseId: case_.id, caseTitle: case_.title });
    }
  };


  const handleEditCase = (caseId: string) => {
    navigate(`/admin-dashboard/case-management/editor/${caseId}`);
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!confirm(t('caseManagement.toasts.caseDeletedDesc'))) {
      return;
    }

    try {
      await caseService.deleteCase(caseId);
      toast({
        title: t('caseManagement.toasts.caseDeleted'),
        description: t('caseManagement.toasts.caseDeletedDesc'),
      });
      await loadCases();
    } catch (err: any) {
      toast({
        title: t('caseManagement.toasts.error'),
        description: err.message || t('caseManagement.toasts.errorDeleting'),
        variant: 'destructive',
      });
    }
  };

  const handleCreateDraftCopy = async (caseId: string) => {
    try {
      setCreatingDraftForCaseId(caseId);
      console.log('Creating draft copy for case:', caseId);
      
      if (!caseId) {
        console.error('Case ID is undefined or empty!');
        toast({
          title: t('caseManagement.toasts.error'),
          description: 'Case ID is missing',
          variant: 'destructive',
        });
        setCreatingDraftForCaseId(null);
        return;
      }
      
      const draftResponse = await caseService.createDraftCopy(caseId);
      console.log('Draft response:', draftResponse);
      
      // Check if draftResponse has valid draft_id
      if (!draftResponse || !draftResponse.draft_id) {
        console.error('Draft response is invalid:', draftResponse);
        toast({
          title: t('caseManagement.toasts.error'),
          description: 'Failed to create draft: Invalid response',
          variant: 'destructive',
        });
        setCreatingDraftForCaseId(null);
        return;
      }
      
      toast({
        title: t('caseManagement.toasts.draftCopyCreated'),
        description: t('caseManagement.toasts.draftCopyCreatedDesc'),
      });
      await loadCases();
      // Navigate to draft case editor using draft_id
      navigate(`/admin-dashboard/case-management/editor/${draftResponse.draft_id}`);
    } catch (err: any) {
      console.error('Error creating draft copy:', err);
      toast({
        title: t('caseManagement.toasts.error'),
        description: err.message || t('caseManagement.toasts.errorCreatingDraft'),
        variant: 'destructive',
      });
    } finally {
      setCreatingDraftForCaseId(null);
    }
  };

  const handleApplyDraftClick = (draftCaseId: string) => {
    setDraftToApply(draftCaseId);
    setShowApplyDraftDialog(true);
  };

  const handleApplyDraftConfirm = async () => {
    if (!draftToApply) return;

    setShowApplyDraftDialog(false);

    try {
      const result = await caseService.applyDraftChanges(draftToApply);
      toast({
        title: t('caseManagement.toasts.changesApplied'),
        description: result.message,
      });
      await loadCases();
      // Navigate back to original case
      navigate(`/admin-dashboard/case-management/editor/${result.original_case_id}`);
    } catch (err: any) {
      toast({
        title: t('caseManagement.toasts.error'),
        description: err.message || t('caseManagement.toasts.errorApplyingChanges'),
        variant: 'destructive',
      });
    } finally {
      setDraftToApply(null);
    }
  };


  

  const formatDate = (dateString: string) => {
    const locale = language === 'uk' ? 'uk-UA' : 'en-US';
    return formatDateUtil(dateString, locale);
  };

  return (
      <AdminLayout
          title={t('caseManagement.title')}
          subtitle={t('caseManagement.subtitle')}
          headerActions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                  variant="outline"
                  onClick={() => {
                    loadCases();
                  }}
                  disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t('caseManagement.refresh')}
              </Button>
              <Button
                  onClick={() => navigate('/admin-dashboard/case-management/editor')}
                  className="bg-primary hover:bg-primary-hover text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('caseManagement.addCase')}
              </Button>
            </div>
          }
      >
        <div className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Error State */}
          {error && (
              <Card className="border-destructive">
                <CardContent className="p-6 flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span>{error}</span>
                </CardContent>
              </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                      placeholder={t('caseManagement.searchPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="grid w-full grid-cols-1">
                  <TabsTrigger value="cases">
                    {t('caseManagement.tabs.cases')} ({filteredCases.length})
                  </TabsTrigger>
                </TabsList>

                {/* Cases Tab */}
                <TabsContent value="cases" className="mt-6">
                  {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                        {t('caseManagement.loading')}
                      </div>
                  ) : filteredCases.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {searchTerm ? t('caseManagement.casesNotFound') : t('caseManagement.noCases')}
                      </div>
                  ) : (
                      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredCases.map((case_) => (
                            <Card key={case_.id} className="hover:shadow-medium transition-shadow flex flex-col overflow-hidden">
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2 min-w-0">
                                  <CardTitle className="text-base sm:text-lg line-clamp-2 min-w-0 flex-1">
                                    {extractLocalizedContent(case_.title, language)}
                                    {case_.is_draft && case_.original_case_id && (
                                        <Badge variant="outline" className="ml-2 text-xs flex-shrink-0">
                                          {t('caseManagement.case.draftCopy')}
                                        </Badge>
                                    )}
                                  </CardTitle>
                                  <div className="flex-shrink-0">
                                    {getStatusBadge(case_.is_draft)}
                                  </div>
                                </div>
                                <CardDescription className="line-clamp-2 text-sm">
                                  {extractLocalizedContent(case_.intro_text, language)}
                                </CardDescription>
                              </CardHeader>

                              <CardContent className="flex-1 flex flex-col p-3 sm:p-6 min-w-0">
                                <div className="text-xs text-muted-foreground mb-4">
                                  {t('caseManagement.case.createdAt')}: {formatDate(case_.created_at)}
                                </div>

                                <div className="space-y-3 sm:space-y-4 mt-auto min-w-0">
                                  <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                                    <Button
                                        size="sm"
                                        onClick={() => handleRunCase(case_.id)}
                                        className="flex-1 h-9 min-w-0"
                                        disabled={launchingCaseId === case_.id}
                                    >
                                      {launchingCaseId === case_.id ? (
                                          <Loader2 className="w-4 h-4 mr-1 animate-spin flex-shrink-0" />
                                      ) : (
                                          <Play className="w-4 h-4 mr-1 flex-shrink-0" />
                                      )}
                                      <span className="truncate">{t('caseManagement.case.actions.run')}</span>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRunAITest(case_.id)}
                                        className="flex-1 h-9 min-w-0"
                                    >
                                      <TestTube2 className="w-4 h-4 mr-1 flex-shrink-0" />
                                      <span className="truncate">{t('caseManagement.case.actions.testWithAI')}</span>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleAssignCase(case_.id)}
                                        className="flex-1 h-9 min-w-0"
                                    >
                                      <Send className="w-4 h-4 mr-1 flex-shrink-0" />
                                      <span className="truncate">{t('userProfile.assignCaseModal.title')}</span>
                                    </Button>
                                  </div>

                                  <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleCreateDraftCopy(case_.id)}
                                        className="flex-1 text-sm h-9 min-w-0"
                                        disabled={creatingDraftForCaseId === case_.id}
                                    >
                                      {creatingDraftForCaseId === case_.id ? (
                                          <Loader2 className="w-4 h-4 mr-1 animate-spin flex-shrink-0" />
                                      ) : (
                                          <Copy className="w-4 h-4 mr-1 flex-shrink-0" />
                                      )}
                                      <span className="truncate">{t('caseManagement.case.actions.createDraft')}</span>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleEditCase(case_.id)}
                                        className="flex-1 text-sm h-9 min-w-0"
                                    >
                                      <Edit className="w-4 h-4 mr-1 flex-shrink-0" />
                                      <span className="truncate">{t('caseManagement.case.actions.edit')}</span>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDeleteCase(case_.id)}
                                        className="text-destructive hover:text-destructive text-sm h-9 flex-shrink-0 w-auto sm:w-auto px-2 sm:px-3"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>

                                  {/* Drafts List */}
                                  {getDraftsForCase(case_.id).length > 0 && (
                                      <Collapsible
                                          open={expandedDrafts[case_.id]}
                                          onOpenChange={(open) => setExpandedDrafts(prev => ({ ...prev, [case_.id]: open }))}
                                      >
                                        <CollapsibleTrigger asChild>
                                          <Button
                                              variant="outline"
                                              size="sm"
                                              className="w-full justify-between"
                                          >
                                <span className="flex items-center">
                                  <MessageSquare className="w-4 h-4 mr-2" />
                                  {t('caseManagement.case.drafts')} ({getDraftsForCase(case_.id).length})
                                </span>
                                            {expandedDrafts[case_.id] ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            )}
                                          </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-2">
                                          <div className="max-h-48 overflow-y-auto space-y-2">
                                            {getDraftsForCase(case_.id).map((draft) => (
                                                <div
                                                    key={draft.id}
                                                    className="flex items-center gap-2 p-2 border rounded-md bg-muted/50"
                                                >
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{extractLocalizedContent(draft.title, language)}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                      {t('caseManagement.case.createdAt')}: {formatDate(draft.created_at)}
                                                    </p>
                                                  </div>
                                                  <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="text-success hover:text-success"
                                                      onClick={() => handleApplyDraftClick(draft.id)}
                                                  >
                                                    <Check className="w-4 h-4" />
                                                  </Button>
                                                  <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      onClick={() => navigate(`/admin-dashboard/case-management/editor/${draft.id}`)}
                                                  >
                                                    <Edit className="w-4 h-4" />
                                                  </Button>
                                                  <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      onClick={() => handleDeleteCase(draft.id)}
                                                      className="text-destructive hover:text-destructive"
                                                  >
                                                    <Trash2 className="w-4 h-4" />
                                                  </Button>
                                                </div>
                                            ))}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                        ))}
                      </div>
                  )}
                </TabsContent>

                
              </Tabs>
            </CardContent>
          </Card>

        </div>

        {/* Apply Draft Confirmation Dialog */}
        <AlertDialog open={showApplyDraftDialog} onOpenChange={setShowApplyDraftDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('caseManagement.applyDraft.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('caseManagement.applyDraft.description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('caseManagement.applyDraft.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                  onClick={handleApplyDraftConfirm}
                  className="bg-success hover:bg-success/90"
              >
                {t('caseManagement.applyDraft.apply')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* AI Test Runner Modal */}
        <AITestRunnerModal
          isOpen={aiTestModal.isOpen}
          onClose={() => setAITestModal({ isOpen: false, caseId: '', caseTitle: '' })}
          caseId={aiTestModal.caseId}
          caseTitle={aiTestModal.caseTitle}
        />

        {/* Assign Case Modal */}
        <AssignCaseDialog
          open={assignModal.isOpen}
          onOpenChange={(open) =>
            setAssignModal((prev) => ({ ...prev, isOpen: open }))
          }
          caseId={assignModal.caseId}
          caseTitle={assignModal.caseTitle}
        />
      </AdminLayout>
  );
};

export default CaseManagement;
