import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Play, Bot, User, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { personaService } from '@/services/personaService';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { VOICE_OPTIONS } from '@/constants/aiModels';
import type { Persona } from '@/types/case';

interface AITestRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  caseTitle: string;
}

interface TestMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface AIAction {
  id: string;
  action: string;
  timestamp: Date;
  details: string;
}

type TestPersonaFormState = {
  name: string;
  role: string;
  voice: string;
  personaDescription: string;
  goalDescription: string;
  voiceSample: string;
};

type EditablePersonaFormState = {
  id: string;
  caseId: string;
  name: string;
  role: string;
  voice: string;
  personaDescription: string;
  goalDescription: string;
};


export const AITestRunnerModal: React.FC<AITestRunnerModalProps> = ({
  isOpen,
  onClose,
  caseId,
  caseTitle
}) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [aiActions, setAIActions] = useState<AIAction[]>([]);
  const [finalDialogue, setFinalDialogue] = useState<TestMessage[]>([]);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isDialogueOpen, setIsDialogueOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSavingPersona, setIsSavingPersona] = useState(false);
  const [showTestPersonaForm, setShowTestPersonaForm] = useState(false);
  const [showEditPersonaForm, setShowEditPersonaForm] = useState(false);
  const [testPersona, setTestPersona] = useState<TestPersonaFormState>(() => ({
    name: '',
    role: '',
    voice: VOICE_OPTIONS[0]?.value ?? 'openai_alloy',
    personaDescription: '',
    goalDescription: '',
    voiceSample: '',
  }));
  const [editablePersona, setEditablePersona] = useState<EditablePersonaFormState | null>(null);

  // Load personas when modal opens
  useEffect(() => {
    if (isOpen && personas.length === 0) {
      loadPersonas();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedPersona) {
      setEditablePersona(null);
      setShowEditPersonaForm(false);
      return;
    }

    const persona = personas.find(p => p.id === selectedPersona);
    if (persona) {
      setEditablePersona({
        id: persona.id,
        caseId: persona.case_id,
        name: persona.name || '',
        role: persona.role || '',
        voice: persona.voice || (VOICE_OPTIONS[0]?.value ?? 'openai_alloy'),
        personaDescription: persona.persona_description || '',
        goalDescription: persona.goal_description || ''
      });
    } else {
      setEditablePersona(null);
    }
  }, [selectedPersona, personas]);

  const loadPersonas = async () => {
    setLoadingPersonas(true);
    try {
      const allPersonas = await personaService.listPersonas();
      // Filter out draft personas for testing
      const availablePersonas = allPersonas.filter(p => !p.is_draft);
      setPersonas(availablePersonas);
    } catch (error) {
      console.error('Failed to load personas:', error);
      toast({
        title: t('caseManagement.aiTestRunner.toasts.error.title'),
        description: t('caseManagement.aiTestRunner.toasts.error.load'),
        variant: 'destructive',
      });
    } finally {
      setLoadingPersonas(false);
    }
  };

  const handleRunTest = async () => {
    if (!selectedPersona) return;

    setIsRunning(true);
    setApiError(null);

    try {
      // TODO: Replace with actual API endpoint when backend is ready
      // const response = await fetch(`/api/cases/${caseId}/test-ai`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ persona_id: selectedPersona })
      // });
      // const data = await response.json();

      // Simulate API call that returns 501 (In development)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockResponse = {
        success: false,
        error: {
          code: 501,
          message: "In development"
        }
      };

      // The endpoint always returns 501 today — show the dev-status toast.
      // When the API is wired we'll populate setAIActions / setFinalDialogue
      // from the real response.
      if (mockResponse.error.code === 501) {
        const description = t('caseManagement.aiTestRunner.devStatus.description');
        setApiError(description);
        toast({
          title: t('caseManagement.aiTestRunner.devStatus.title'),
          description,
          variant: 'default',
        });
      } else {
        throw new Error(mockResponse.error.message);
      }
    } catch (err: any) {
      toast({
        title: t('caseManagement.aiTestRunner.toasts.error.title'),
        description: err.message || t('caseManagement.aiTestRunner.toasts.error.run'),
        variant: 'destructive',
      });
      setApiError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleTestPersonaChange = (field: keyof TestPersonaFormState, value: string) => {
    setTestPersona(prev => ({ ...prev, [field]: value }));
  };

  const handleEditablePersonaChange = (field: keyof Omit<EditablePersonaFormState, 'id' | 'caseId'>, value: string) => {
    setEditablePersona(prev => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSaveEditablePersona = async () => {
    if (!editablePersona) {
      return;
    }

    setIsSavingPersona(true);
    try {
      await personaService.updatePersona(editablePersona.id, {
        case_id: editablePersona.caseId,
        name: editablePersona.name,
        role: editablePersona.role,
        voice: editablePersona.voice,
        persona_description: editablePersona.personaDescription,
        goal_description: editablePersona.goalDescription,
      });

      setPersonas(prev =>
        prev.map(persona =>
          persona.id === editablePersona.id
            ? {
                ...persona,
                name: editablePersona.name,
                role: editablePersona.role,
                voice: editablePersona.voice,
                persona_description: editablePersona.personaDescription,
                goal_description: editablePersona.goalDescription,
              }
            : persona
        )
      );

      toast({
        title: t('caseManagement.aiTestRunner.toasts.update.title'),
        description: t('caseManagement.aiTestRunner.toasts.update.description'),
      });
      setShowEditPersonaForm(false);
    } catch (error: any) {
      toast({
        title: t('caseManagement.aiTestRunner.toasts.error.title'),
        description: error?.message || t('caseManagement.aiTestRunner.toasts.error.update'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingPersona(false);
    }
  };

  const handleDeletePersona = async () => {
    if (!editablePersona) {
      return;
    }

    if (!confirm(t('caseManagement.aiTestRunner.confirmDelete'))) {
      return;
    }

    setIsSavingPersona(true);
    try {
      await personaService.deletePersona(editablePersona.id);
      setPersonas(prev => prev.filter(persona => persona.id !== editablePersona.id));
      setSelectedPersona('');
      setEditablePersona(null);
      setShowEditPersonaForm(false);

      toast({
        title: t('caseManagement.aiTestRunner.toasts.delete.title'),
        description: t('caseManagement.aiTestRunner.toasts.delete.description'),
      });
    } catch (error: any) {
      toast({
        title: t('caseManagement.aiTestRunner.toasts.error.title'),
        description: error?.message || t('caseManagement.aiTestRunner.toasts.error.delete'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingPersona(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('uk-UA', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-auto max-w-[95vw] sm:max-w-4xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto p-4 sm:p-6 rounded-xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">{t('caseManagement.aiTestRunner.title')}</DialogTitle>
          <p className="text-muted-foreground text-sm sm:text-base truncate">{caseTitle}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 min-w-0 sm:max-w-xs w-full">
              <label className="text-sm font-medium mb-2 block">{t('caseManagement.aiTestRunner.testPersonaLabel')}</label>
              <Select value={selectedPersona} onValueChange={setSelectedPersona} disabled={loadingPersonas}>
                <SelectTrigger className="text-sm sm:text-base w-full sm:min-w-[20rem]">
                  <SelectValue placeholder={loadingPersonas ? t('caseManagement.loading') : t('caseManagement.aiTestRunner.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {personas.map((persona) => (
                    <SelectItem key={persona.id} value={persona.id}>
                      {persona.name} {persona.role ? ` - ${persona.role}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto flex-shrink-0"
                disabled={!editablePersona || isSavingPersona}
                onClick={() => setShowEditPersonaForm(prev => !prev)}
              >
                <Edit className="h-4 w-4 mr-2" />
                {showEditPersonaForm
                  ? t('caseManagement.aiTestRunner.actions.hideEdit')
                  : t('caseManagement.aiTestRunner.actions.edit')}
              </Button>
              <Button 
                onClick={handleRunTest} 
                disabled={!selectedPersona || isRunning}
                className="gap-2 w-full sm:w-auto flex-shrink-0"
              >
                <Play className="h-4 w-4" />
                {isRunning
                  ? t('caseManagement.aiTestRunner.actions.running')
                  : t('caseManagement.aiTestRunner.actions.run')}
              </Button>
            </div>
          </div>

          {/* API Error Display */}
          {apiError && (
            <Card className="p-4 border-warning bg-warning/10">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">{t('caseManagement.aiTestRunner.devStatus.title')}</p>
                  <p className="text-sm text-muted-foreground">{apiError}</p>
                </div>
              </div>
            </Card>
          )}

          {hasRun && !apiError && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <Collapsible open={isLogOpen} onOpenChange={setIsLogOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0">
                      <span className="font-medium text-sm sm:text-base">{t('caseManagement.aiTestRunner.collapsible.log')}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform flex-shrink-0 ${isLogOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <ScrollArea className="h-32 sm:h-48">
                      <div className="space-y-2 pr-2">
                        {aiActions.map((action) => (
                          <div key={action.id} className="border-l-2 border-primary pl-3 pb-2">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                              <span className="font-medium text-xs sm:text-sm break-words">{action.action}</span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">{formatTime(action.timestamp)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 break-words">{action.details}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              <Card className="p-3 sm:p-4">
                <Collapsible open={isDialogueOpen} onOpenChange={setIsDialogueOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0">
                      <span className="font-medium text-sm sm:text-base">{t('caseManagement.aiTestRunner.collapsible.dialogue')}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform flex-shrink-0 ${isDialogueOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <ScrollArea className="h-32 sm:h-48">
                      <div className="space-y-2 pr-2">
                        {finalDialogue.map((message) => (
                          <div key={message.id} className={`flex gap-2 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex gap-2 max-w-[85%] sm:max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                              <div className="flex-shrink-0">
                                {message.type === 'ai' ? (
                                  <Bot className="h-4 w-4 text-primary" />
                                ) : (
                                  <User className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className={`p-2 rounded-lg text-xs sm:text-sm break-words ${
                                message.type === 'user' 
                                  ? 'bg-primary text-primary-foreground' 
                                  : 'bg-muted'
                              }`}>
                                {message.content}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </div>
          )}

          {editablePersona && showEditPersonaForm && (
            <div className="mt-6 pt-4 border-t border-border/40">
              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-base sm:text-lg">{t('caseManagement.aiTestRunner.editPersonaCard.title')}</CardTitle>
                  <CardDescription>{t('caseManagement.aiTestRunner.editPersonaCard.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editPersonaName">{t('caseManagement.aiTestRunner.fields.name')}</Label>
                      <Input
                        id="editPersonaName"
                        value={editablePersona.name}
                        onChange={(e) => handleEditablePersonaChange('name', e.target.value)}
                        placeholder={t('caseManagement.aiTestRunner.placeholders.name')}
                        disabled={isSavingPersona}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editPersonaRole">{t('caseManagement.aiTestRunner.fields.role')}</Label>
                      <Input
                        id="editPersonaRole"
                        value={editablePersona.role}
                        onChange={(e) => handleEditablePersonaChange('role', e.target.value)}
                        placeholder={t('caseManagement.aiTestRunner.placeholders.role')}
                        disabled={isSavingPersona}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editPersonaVoice">{t('caseManagement.aiTestRunner.fields.voice')}</Label>
                    <Select
                      value={editablePersona.voice}
                      onValueChange={(value) => handleEditablePersonaChange('voice', value)}
                      disabled={isSavingPersona}
                    >
                      <SelectTrigger id="editPersonaVoice">
                        <SelectValue placeholder={t('caseManagement.aiTestRunner.placeholders.voiceSelect')} />
                      </SelectTrigger>
                      <SelectContent>
                        {VOICE_OPTIONS.map((voiceOption) => (
                          <SelectItem key={voiceOption.value} value={voiceOption.value}>
                            {voiceOption.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editPersonaDescription">{t('caseManagement.aiTestRunner.fields.description')}</Label>
                    <Textarea
                      id="editPersonaDescription"
                      value={editablePersona.personaDescription}
                      onChange={(e) => handleEditablePersonaChange('personaDescription', e.target.value)}
                      placeholder={t('caseManagement.aiTestRunner.placeholders.description')}
                      rows={3}
                      disabled={isSavingPersona}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editPersonaGoal">{t('caseManagement.aiTestRunner.fields.goals')}</Label>
                    <Textarea
                      id="editPersonaGoal"
                      value={editablePersona.goalDescription}
                      onChange={(e) => handleEditablePersonaChange('goalDescription', e.target.value)}
                      placeholder={t('caseManagement.aiTestRunner.placeholders.goals')}
                      rows={3}
                      disabled={isSavingPersona}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDeletePersona}
                      disabled={isSavingPersona}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('caseManagement.aiTestRunner.actions.delete')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowEditPersonaForm(false)}
                      disabled={isSavingPersona}
                    >
                      {t('caseManagement.aiTestRunner.actions.cancel')}
                    </Button>
                    <Button type="button" onClick={handleSaveEditablePersona} disabled={isSavingPersona}>
                      {isSavingPersona
                        ? t('caseManagement.aiTestRunner.actions.saving')
                        : t('caseManagement.aiTestRunner.actions.save')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className={`${showEditPersonaForm ? 'mt-6' : 'mt-4'} pt-4 border-t border-border/40`}>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => setShowTestPersonaForm(prev => !prev)}
            >
              <span>{showTestPersonaForm
                ? t('caseManagement.aiTestRunner.actions.hideTestPersona')
                : t('caseManagement.aiTestRunner.actions.showTestPersona')}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showTestPersonaForm ? 'rotate-180' : ''}`} />
            </Button>

            {showTestPersonaForm && (
              <Card className="mt-4">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-base sm:text-lg">{t('caseManagement.aiTestRunner.testPersonaCard.title')}</CardTitle>
                  <CardDescription>{t('caseManagement.aiTestRunner.testPersonaCard.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="testPersonaName">{t('caseManagement.aiTestRunner.fields.name')}</Label>
                      <Input
                        id="testPersonaName"
                        value={testPersona.name}
                        onChange={(e) => handleTestPersonaChange('name', e.target.value)}
                        placeholder={t('caseManagement.aiTestRunner.placeholders.name')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="testPersonaRole">{t('caseManagement.aiTestRunner.fields.role')}</Label>
                      <Input
                        id="testPersonaRole"
                        value={testPersona.role}
                        onChange={(e) => handleTestPersonaChange('role', e.target.value)}
                        placeholder={t('caseManagement.aiTestRunner.placeholders.role')}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="testPersonaVoice">{t('caseManagement.aiTestRunner.fields.voice')}</Label>
                    <Select
                      value={testPersona.voice}
                      onValueChange={(value) => handleTestPersonaChange('voice', value)}
                    >
                      <SelectTrigger id="testPersonaVoice">
                        <SelectValue placeholder={t('caseManagement.aiTestRunner.placeholders.voiceSelect')} />
                      </SelectTrigger>
                      <SelectContent>
                        {VOICE_OPTIONS.map((voiceOption) => (
                          <SelectItem key={voiceOption.value} value={voiceOption.value}>
                            {voiceOption.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="testPersonaDescription">{t('caseManagement.aiTestRunner.fields.description')}</Label>
                    <Textarea
                      id="testPersonaDescription"
                      value={testPersona.personaDescription}
                      onChange={(e) => handleTestPersonaChange('personaDescription', e.target.value)}
                      placeholder={t('caseManagement.aiTestRunner.placeholders.description')}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="testPersonaGoal">{t('caseManagement.aiTestRunner.fields.goals')}</Label>
                    <Textarea
                      id="testPersonaGoal"
                      value={testPersona.goalDescription}
                      onChange={(e) => handleTestPersonaChange('goalDescription', e.target.value)}
                      placeholder={t('caseManagement.aiTestRunner.placeholders.goals')}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="testPersonaVoiceSample">{t('caseManagement.aiTestRunner.fields.voiceSample')}</Label>
                    <Textarea
                      id="testPersonaVoiceSample"
                      value={testPersona.voiceSample}
                      onChange={(e) => handleTestPersonaChange('voiceSample', e.target.value)}
                      placeholder={t('caseManagement.aiTestRunner.placeholders.voiceSample')}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('caseManagement.aiTestRunner.voiceSampleHint')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
