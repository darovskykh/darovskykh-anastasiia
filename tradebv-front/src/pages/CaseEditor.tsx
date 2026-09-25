import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, TestTube2, Plus, Send, Bot, User, Settings, Trash2, Upload, MessageSquare, Activity, Loader2, Check, Volume2, Info, ChevronDown, ShieldCheck, AlertTriangle, XCircle } from "lucide-react";
import { type TrainingCase, type PersonaEmotion, type PersonaAction, type Scenario, type EvaluationCategory } from "@/data/mockCases";
import type { Persona as PersonaPublic } from "@/types/case";
import { AITestRunnerModal } from "@/components/AITestRunnerModal";
import { AudioPlayer } from "@/components/AudioPlayer";
import { VOICE_OPTIONS } from "@/constants/aiModels";
import { useLanguage } from "@/contexts/LanguageContext";
import { caseService } from "@/services/caseService";
import { personaService } from "@/services/personaService";
import { evaluationPromptService } from "@/services/evaluationPromptService";
import { apiClient } from "@/services/api";
import { apiToTrainingCase, trainingCaseToCaseCreate, trainingCaseToCaseUpdate, mockPersonaToPersonaCreate, mockPersonaToPersonaUpdate } from "@/utils/caseMapper";
import { useToast } from "@/hooks/use-toast";
import { formatTime } from "@/utils/dateTime";
import { wsService } from "@/services/websocket";
import { MODEL_GROUPS, AI_MODELS } from "@/constants/aiModels";
import { DEFAULT_STYLE_AND_LANGUAGE, DEFAULT_BEHAVIOR_CONSTRAINTS, DEFAULT_INTERNAL_REASONING } from "@/constants/persona";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Cropper, { type Area } from "react-easy-crop";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MultiLocaleField } from "@/components/MultiLocaleField";
import PersonaBehaviorConfigEditor from "@/components/PersonaBehaviorConfigEditor";
import { createDefaultPersonaBehaviorConfig, type PersonaBehaviorMode } from "@/types/personaBehavior";
import { savePersonaOnly as savePersonaRecordOnly } from "@/utils/personaSave";

interface Message {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  operations?: Array<{
    entity: string;
    entity_id: string;
    operation: string;
    field: string;
    old_value?: any;
    new_value: any;
  }>;
}

interface VoicePreviewResponse {
  audio_url: string;
}

interface AuditFinding {
  severity: 'error' | 'warn';
  message: string;
}

interface CaseAuditResult {
  case_title: string;
  persona_name: string;
  findings: AuditFinding[];
  errors: number;
  warnings: number;
}

const CaseEditor = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const isEditing = Boolean(caseId);
  const defaultVoiceSample = t('caseEditor.persona.voiceSampleDefault');
  const defaultVoiceSampleRef = useRef(defaultVoiceSample);
  const isHrVersion = String(
    (import.meta.env as any)?.VITE_HR_VERSION ??
    ''
  ).toLowerCase() === 'true';

  // Helper function to translate model category labels
  const getModelCategoryLabel = (label: string): string => {
    const categoryMap: Record<string, string> = {
      'Recommended for Analysis': 'aiModels.categories.recommendedForAnalysis',
      'For Emotional Tone': 'aiModels.categories.forEmotionalTone',
      'Advanced Reasoning': 'aiModels.categories.advancedReasoning',
      'Fast & Efficient': 'aiModels.categories.fastAndEfficient',
      'Other Providers': 'aiModels.categories.otherProviders'
    };
    const translationKey = categoryMap[label];
    return translationKey ? t(translationKey) : label;
  };

  // Helper function to translate model descriptions
  const getModelDescription = (value: string, defaultDescription: string): string => {
    const descriptionMap: Record<string, string> = {
      [AI_MODELS.GPT_OPENAI_4_1]: 'aiModels.descriptions.gpt41',
      [AI_MODELS.CLAUDE_SONNET_3_7]: 'aiModels.descriptions.claude37Sonnet',
      [AI_MODELS.CLAUDE_OPUS_3]: 'aiModels.descriptions.claude3Opus',
      [AI_MODELS.GPT_OPENAI_4_O]: 'aiModels.descriptions.gpt4o',
      [AI_MODELS.GEMINI_PRO_2_5]: 'aiModels.descriptions.gemini25Pro',
      [AI_MODELS.CLAUDE_SONNET_3_5]: 'aiModels.descriptions.claude35Sonnet',
      [AI_MODELS.CLAUDE_HAIKU_3_5]: 'aiModels.descriptions.claude35Haiku'
    };
    const translationKey = descriptionMap[value];
    return translationKey ? t(translationKey) : defaultDescription;
  };

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPersona, setIsSavingPersona] = useState(false);
  const [isApplyingDraft, setIsApplyingDraft] = useState(false);
  const [isDraftCase, setIsDraftCase] = useState(false);
  const [originalCaseId, setOriginalCaseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [showApplyDraftDialog, setShowApplyDraftDialog] = useState(false);
  const [aiTestModal, setAITestModal] = useState<{ isOpen: boolean; caseId: string; caseTitle: string }>({ isOpen: false, caseId: '', caseTitle: '' });
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<{ open: boolean; result: CaseAuditResult | null }>({ open: false, result: null });

  // Evaluation prompts
  const [evaluationPrompts, setEvaluationPrompts] = useState<Array<{ id: string; name: string }>>([]);
  const [currentEvaluationPrompt, setCurrentEvaluationPrompt] = useState<{ id: string; name: string; main_prompt: string; categories_prompts: Record<string, string>; is_draft: boolean } | null>(null);
  const [editedEvaluationPrompt, setEditedEvaluationPrompt] = useState('');
  const [editedEvaluationPromptName, setEditedEvaluationPromptName] = useState('');
  const [editedCategoriesPrompts, setEditedCategoriesPrompts] = useState<Record<string, string>>({});
  const [editedIsDraft, setEditedIsDraft] = useState(false);
  
  const [finalEvaluationPrompts, setFinalEvaluationPrompts] = useState<Array<{ id: string; name: string }>>([]);
  const [finalEvaluationPrompt, setFinalEvaluationPrompt] = useState<{ id: string; name: string; prompt: string; is_draft: boolean } | null>(null);
  const [editedFinalPrompt, setEditedFinalPrompt] = useState('');
  const [editedFinalPromptName, setEditedFinalPromptName] = useState('');
  const [editedFinalIsDraft, setEditedFinalIsDraft] = useState(false);

  // States for creating new prompts
  const [isCreatingEvaluationPrompt, setIsCreatingEvaluationPrompt] = useState(false);
  const [isCreatingFinalPrompt, setIsCreatingFinalPrompt] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const promptEditorRef = useRef<HTMLDivElement | null>(null);
  const [showEditorHighlight, setShowEditorHighlight] = useState(false);
  const editorHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editingReaction, setEditingReaction] = useState<{
    id: string;
    name: string;
    description: string;
    prompt: string;
    selectionLogic: string;
    goals: string;
  } | null>(null);

  // Update active tab from URL query params
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [window.location.search]);

  const scrollPromptEditorIntoView = () => {
    if (typeof window === 'undefined') {
      return;
    }
    window.requestAnimationFrame(() => {
      if (!promptEditorRef.current) {
        return;
      }
      promptEditorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShowEditorHighlight(true);
      if (editorHighlightTimeoutRef.current) {
        window.clearTimeout(editorHighlightTimeoutRef.current);
      }
      editorHighlightTimeoutRef.current = window.setTimeout(() => {
        setShowEditorHighlight(false);
        editorHighlightTimeoutRef.current = null;
      }, 2000);
    });
  };

  const updateReaction = () => {
    if (!editingReaction?.name || !editingReaction.prompt) {
      toast({
        title: t('userProfile.toasts.error'),
        description: t('caseEditor.persona.reactions.validationError'),
        variant: 'destructive'
      });
      return;
    }
  
    setCaseData(prev => ({
      ...prev,
      persona: {
        ...prev.persona!,
        reactions: prev.persona?.reactions?.map(r => 
          r.id === editingReaction.id 
            ? {
                id: r.id,
                name: editingReaction.name,
                description: editingReaction.description,
                prompt: editingReaction.prompt,
                selectionLogic: editingReaction.selectionLogic,
                goals: editingReaction.goals
              }
            : r
        ) || []
      }
    }));
  
    setEditingReaction(null);
    
    toast({
      title: t('userProfile.toasts.success'),
      description: 'Reaction updated successfully'
    });
  };

  useEffect(() => {
    return () => {
      if (editorHighlightTimeoutRef.current) {
        window.clearTimeout(editorHighlightTimeoutRef.current);
      }
    };
  }, []);

  const handleSelectEvaluationPrompt = (promptId: string) => {
    setCaseData(prev => {
      if (prev.evaluationPromptId === promptId) {
        return prev;
      }
      return { ...prev, evaluationPromptId: promptId };
    });
  };

  // State for case data
  const [caseData, setCaseData] = useState<Partial<TrainingCase>>({
    title: '',
    userDescription: '',
    aiDescription: '',
    simulation_navigation: '',
    status: 'Active',
    enrolledUsers: 0,
    completedUsers: 0,
    averageScore: 0,
    persona: {
      id: '',
      name: '',
      description: '',
      emotions: [],
      actions: [],
      style_and_language: DEFAULT_STYLE_AND_LANGUAGE,
      behavior_constraints: DEFAULT_BEHAVIOR_CONSTRAINTS,
      internal_reasoning: DEFAULT_INTERNAL_REASONING,
      voice_enabled: true,
      behavior_mode: 'legacy_router_talker',
      behavior_config: null,
    },
    scenarios: [],
    evaluationCategories: [],
    evaluationPromptId: null,
    evaluationPromptModelName: AI_MODELS.DEFAULT,
    finalEvaluationPromptId: null,
    finalEvaluationPromptModelName: AI_MODELS.DEFAULT,
    llm1ModelName: AI_MODELS.DEFAULT,
    llm2ModelName: AI_MODELS.DEFAULT
  });

  const [voicePreviewText, setVoicePreviewText] = useState(defaultVoiceSample);
  const [voicePreviewAudioUrl, setVoicePreviewAudioUrl] = useState<string | null>(null);
  const [isGeneratingVoicePreview, setIsGeneratingVoicePreview] = useState(false);
  const [personaV2JsonValidity, setPersonaV2JsonValidity] = useState<Record<string, boolean>>({});
  const handlePersonaV2JsonValidity = useCallback((field: string, valid: boolean) => {
    setPersonaV2JsonValidity(prev => (prev[field] === valid ? prev : { ...prev, [field]: valid }));
  }, []);

  // AI Assistant state
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [selectedTestPersona, setSelectedTestPersona] = useState<string>('');
  const [allPersonas, setAllPersonas] = useState<PersonaPublic[]>([]);
  const [showAILog, setShowAILog] = useState(false);
  const [showFinalDialogue, setShowFinalDialogue] = useState(false);
  const [draftChatId, setDraftChatId] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Modal states for adding items
  const [showAddEmotion, setShowAddEmotion] = useState(false);
  const [showAddAction, setShowAddAction] = useState(false);
  const [editingAction, setEditingAction] = useState<PersonaAction | null>(null);
  const [showAddReaction, setShowAddReaction] = useState(false);
  const [showAddEvaluation, setShowAddEvaluation] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<EvaluationCategory & { instruction: string } | null>(null);
  
  const [showEvaluationPromptDialog, setShowEvaluationPromptDialog] = useState(false);
  const [showFinalEvaluationPromptDialog, setShowFinalEvaluationPromptDialog] = useState(false);

  // Form states for new items
  const [newEmotion, setNewEmotion] = useState<Partial<PersonaEmotion>>({ name: '', description: '' });
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newAction, setNewAction] = useState<Partial<PersonaAction>>({ name: '', description: '', shortDescription: '', chatMessage: '', popupText: '' });
  const [newReaction, setNewReaction] = useState<{ 
    name: string; 
    description: string; 
    prompt: string; 
    selectionLogic: string;
    goals: string; // добавить
  }>({
    name: '',
    description: '',
    prompt: '',
    selectionLogic: '',
    goals: '' // TODO
  });
  const [newEvaluation, setNewEvaluation] = useState<{ name: string; description: string; instruction: string }>({ name: '', description: '', instruction: '' });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<{ type: 'newEmotion' | 'existingEmotion'; index?: number } | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropFileName, setCropFileName] = useState<string>('image.jpg');
  const [cropFileType, setCropFileType] = useState<string>('image/jpeg');

  useEffect(() => {
    setVoicePreviewText((prev) => {
      const shouldUpdate = prev.trim() === '' || prev === defaultVoiceSampleRef.current;
      defaultVoiceSampleRef.current = defaultVoiceSample;
      return shouldUpdate ? defaultVoiceSample : prev;
    });
  }, [defaultVoiceSample]);

  useEffect(() => {
    setVoicePreviewAudioUrl(null);
  }, [caseData.persona?.voice]);

  // Load evaluation prompts
  useEffect(() => {
    const loadEvaluationPrompts = async () => {
      try {
        console.log('Loading evaluation prompts...');
        const prompts = await evaluationPromptService.listEvaluationPrompts();
        console.log('Loaded evaluation prompts:', prompts);
        setEvaluationPrompts(prompts.map(p => ({ id: String(p.id), name: p.name })));

        // Load all final evaluation prompts for the dropdown
        try {
          const finalPrompts = await evaluationPromptService.getFinalEvaluationPrompts();
          if (finalPrompts && finalPrompts.length > 0) {
            console.log('Loaded final evaluation prompts:', finalPrompts);
            setFinalEvaluationPrompts(finalPrompts.map(p => ({ id: String(p.id), name: p.name })));
          } else {
            console.log('No final evaluation prompts found');
            setFinalEvaluationPrompts([]);
          }
        } catch (error) {
          console.log('No final evaluation prompts found or error loading:', error);
          setFinalEvaluationPrompts([]);
        }
      } catch (error) {
        console.error('Failed to load evaluation prompts:', error);
      }
    };

    loadEvaluationPrompts();
  }, []);

  // Load current evaluation prompt when case evaluation prompt ID changes
  useEffect(() => {
    const loadCurrentEvaluationPrompt = async () => {
      if (caseData.evaluationPromptId) {
        try {
          console.log('Loading current evaluation prompt:', caseData.evaluationPromptId);
          // Load the full prompt from the API
          const fullPromptData = await evaluationPromptService.getEvaluationPromptAllData(caseData.evaluationPromptId);
          const fullPrompt = fullPromptData.prompt;
          setCurrentEvaluationPrompt(fullPrompt);
          setEditedEvaluationPromptName(fullPrompt.name);
          setEditedEvaluationPrompt(fullPrompt.main_prompt);
          setEditedCategoriesPrompts(fullPrompt.categories_prompts);
          setEditedIsDraft(fullPrompt.is_draft);
          console.log('Loaded full evaluation prompt:', fullPrompt);
        } catch (error) {
          console.error('Failed to load evaluation prompt:', error);
          setCurrentEvaluationPrompt(null);
        }
      } else {
        setCurrentEvaluationPrompt(null);
        setEditedEvaluationPromptName('');
        setEditedEvaluationPrompt('');
        setEditedCategoriesPrompts({});
        setEditedIsDraft(false);
      }
    };

    loadCurrentEvaluationPrompt();
  }, [caseData.evaluationPromptId]);

  // Load current final evaluation prompt when case final evaluation prompt ID changes
  useEffect(() => {
    const loadCurrentFinalEvaluationPrompt = async () => {
      if (caseData.finalEvaluationPromptId) {
        try {
          console.log('Loading current final evaluation prompt:', caseData.finalEvaluationPromptId);
          // Load the full prompt from the API
          const fullPrompt = await evaluationPromptService.getFinalEvaluationPrompt(caseData.finalEvaluationPromptId);
          setFinalEvaluationPrompt(fullPrompt);
          setEditedFinalPromptName(fullPrompt.name);
          setEditedFinalPrompt(fullPrompt.prompt);
          setEditedFinalIsDraft(fullPrompt.is_draft);
          console.log('Loaded full final evaluation prompt:', fullPrompt);
        } catch (error) {
          console.error('Failed to load final evaluation prompt:', error);
          setFinalEvaluationPrompt(null);
        }
      } else {
        setFinalEvaluationPrompt(null);
        setEditedFinalPromptName('');
        setEditedFinalPrompt('');
        setEditedFinalIsDraft(false);
      }
    };

    loadCurrentFinalEvaluationPrompt();
  }, [caseData.finalEvaluationPromptId]);

  // Load all personas for AI assistant
  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const personas = await personaService.listPersonas();
        setAllPersonas(personas);
      } catch (error) {
        console.error('Failed to load personas:', error);
      }
    };
    loadPersonas();
  }, []);

  // Load case data from API
  useEffect(() => {
    const loadCase = async () => {
      if (isEditing && caseId) {
        setIsLoading(true);
        try {
          const caseAllData = await caseService.getCaseAllData(caseId);
          const trainingCase = apiToTrainingCase(caseAllData);
          setCaseData(trainingCase);

          // Check if this is a draft case
          const isDraft = caseAllData.case.is_draft && caseAllData.case.original_case_id;
          setIsDraftCase(isDraft);
          if (isDraft) {
            setOriginalCaseId(caseAllData.case.original_case_id);
          }
        } catch (error: any) {
          console.error('Failed to load case:', error);
          toast({
            title: t('userProfile.toasts.error'),
            description: error.message || t('caseEditor.toasts.loadError'),
            variant: 'destructive'
          });
          // Navigate back on error
          navigate('/admin-dashboard/case-management');
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadCase();
    // Note: keep dependency list minimal to avoid reloading case data (and losing unsaved edits)
    // when language changes; toast/navigate are stable from hooks.
  }, [caseId, isEditing, navigate, toast]);

  // Load draft chat history when component mounts
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!isDraftCase || !caseId) return;

      const token = localStorage.getItem('auth_token');
      if (!token) return;

      try {
        console.log('📋 Loading draft chat history for case:', caseId);

        const baseUrl = import.meta.env.VITE_API_BASE_URL;
        const response = await fetch(
          `${baseUrl}/admin/self-adjust/draft/chat/${caseId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        const result = await response.json();
        console.log('📥 Chat history response:', result);

        if (result.success && result.data) {
          const { chat_id, chat_history } = result.data;

          if (chat_id) {
            setDraftChatId(chat_id);
            console.log('✅ Set draft chat ID:', chat_id);
          }

          if (chat_history && chat_history.length > 0) {
            // Convert backend format to frontend Message format
            const loadedMessages: Message[] = chat_history.map((msg: any, idx: number) => ({
              id: `loaded-${idx}`,
              role: msg.message_type === 'human' ? 'user' : msg.message_type === 'ai' ? 'ai' : 'system',
              content: msg.message_text,
              timestamp: new Date(msg.created_at),
              operations: msg.operations || []
            }));

            setMessages(loadedMessages);
            console.log(`✅ Loaded ${loadedMessages.length} messages from history`);
          } else {
            console.log('ℹ️ No chat history found for this case');
          }
        }
      } catch (error) {
        console.error('❌ Failed to load chat history:', error);
      }
    };

    loadChatHistory();
  }, [isDraftCase, caseId]);

  // Setup WebSocket for draft chat
  useEffect(() => {
    if (!isDraftCase || !caseId) return;

    const setupWebSocket = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      if (!wsService.isConnected()) {
        await wsService.connect(token);
      }

      // Listen for draft chat responses
      const handleDraftResponse = (data: any) => {
        if (data.type === 'draft_response') {
          setIsSendingMessage(false);

          if (data.chat_id) {
            setDraftChatId(data.chat_id);
          }

          const aiResponse: Message = {
            id: Date.now().toString(),
            role: 'ai',
            content: data.message || '',
            timestamp: new Date(),
            operations: data.operations || []
          };

          setMessages(prev => [...prev, aiResponse]);
        }
      };

      wsService.on(`/draft/chat/${caseId}`, handleDraftResponse);

      return () => {
        wsService.off(`/draft/chat/${caseId}`, handleDraftResponse);
      };
    };

    setupWebSocket();
  }, [isDraftCase, caseId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize evaluation prompt form fields when currentEvaluationPrompt changes
  useEffect(() => {
    const initializeFormFields = async () => {
      if (currentEvaluationPrompt) {
        try {
          // Load the full prompt content from the API if not already loaded
          if (!currentEvaluationPrompt.main_prompt) {
            console.log('Loading full evaluation prompt content:', currentEvaluationPrompt.id);
            const fullPrompts = await evaluationPromptService.listEvaluationPrompts();
            const fullPrompt = fullPrompts.find(p => p.id === currentEvaluationPrompt.id);
            
            if (fullPrompt) {
              setCurrentEvaluationPrompt({
                ...currentEvaluationPrompt,
                main_prompt: fullPrompt.main_prompt,
                categories_prompts: fullPrompt.categories_prompts,
                is_draft: fullPrompt.is_draft
              });
              setEditedEvaluationPrompt(fullPrompt.main_prompt);
              setEditedEvaluationPromptName(fullPrompt.name);
              setEditedCategoriesPrompts(fullPrompt.categories_prompts || {});
              setEditedIsDraft(fullPrompt.is_draft);
            }
          } else {
            // Data is already loaded, just populate the form fields
            setEditedEvaluationPrompt(currentEvaluationPrompt.main_prompt);
            setEditedEvaluationPromptName(currentEvaluationPrompt.name);
            setEditedCategoriesPrompts(currentEvaluationPrompt.categories_prompts || {});
            setEditedIsDraft(currentEvaluationPrompt.is_draft);
          }
        } catch (error) {
          console.error('Failed to load full evaluation prompt:', error);
        }
      }
    };

    initializeFormFields();
  }, [currentEvaluationPrompt]);

  // Sync evaluation categories from categories_prompts to caseData.evaluationCategories
  useEffect(() => {
    if (currentEvaluationPrompt?.categories_prompts) {
      const promptCategories = Object.keys(currentEvaluationPrompt.categories_prompts);
      const existingCategories = caseData.evaluationCategories || [];
      
      // Check if we need to add categories from categories_prompts that don't exist in evaluationCategories
      const missingCategories = promptCategories.filter(promptCat => 
        !existingCategories.some(existingCat => existingCat.name === promptCat)
      );
      
      if (missingCategories.length > 0) {
        const newCategories = missingCategories.map(catName => ({
          id: `prompt_${catName}_${Date.now()}_${Math.random()}`,
          name: catName,
          description: t('caseEditor.evaluation.categoryFromPrompt', { catName })
        }));
        
        setCaseData(prev => ({
          ...prev,
          evaluationCategories: [...(prev.evaluationCategories || []), ...newCategories]
        }));
      }
    }
  }, [currentEvaluationPrompt?.categories_prompts]);

  // Initialize final evaluation prompt form fields when finalEvaluationPrompt changes
  useEffect(() => {
    const initializeFinalFormFields = async () => {
      if (finalEvaluationPrompt) {
        try {
          // Load the full prompt content from the API if not already loaded
          if (!finalEvaluationPrompt.prompt) {
            console.log('Loading full final evaluation prompt content:', finalEvaluationPrompt.id);
            const fullPrompts = await evaluationPromptService.getFinalEvaluationPrompts();
            const fullPrompt = fullPrompts.find(p => p.id === finalEvaluationPrompt.id);
            
            if (fullPrompt) {
              setFinalEvaluationPrompt({
                ...finalEvaluationPrompt,
                name: fullPrompt.name,
                prompt: fullPrompt.prompt,
                is_draft: fullPrompt.is_draft
              });
              setEditedFinalPrompt(fullPrompt.prompt);
              setEditedFinalPromptName(fullPrompt.name);
              setEditedFinalIsDraft(fullPrompt.is_draft);
            }
          } else {
            // Data is already loaded, just populate the form fields
            setEditedFinalPrompt(finalEvaluationPrompt.prompt);
            setEditedFinalPromptName(finalEvaluationPrompt.name);
            setEditedFinalIsDraft(finalEvaluationPrompt.is_draft);
          }
        } catch (error) {
          console.error('Failed to load full final evaluation prompt:', error);
        }
      }
    };

    initializeFinalFormFields();
  }, [finalEvaluationPrompt]);

  const handleSendMessage = () => {
    if (!chatInput.trim() || !caseId || isSendingMessage) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    const messageContent = chatInput;
    setChatInput('');
    setIsSendingMessage(true);

    // Send via WebSocket
    wsService.send(`/draft/chat/${caseId}`, {
      type: 'text_message',
      content: messageContent,
      chat_id: draftChatId,
      lang: 'en'
    });
  };

  const handleApplyDraftClick = () => {
    setShowApplyDraftDialog(true);
  };

  const handleApplyDraftConfirm = async () => {
    if (!caseId || !isDraftCase) return;

    setShowApplyDraftDialog(false);
    setIsApplyingDraft(true);

    try {
      const result = await caseService.applyDraftChanges(caseId);
      toast({
        title: 'Draft Applied',
        description: 'Draft changes have been successfully applied to the original case.',
      });
      // Navigate to the original case
      navigate(`/admin-dashboard/case-management/editor/${result.original_case_id}`);
    } catch (error: any) {
      console.error('Failed to apply draft:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to apply draft changes',
        variant: 'destructive',
      });
    } finally {
      setIsApplyingDraft(false);
    }
  };

  const handlePersonaBehaviorModeChange = (mode: PersonaBehaviorMode) => {
    setPersonaV2JsonValidity({});
    setCaseData(prev => {
      const persona = prev.persona || {
        id: '',
        name: '',
        description: '',
        emotions: [],
        actions: [],
      };
      return {
        ...prev,
        persona: {
          ...persona,
          behavior_mode: mode,
          behavior_config: mode === 'stateful_controller'
            ? persona.behavior_config || createDefaultPersonaBehaviorConfig(persona.reactions?.[0]?.name || 'default')
            : persona.behavior_config || null,
        },
      };
    });
  };

  const validatePersonaBehaviorConfig = (): string[] => {
    const persona = caseData.persona;
    if (persona?.behavior_mode !== 'stateful_controller') return [];
    const config = persona.behavior_config;
    if (!config) return ['Stateful controller mode requires a V2 behavior profile.'];

    const errors: string[] = [];
    if (Object.values(personaV2JsonValidity).some(valid => !valid)) {
      errors.push('Fix the highlighted advanced JSON before saving.');
    }
    if (config.schema_version !== 2) errors.push('Behavior profile schema_version must be 2.');
    if (!config.allowed_action_tendencies.length) errors.push('Choose at least one action tendency.');
    if (!config.allowed_goal_progress.length) errors.push('Choose at least one goal progress value.');
    if (!config.allowed_persistence.length) errors.push('Choose at least one persistence value.');
    if (!config.features.events.length) errors.push('Add at least one controller event.');
    if (!Object.keys(config.features.state_tracks).length) errors.push('Add at least one state track.');
    if (!config.features.fact_ledger.classifications.length) errors.push('Add at least one fact classification.');
    if (!config.features.routing_rules.length) errors.push('Add at least one routing rule.');
    if (config.features.routing_rules.filter(rule => rule.is_default).length !== 1) {
      errors.push('Mark exactly one routing rule as the default.');
    }
    return errors;
  };

  const handleSavePersona = async () => {
    if (!caseId || !caseData.persona?.id) {
      toast({
        title: 'Save the case first',
        description: 'A new case needs its first full save before its persona can be saved separately.',
        variant: 'destructive',
      });
      return;
    }

    const behaviorErrors = validatePersonaBehaviorConfig();
    if (behaviorErrors.length > 0) {
      toast({
        title: 'Review the V2 persona profile',
        description: behaviorErrors.join(' '),
        variant: 'destructive',
      });
      return;
    }

    setIsSavingPersona(true);
    try {
      const savedPersona = await savePersonaRecordOnly(
        {
          updatePersona: personaService.updatePersona.bind(personaService),
          getCaseAllData: caseService.getCaseAllData.bind(caseService),
        },
        caseId,
        caseData.persona,
      );
      setCaseData(prev => ({ ...prev, persona: savedPersona }));
      setPersonaV2JsonValidity({});
      toast({
        title: 'Persona saved',
        description: 'Voice, behavior, and persona fields were saved without changing case or evaluation fields.',
      });
    } catch (error: any) {
      console.error('Failed to save persona only:', error);
      toast({
        title: 'Persona save failed',
        description: error?.message || 'The persona could not be saved.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPersona(false);
    }
  };

  const handleSaveCase = async () => {
    // Validate required fields
    if (!caseData.evaluationPromptId) {
      toast({
        title: t('userProfile.toasts.error'),
        description: 'Please select an Instruction for AI',
        variant: 'destructive'
      });
      return;
    }

    if (!caseData.finalEvaluationPromptId) {
      toast({
        title: t('userProfile.toasts.error'),
        description: 'Please select a Final Evaluation Instruction for AI',
        variant: 'destructive'
      });
      return;
    }

    const behaviorErrors = validatePersonaBehaviorConfig();
    if (behaviorErrors.length > 0) {
      toast({
        title: 'Review the V2 persona profile',
        description: behaviorErrors.join(' '),
        variant: 'destructive',
      });
      setActiveTab('persona');
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && caseId) {
        // Update existing case and persona
        const caseUpdate = trainingCaseToCaseUpdate(caseData);
        await caseService.updateCase(caseId, caseUpdate);

        // Update persona if it exists
        if (caseData.persona?.id) {
          const personaUpdate = mockPersonaToPersonaUpdate(caseData.persona);
          // Add case_id which is required for persona updates
          personaUpdate.case_id = caseId;
          console.log('Updating case with data:', caseUpdate);
          console.log('Updating persona with data:', personaUpdate);
          await personaService.updatePersona(caseData.persona.id, personaUpdate);
        } else if (caseData.persona) {
          // Create new persona if it doesn't exist
          const personaCreate = mockPersonaToPersonaCreate(caseData.persona, caseId);
          console.log('Creating persona with data:', personaCreate);
          await personaService.createPersona(personaCreate);
        }

        // Reload the case data to show updated values
        const updatedCaseAllData = await caseService.getCaseAllData(caseId);

        // Check if we need to save evaluation prompts that were edited in UI
        const evaluationPromptFromAPI = updatedCaseAllData.evaluation_prompt;
        if (evaluationPromptFromAPI && currentEvaluationPrompt && 
            (editedEvaluationPromptName.trim() !== currentEvaluationPrompt.name ||
             editedEvaluationPrompt.trim() !== currentEvaluationPrompt.main_prompt ||
             JSON.stringify(editedCategoriesPrompts) !== JSON.stringify(currentEvaluationPrompt.categories_prompts) ||
             editedIsDraft !== currentEvaluationPrompt.is_draft)) {
          
          console.log('Saving evaluation prompt changes...');
          try {
            const updated = await evaluationPromptService.updateEvaluationPrompt(currentEvaluationPrompt.id, {
              name: editedEvaluationPromptName,
              main_prompt: editedEvaluationPrompt,
              categories_prompts: editedCategoriesPrompts,
              is_draft: editedIsDraft
            });

            setCurrentEvaluationPrompt(updated);
            console.log('Evaluation prompt saved successfully');
          } catch (error: any) {
            console.error('Failed to save evaluation prompt:', error);
            throw new Error('Failed to save evaluation prompt: ' + error.message);
          }
        }

        const finalEvaluationPromptFromAPI = updatedCaseAllData.final_evaluation_prompt;
        if (finalEvaluationPromptFromAPI && finalEvaluationPrompt && 
            (editedFinalPromptName.trim() !== finalEvaluationPrompt.name ||
             editedFinalPrompt.trim() !== finalEvaluationPrompt.prompt ||
             editedFinalIsDraft !== finalEvaluationPrompt.is_draft)) {
          
          console.log('Saving final evaluation prompt changes...');
          try {
            const updated = await evaluationPromptService.updateFinalEvaluationPrompt(finalEvaluationPrompt.id, {
              name: editedFinalPromptName,
              prompt: editedFinalPrompt,
              is_draft: editedFinalIsDraft
            });

            setFinalEvaluationPrompt(updated);
            console.log('Final evaluation prompt saved successfully');
          } catch (error: any) {
            console.error('Failed to save final evaluation prompt:', error);
            throw new Error('Failed to save final evaluation prompt: ' + error.message);
          }
        }
        const updatedTrainingCase = apiToTrainingCase(updatedCaseAllData);
        setCaseData(updatedTrainingCase);

        toast({
          title: t('userProfile.toasts.success'),
          description: t('caseEditor.toasts.caseUpdated')
        });
      } else {
        // Create new case. The backend requires exactly one persona per case,
        // so a case without a persona is unstartable — never create one.
        if (!caseData.persona) {
          throw new Error('Cannot create a case without a persona');
        }

        const caseCreate = trainingCaseToCaseCreate(caseData);
        const newCase = await caseService.createCase(caseCreate);

        try {
          const personaCreate = mockPersonaToPersonaCreate(caseData.persona, newCase.id);
          await personaService.createPersona(personaCreate);
        } catch (personaError) {
          // Roll back the just-created case so a failed persona step can't leave
          // an orphan case that 500s on start and 404s in the editor.
          try {
            await caseService.deleteCase(newCase.id);
          } catch (cleanupError) {
            console.error('Failed to roll back orphaned case after persona error:', cleanupError);
          }
          throw personaError;
        }

        toast({
          title: t('userProfile.toasts.success'),
          description: t('caseEditor.toasts.caseCreated')
        });

        // Navigate to edit mode for the newly created case
        navigate(`/admin-dashboard/case-management/editor/${newCase.id}`);
      }
    } catch (error: any) {
      console.error('Failed to save case:', error);
      toast({
        title: t('userProfile.toasts.error'),
        description: error.message || t('caseEditor.toasts.saveError'),
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateVoicePreview = async () => {
    if (isGeneratingVoicePreview) {
      return;
    }

    const voiceValue = caseData.persona?.voice || VOICE_OPTIONS[0]?.value || '';
    const textToPreview = (voicePreviewText || '').trim() || defaultVoiceSampleRef.current || defaultVoiceSample;

    if (!voiceValue) {
      toast({
        title: t('userProfile.toasts.error'),
        description: t('caseEditor.persona.voiceSampleError'),
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingVoicePreview(true);

    try {
      const response = await apiClient.post<{ event: string; data: VoicePreviewResponse }>(
        '/simulation/text-to-audio',
        {
          voice: voiceValue,
          text: textToPreview,
        }
      );

      const audioUrl = response.data?.audio_url;

      if (!audioUrl) {
        throw new Error(t('caseEditor.persona.voiceSampleError'));
      }

      setVoicePreviewAudioUrl(audioUrl);
    } catch (error: any) {
      console.error('Failed to generate voice preview:', error);
      toast({
        title: t('userProfile.toasts.error'),
        description: error?.message || t('caseEditor.persona.voiceSampleError'),
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingVoicePreview(false);
    }
  };

  // Save only persona (used after adding/updating emotions to persist changes immediately)
  const savePersonaAfterEmotionChange = async () => {
    // Only save if we're editing an existing case and persona exists with an ID
    if (!isEditing || !caseId || !caseData.persona?.id) {
      console.log('Cannot save persona: not editing or persona has no ID yet');
      return;
    }

    try {
      const personaUpdate = mockPersonaToPersonaUpdate(caseData.persona);
      personaUpdate.case_id = caseId;
      console.log('Saving persona after emotion change:', personaUpdate);
      await personaService.updatePersona(caseData.persona.id, personaUpdate);

      // Reload the case data to get fresh URLs
      const updatedCaseAllData = await caseService.getCaseAllData(caseId);
      const updatedTrainingCase = apiToTrainingCase(updatedCaseAllData);
      setCaseData(updatedTrainingCase);

      console.log('Persona saved successfully');
    } catch (error) {
      console.error('Failed to save persona:', error);
      toast({
        title: t('userProfile.toasts.error'),
        description: 'Failed to save persona changes',
        variant: 'destructive',
      });
    }
  };

  const uploadEmotionImage = async (file: File): Promise<{ path: string; url: string } | undefined> => {
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post<{ data: { image_path: string; image_url: string } }>(
        '/personas/upload-emotion-image',
        formData
      );

      // image_path - for storage in DB (format: "bucket:object_name")
      // image_url - temporary URL for preview
      const imagePath = response.data.image_path;
      const imageUrl = response.data.image_url;

      // Fix the URL to use localhost instead of internal container name
      const fixedUrl = imageUrl.replace('minio:9000', 'localhost:9000');

      return { path: imagePath, url: fixedUrl };
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast({
        title: t('userProfile.toasts.error'),
        description: t('caseEditor.toast.uploadError'),
        variant: 'destructive',
      });
      return undefined;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const revokeCropPreview = (url: string | null) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  };

  const openCropperForFile = (file: File, target: { type: 'newEmotion' | 'existingEmotion'; index?: number }) => {
    revokeCropPreview(cropImageSrc);
    const previewUrl = URL.createObjectURL(file);
    setCropImageSrc(previewUrl);
    setCropFileName(file.name || 'image.jpg');
    setCropFileType(file.type || 'image/jpeg');
    setCropTarget(target);
    setCropperOpen(true);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const closeCropper = () => {
    revokeCropPreview(cropImageSrc);
    setCropImageSrc(null);
    setCropTarget(null);
    setCropperOpen(false);
  };

  const getCroppedBlob = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = new Image();
    image.src = imageSrc;
    image.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas not supported');
    }

    const cropWidth = Math.max(1, Math.round(pixelCrop.width));
    const cropHeight = Math.max(1, Math.round(pixelCrop.height));
    const cropX = Math.round(pixelCrop.x);
    const cropY = Math.round(pixelCrop.y);

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to crop image'));
        }
      }, cropFileType?.includes('png') ? 'image/png' : 'image/jpeg', 0.9);
    });
  };

  const handleCropConfirm = async () => {
    if (!cropImageSrc || !croppedAreaPixels) {
      return;
    }
    try {
      const blob = await getCroppedBlob(cropImageSrc, croppedAreaPixels);
      const extension = cropFileType.includes('png') ? 'png' : 'jpg';
      const finalName = cropFileName || `image.${extension}`;
      const croppedFile = new File([blob], finalName, { type: blob.type || cropFileType });

      const uploaded = await uploadEmotionImage(croppedFile);
      if (!uploaded) return;

      if (cropTarget?.type === 'newEmotion') {
        setNewEmotion(prev => ({
          ...prev,
          imageUrl: uploaded.url,
          imagePath: uploaded.path as any
        }));
        setSelectedFileName(finalName);
      } else if (cropTarget?.type === 'existingEmotion' && typeof cropTarget.index === 'number') {
        const updatedEmotions = caseData.persona?.emotions?.map((em, idx) => {
          if (idx === cropTarget.index) {
            if (typeof em === 'string') {
              return {
                id: `emotion-${idx}`,
                name: em,
                description: '',
                imageUrl: uploaded.url,
                imagePath: uploaded.path as any
              };
            }
            return {
              ...em,
              imageUrl: uploaded.url,
              imagePath: uploaded.path as any
            };
          }
          return em;
        }) || [];

        const updatedPersona = {
          ...caseData.persona!,
          emotions: updatedEmotions
        };

        setCaseData(prev => ({
          ...prev,
          persona: updatedPersona
        }));

        if (isEditing && caseId && caseData.persona?.id) {
          try {
            const personaUpdate = mockPersonaToPersonaUpdate(updatedPersona);
            personaUpdate.case_id = caseId;
            console.log('Saving persona with cropped emotion image:', personaUpdate);
            await personaService.updatePersona(caseData.persona.id, personaUpdate);

            const updatedCaseAllData = await caseService.getCaseAllData(caseId);
            const updatedTrainingCase = apiToTrainingCase(updatedCaseAllData);
            setCaseData(updatedTrainingCase);
          } catch (error) {
            console.error('Failed to save persona:', error);
            toast({
              title: t('userProfile.toasts.error'),
              description: 'Failed to save emotion image. Please try again.',
              variant: 'destructive',
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to crop image:', error);
      toast({
        title: t('userProfile.toasts.error'),
        description: t('caseEditor.toast.cropError'),
        variant: 'destructive'
      });
    } finally {
      closeCropper();
    }
  };

  const addEmotion = async () => {
    if (!newEmotion.name || !newEmotion.description) {
      toast({
        title: t('userProfile.toasts.error'),
        description: t('caseEditor.persona.emotions.validationError'),
        variant: 'destructive'
      });
      return;
    }

    const emotion: PersonaEmotion = {
      id: Date.now().toString(),
      name: newEmotion.name,
      description: newEmotion.description,
      // Use imagePath if available (for saving to DB), otherwise imageUrl
      imageUrl: (newEmotion as any).imagePath || newEmotion.imageUrl
    };

    // Update local state
    const updatedPersona = {
      ...caseData.persona!,
      emotions: [...(caseData.persona?.emotions || []), emotion]
    };

    setCaseData(prev => ({
      ...prev,
      persona: updatedPersona
    }));

    // Save to backend immediately if editing existing case
    if (isEditing && caseId && caseData.persona?.id) {
      try {
        const personaUpdate = mockPersonaToPersonaUpdate(updatedPersona);
        personaUpdate.case_id = caseId;
        console.log('Saving persona with new emotion:', personaUpdate);
        await personaService.updatePersona(caseData.persona.id, personaUpdate);

        // Reload to get fresh URLs
        const updatedCaseAllData = await caseService.getCaseAllData(caseId);
        const updatedTrainingCase = apiToTrainingCase(updatedCaseAllData);
        setCaseData(updatedTrainingCase);

        console.log('Persona saved successfully after adding emotion');
      } catch (error) {
        console.error('Failed to save persona:', error);
        toast({
          title: t('userProfile.toasts.error'),
          description: 'Failed to save emotion. Please try again.',
          variant: 'destructive',
        });
      }
    }

    setNewEmotion({ name: '', description: '' });
    setSelectedFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowAddEmotion(false);
  };

  const addAction = () => {
    if (!newAction.name || !newAction.description) {
      toast({
        title: t('userProfile.toasts.error'),
        description: t('caseEditor.basic.userActions.validationError'),
        variant: 'destructive'
      });
      return;
    }
    
    const action: PersonaAction = {
      id: Date.now().toString(),
      name: newAction.name,
      description: newAction.description,
      shortDescription: newAction.shortDescription || '',
      chatMessage: newAction.chatMessage || '',
      popupText: newAction.popupText || ''
    };

    setCaseData(prev => ({
      ...prev,
      persona: {
        ...prev.persona!,
        actions: [...(prev.persona?.actions || []), action]
      }
    }));

    setNewAction({ name: '', description: '', shortDescription: '', chatMessage: '', popupText: '' });
    setShowAddAction(false);
  };

  const updateAction = () => {
    if (!editingAction?.name || !editingAction.description) {
      toast({
        title: t('userProfile.toasts.error'),
        description: t('caseEditor.basic.userActions.validationError'),
        variant: 'destructive'
      });
      return;
    }

    setCaseData(prev => ({
      ...prev,
      persona: {
        ...prev.persona!,
        actions: prev.persona?.actions?.map(a =>
          a.id === editingAction.id
            ? { ...editingAction, id: a.id }
            : a
        ) || []
      }
    }));

    setEditingAction(null);
    
    toast({
      title: t('userProfile.toasts.success'),
      description: t('caseEditor.basic.userActions.updateSuccess', 'Action updated successfully')
    });
  };

  const addReaction = () => {
    if (!newReaction.name || !newReaction.prompt) {
      toast({
        title: t('userProfile.toasts.error'),
        description: t('caseEditor.persona.reactions.validationError'),
        variant: 'destructive'
      });
      return;
    }
  
    const reaction = {
      id: Date.now().toString(),
      name: newReaction.name,
      description: newReaction.description,
      prompt: newReaction.prompt,
      selectionLogic: newReaction.selectionLogic,
      goals: newReaction.goals // добавить
    };
  
    setCaseData(prev => ({
      ...prev,
      persona: {
        ...prev.persona!,
        reactions: [...(prev.persona?.reactions || []), reaction]
      }
    }));
  
    setNewReaction({ 
      name: '', 
      description: '', 
      prompt: '', 
      selectionLogic: '',
      goals: '' // TODO
    });
    setShowAddReaction(false);
  };

  const addEvaluation = () => {
  if (!newEvaluation.name || !newEvaluation.description || !newEvaluation.instruction) {
      toast({
        title: t('userProfile.toasts.error'),
        description: t('caseEditor.evaluation.validationErrorFull'),
        variant: 'destructive'
      });
      return;
    }
    
    const evaluation: EvaluationCategory = {
      id: Date.now().toString(),
      name: newEvaluation.name,
      description: newEvaluation.description || ''
    };

    setCaseData(prev => ({
      ...prev,
      evaluationCategories: [...(prev.evaluationCategories || []), evaluation]
    }));

    // Also add the new category to editedCategoriesPrompts with the prompt from popup
    setEditedCategoriesPrompts(prev => ({
      ...prev,
      [evaluation.name]: newEvaluation.instruction || ''
    }));

    setNewEvaluation({ name: '', description: '', instruction: '' });
    setShowAddEvaluation(false);
  };

  const updateEvaluation = () => {
    if (!editingEvaluation?.name || !editingEvaluation.description || !editingEvaluation.instruction) {
      toast({
        title: t('userProfile.toasts.error'),
        description: t('caseEditor.evaluation.validationErrorFull'),
        variant: 'destructive'
      });
      return;
    }

    // Update in caseData.evaluationCategories
    setCaseData(prev => ({
      ...prev,
      evaluationCategories: prev.evaluationCategories?.map(cat => 
        cat.id === editingEvaluation.id 
          ? { id: cat.id, name: editingEvaluation.name, description: editingEvaluation.description }
          : cat
      ) || []
    }));

    // Update in editedCategoriesPrompts (handle name change)
    setEditedCategoriesPrompts(prev => {
      const updated = { ...prev };
      
      // Find the old category name
      const oldCategory = caseData.evaluationCategories?.find(cat => cat.id === editingEvaluation.id);
      if (oldCategory && oldCategory.name !== editingEvaluation.name) {
        // Remove old name entry
        delete updated[oldCategory.name];
      }
      
      // Add/update with new name and prompt
      updated[editingEvaluation.name] = editingEvaluation.instruction || '';
      
      return updated;
    });

    setEditingEvaluation(null);
  };

  const removeEmotion = (emotionId: string) => {
    setCaseData(prev => ({
      ...prev,
      persona: {
        ...prev.persona!,
        emotions: prev.persona?.emotions?.filter((e, idx) => {
          // Handle both old format (string) and new format (object)
          const id = typeof e === 'string' ? idx.toString() : (e.id || idx.toString());
          return id !== emotionId;
        }) || []
      }
    }));
  };

  const removeAction = (actionId: string) => {
    setCaseData(prev => ({
      ...prev,
      persona: {
        ...prev.persona!,
        actions: prev.persona?.actions?.filter(a => a.id !== actionId) || []
      }
    }));
  };

  const removeReaction = (reactionId: string) => {
    setCaseData(prev => ({
      ...prev,
      persona: {
        ...prev.persona!,
        reactions: prev.persona?.reactions?.filter(r => r.id !== reactionId) || []
      }
    }));
  };

  const removeEvaluation = (evaluationId: string) => {
    // Find the category name before removing it
    const categoryToRemove = caseData.evaluationCategories?.find(e => e.id === evaluationId);
    const categoryName = categoryToRemove?.name;
    
    setCaseData(prev => ({
      ...prev,
      evaluationCategories: prev.evaluationCategories?.filter(e => e.id !== evaluationId) || []
    }));

    // Also remove from editedCategoriesPrompts if it exists
    if (categoryName) {
      setEditedCategoriesPrompts(prev => {
        const { [categoryName]: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const getMockEvaluationPrompt = () => {
    // Use real data from currentEvaluationPrompt if available
    if (currentEvaluationPrompt) {
      return {
        name: currentEvaluationPrompt.name,
        main_prompt: currentEvaluationPrompt.main_prompt,
        categories_prompts: currentEvaluationPrompt.categories_prompts || {}
      };
    }
    
    // Fallback to selected prompt name if currentEvaluationPrompt is not loaded yet
    const selectedPrompt = evaluationPrompts.find(p => p.id === caseData.evaluationPromptId);
    return {
      name: selectedPrompt?.name || 'Evaluation Prompt',
      main_prompt: 'Loading...',
      categories_prompts: {}
    };
  };

  const getMockFinalEvaluationPrompt = () => {
    // Use real data from finalEvaluationPrompt if available
    if (finalEvaluationPrompt) {
      return {
        name: finalEvaluationPrompt.name,
        prompt: finalEvaluationPrompt.prompt
      };
    }
    
    // Fallback to selected prompt name if finalEvaluationPrompt is not loaded yet
    const selectedPrompt = finalEvaluationPrompts.find(p => p.id === caseData.finalEvaluationPromptId);
    return {
      name: selectedPrompt?.name || 'Final Evaluation Prompt',
      prompt: 'Loading...'
    };
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('userProfile.loading')}</p>
        </div>
      </div>
    );
  }

  const testButtonLabel = t(isDraftCase ? 'caseEditor.testDraft' : 'caseEditor.testCase');
  const saveButtonLabel = t(isDraftCase ? 'caseEditor.saveDraft' : 'caseEditor.saveCase');

  const handleValidateCase = async () => {
    if (!caseId) return;
    setIsValidating(true);
    try {
      const resp = await apiClient.get<{ data: CaseAuditResult }>(`/cases/${caseId}/validate`);
      setValidation({ open: true, result: resp.data });
    } catch (error) {
      toast({
        title: t('caseEditor.validate.error'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin-dashboard/case-management')}
            disabled={isSaving}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('caseEditor.back')}
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span className="truncate">{isEditing ? t('caseEditor.title.edit') : t('caseEditor.title.create')}</span>
              {isDraftCase && (
                <Badge variant="outline" className="text-xs sm:text-sm font-normal flex-shrink-0">
                  {t('caseEditor.draftCopy')}
                </Badge>
              )}
            </h1>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            disabled={isSaving || isApplyingDraft || !caseId}
            onClick={() => {
              if (caseId && caseData.title) {
                setAITestModal({ isOpen: true, caseId: caseId, caseTitle: caseData.title });
              }
            }}
          >
            <TestTube2 className="w-4 h-4 mr-2" />
            {testButtonLabel}
          </Button>
          <Button
            variant="outline"
            disabled={isSaving || isApplyingDraft || isValidating || !caseId}
            onClick={handleValidateCase}
          >
            {isValidating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4 mr-2" />
            )}
            {t('caseEditor.validate.button')}
          </Button>
          {isDraftCase && (
            <Button
              onClick={handleApplyDraftClick}
              disabled={isSaving || isApplyingDraft}
              className="bg-success hover:bg-success/90 w-full sm:w-auto"
            >
              {isApplyingDraft ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('caseEditor.applying')}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {t('caseEditor.applyDraft')}
                </>
              )}
            </Button>
          )}
          <Button onClick={handleSaveCase} disabled={isSaving || isSavingPersona || isApplyingDraft} className="w-full sm:w-auto">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('caseEditor.saving')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {saveButtonLabel}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${isDraftCase ? 'lg:grid-cols-3' : ''}`}>
        {/* Main content - Case editing */}
        <div className={isDraftCase ? 'lg:col-span-2' : ''}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 h-auto">
              <TabsTrigger value="basic" className="text-xs sm:text-sm py-2">{t('caseEditor.tabs.basic')}</TabsTrigger>
              <TabsTrigger value="persona" className="text-xs sm:text-sm py-2">{t('caseEditor.tabs.persona')}</TabsTrigger>
              <TabsTrigger value="evaluation" className="text-xs sm:text-sm py-2">{t('caseEditor.tabs.evaluation')}</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle>{t('caseEditor.basic.title')}</CardTitle>
                  <CardDescription>
                    {t('caseEditor.basic.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">{t('caseEditor.basic.caseTitle')}</Label>
                    <MultiLocaleField
                      kind="input"
                      id="title"
                      combined={caseData.title || ''}
                      onChangeCombined={(value) => setCaseData(prev => ({ ...prev, title: value }))}
                      placeholder={t('caseEditor.basic.caseTitlePlaceholder')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="userDescription">{t('caseEditor.basic.userDescription')}</Label>
                    <Textarea
                      id="userDescription"
                      value={caseData.userDescription || ''}
                      onChange={(e) => setCaseData(prev => ({ ...prev, userDescription: e.target.value }))}
                      placeholder={t('caseEditor.basic.userDescriptionPlaceholder')}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('caseEditor.basic.userDescriptionHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('caseEditor.basic.roleInSimulation')}</Label>
                    <MultiLocaleField
                      kind="rich"
                      combined={caseData.roleInSimulation || ''}
                      onChangeCombined={(value) => setCaseData(prev => ({ ...prev, roleInSimulation: value }))}
                      placeholder={t('caseEditor.basic.roleInSimulationPlaceholder')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('caseEditor.basic.roleInSimulationHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('caseEditor.basic.personaDescription')}</Label>
                    <MultiLocaleField
                      kind="rich"
                      combined={caseData.personaDescription || ''}
                      onChangeCombined={(value) => setCaseData(prev => ({ ...prev, personaDescription: value }))}
                      placeholder={t('caseEditor.basic.personaDescriptionPlaceholder')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('caseEditor.basic.personaDescriptionHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('caseEditor.basic.caseOverview')}</Label>
                    <MultiLocaleField
                      kind="rich"
                      combined={caseData.caseOverview || ''}
                      onChangeCombined={(value) => setCaseData(prev => ({ ...prev, caseOverview: value }))}
                      placeholder={t('caseEditor.basic.caseOverviewPlaceholder')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('caseEditor.basic.caseOverviewHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="aiDescription">{t('caseEditor.basic.aiDescription')}</Label>
                    <Textarea
                      id="aiDescription"
                      value={caseData.aiDescription || ''}
                      onChange={(e) => setCaseData(prev => ({ ...prev, aiDescription: e.target.value }))}
                      placeholder={t('caseEditor.basic.aiDescriptionPlaceholder')}
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('caseEditor.basic.aiDescriptionHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scenarioBehaviorRulesCoarse">
                      {t('caseEditor.basic.scenarioBehaviorRulesCoarse')}
                    </Label>
                    <Textarea
                      id="scenarioBehaviorRulesCoarse"
                      value={caseData.scenario_behavior_rules_coarse || ''}
                      onChange={(e) => setCaseData(prev => ({ 
                        ...prev, 
                        scenario_behavior_rules_coarse: e.target.value 
                      }))}
                      placeholder={t('caseEditor.basic.scenarioBehaviorRulesCoarsePlaceholder')}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('caseEditor.basic.scenarioBehaviorRulesCoarseHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scenarioBehaviorRulesFull">
                      {t('caseEditor.basic.scenarioBehaviorRulesFull')}
                    </Label>
                    <Textarea
                      id="scenarioBehaviorRulesFull"
                      value={caseData.scenario_behavior_rules_full || ''}
                      onChange={(e) => setCaseData(prev => ({ 
                        ...prev, 
                        scenario_behavior_rules_full: e.target.value 
                      }))}
                      placeholder={t('caseEditor.basic.scenarioBehaviorRulesFullPlaceholder')}
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('caseEditor.basic.scenarioBehaviorRulesFullHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="simulationNavigation">
                      {t('caseEditor.basic.simulationNavigation')}
                    </Label>
                    <MultiLocaleField
                      kind="textarea"
                      id="simulationNavigation"
                      combined={caseData.simulation_navigation || ''}
                      onChangeCombined={(value) => setCaseData(prev => ({
                        ...prev,
                        simulation_navigation: value
                      }))}
                      placeholder={t('caseEditor.basic.simulationNavigationPlaceholder')}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('caseEditor.basic.simulationNavigationHint')}
                    </p>
                  </div>

                  {/* Brief items — populates the right-panel "Your brief" box during simulation. */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t('caseEditor.basic.briefItems.title')}</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t('caseEditor.basic.briefItems.hint')}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCaseData(prev => ({
                          ...prev,
                          briefItems: [...(prev.briefItems || []), { label: '', value: '' }]
                        }))}
                      >
                        + {t('caseEditor.basic.briefItems.add')}
                      </Button>
                    </div>
                    {(caseData.briefItems || []).map((item, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <Input
                          placeholder={t('caseEditor.basic.briefItems.labelPlaceholder')}
                          value={item.label}
                          onChange={(e) => setCaseData(prev => {
                            const next = [...(prev.briefItems || [])];
                            next[i] = { ...next[i], label: e.target.value };
                            return { ...prev, briefItems: next };
                          })}
                          className="flex-1"
                        />
                        <Input
                          placeholder={t('caseEditor.basic.briefItems.valuePlaceholder')}
                          value={item.value}
                          onChange={(e) => setCaseData(prev => {
                            const next = [...(prev.briefItems || [])];
                            next[i] = { ...next[i], value: e.target.value };
                            return { ...prev, briefItems: next };
                          })}
                          className="w-40"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCaseData(prev => ({
                            ...prev,
                            briefItems: (prev.briefItems || []).filter((_, idx) => idx !== i)
                          }))}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Phases — populates the right-panel Progress widget. reactionIds
                      lists the persona.reactions[*].name values that belong to each phase. */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t('caseEditor.basic.phases.title')}</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t('caseEditor.basic.phases.hint')}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCaseData(prev => ({
                          ...prev,
                          phases: [...(prev.phases || []), { id: '', name: '', reactionIds: [] }]
                        }))}
                      >
                        + {t('caseEditor.basic.phases.add')}
                      </Button>
                    </div>
                    {(caseData.phases || []).map((phase, i) => {
                      const reactionsList = caseData.persona?.reactions || [];
                      return (
                        <div key={i} className="rounded-md border p-3 space-y-2">
                          <div className="flex gap-2 items-start">
                            <Input
                              placeholder={t('caseEditor.basic.phases.idPlaceholder')}
                              value={phase.id}
                              onChange={(e) => setCaseData(prev => {
                                const next = [...(prev.phases || [])];
                                next[i] = { ...next[i], id: e.target.value };
                                return { ...prev, phases: next };
                              })}
                              className="w-32"
                            />
                            <Input
                              placeholder={t('caseEditor.basic.phases.namePlaceholder')}
                              value={phase.name}
                              onChange={(e) => setCaseData(prev => {
                                const next = [...(prev.phases || [])];
                                next[i] = { ...next[i], name: e.target.value };
                                return { ...prev, phases: next };
                              })}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setCaseData(prev => ({
                                ...prev,
                                phases: (prev.phases || []).filter((_, idx) => idx !== i)
                              }))}
                            >
                              ×
                            </Button>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1.5">
                              {t('caseEditor.basic.phases.reactionsLabel')}
                            </p>
                            {reactionsList.length === 0 ? (
                              <p className="text-xs italic text-muted-foreground">
                                {t('caseEditor.basic.phases.noReactions')}
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {reactionsList.map(r => {
                                  const isSelected = (phase.reactionIds || []).includes(r.name);
                                  return (
                                    <button
                                      key={r.id}
                                      type="button"
                                      onClick={() => setCaseData(prev => {
                                        const next = [...(prev.phases || [])];
                                        const current = next[i].reactionIds || [];
                                        next[i] = {
                                          ...next[i],
                                          reactionIds: isSelected
                                            ? current.filter(n => n !== r.name)
                                            : [...current, r.name]
                                        };
                                        return { ...prev, phases: next };
                                      })}
                                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                        isSelected
                                          ? 'bg-primary text-primary-foreground border-primary'
                                          : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                                      }`}
                                    >
                                      {r.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* LLM Models Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="llm1Model">{t('caseEditor.basic.llm1Model')}</Label>
                      <Select
                        value={caseData.llm1ModelName || AI_MODELS.DEFAULT}
                        onValueChange={(value) => setCaseData(prev => ({
                          ...prev,
                          llm1ModelName: value
                        }))}
                      >
                        <SelectTrigger id="llm1Model">
                          <SelectValue placeholder={t('caseEditor.basic.selectAIModel')} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <TooltipProvider>
                            {MODEL_GROUPS.map((group) => (
                              <React.Fragment key={group.label}>
                                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                  {getModelCategoryLabel(group.label)}
                                </div>
                                {group.models.map((model) => (
                                  <SelectItem key={model.value} value={model.value}>
                                    <div className="flex items-center justify-between w-full">
                                      <span>{model.label}</span>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={(e) => e.stopPropagation()}
                                            className="ml-2 p-0.5 hover:bg-muted rounded"
                                            onMouseDown={(e) => e.preventDefault()}
                                          >
                                            <Info className="w-3.5 h-3.5 text-muted-foreground" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-xs">
                                          <p>{getModelDescription(model.value, model.description)}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </SelectItem>
                                ))}
                              </React.Fragment>
                            ))}
                          </TooltipProvider>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {t('caseEditor.basic.llm1ModelHint')}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="llm2Model">{t('caseEditor.basic.llm2Model')}</Label>
                      <Select
                        value={caseData.llm2ModelName || AI_MODELS.DEFAULT}
                        onValueChange={(value) => setCaseData(prev => ({
                          ...prev,
                          llm2ModelName: value
                        }))}
                      >
                        <SelectTrigger id="llm2Model">
                          <SelectValue placeholder={t('caseEditor.basic.selectAIModel')} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <TooltipProvider>
                            {MODEL_GROUPS.map((group) => (
                              <React.Fragment key={group.label}>
                                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                  {getModelCategoryLabel(group.label)}
                                </div>
                                {group.models.map((model) => (
                                  <SelectItem key={model.value} value={model.value}>
                                    <div className="flex items-center justify-between w-full">
                                      <span>{model.label}</span>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={(e) => e.stopPropagation()}
                                            className="ml-2 p-0.5 hover:bg-muted rounded"
                                            onMouseDown={(e) => e.preventDefault()}
                                          >
                                            <Info className="w-3.5 h-3.5 text-muted-foreground" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-xs">
                                          <p>{getModelDescription(model.value, model.description)}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </SelectItem>
                                ))}
                              </React.Fragment>
                            ))}
                          </TooltipProvider>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {t('caseEditor.basic.llm2ModelHint')}
                      </p>
                    </div>
                  </div>

                  {/* User Actions Section */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <Label>{t('caseEditor.basic.userActions.title')}</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('caseEditor.basic.userActions.helper')}
                        </p>
                      </div>
                      <Dialog open={showAddAction} onOpenChange={setShowAddAction}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Plus className="w-4 h-4 mr-2" />
                            {t('caseEditor.basic.userActions.add')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('caseEditor.basic.userActions.addTitle')}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>{t('caseEditor.basic.userActions.name')}</Label>
                              <Input
                                value={newAction.name}
                                onChange={(e) => setNewAction(prev => ({ ...prev, name: e.target.value }))}
                                placeholder={t('caseEditor.basic.userActions.namePlaceholder')}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('caseEditor.basic.userActions.descriptionLabel')}</Label>
                              <Textarea
                                value={newAction.description}
                                onChange={(e) => setNewAction(prev => ({ ...prev, description: e.target.value }))}
                                placeholder={t('caseEditor.basic.userActions.descriptionPlaceholder')}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('caseEditor.basic.userActions.shortDescriptionLabel')}</Label>
                              <Input
                                value={newAction.shortDescription || ''}
                                onChange={(e) => setNewAction(prev => ({ ...prev, shortDescription: e.target.value }))}
                                placeholder={t('caseEditor.basic.userActions.shortDescriptionPlaceholder')}
                              />
                              <p className="text-xs text-muted-foreground">
                                {t('caseEditor.basic.userActions.shortDescriptionHint')}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>{t('caseEditor.basic.userActions.chatMessageLabel')}</Label>
                              <Textarea
                                value={newAction.chatMessage || ''}
                                onChange={(e) => setNewAction(prev => ({ ...prev, chatMessage: e.target.value }))}
                                placeholder={t('caseEditor.basic.userActions.chatMessagePlaceholder')}
                              />
                              <p className="text-xs text-muted-foreground">
                                {t('caseEditor.basic.userActions.chatMessageHint')}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>{t('caseEditor.basic.userActions.popupTextLabel')}</Label>
                              <Textarea
                                value={newAction.popupText || ''}
                                onChange={(e) => setNewAction(prev => ({ ...prev, popupText: e.target.value }))}
                                placeholder={t('caseEditor.basic.userActions.popupTextPlaceholder')}
                              />
                              <p className="text-xs text-muted-foreground">
                                {t('caseEditor.basic.userActions.popupTextHint')}
                              </p>
                            </div>
                            <Button onClick={addAction} className="w-full">
                              {t('caseEditor.basic.userActions.submit')}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Edit Action Dialog */}
                    <Dialog open={!!editingAction} onOpenChange={() => setEditingAction(null)}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('caseEditor.basic.userActions.editTitle', 'Edit User Action')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>{t('caseEditor.basic.userActions.name')}</Label>
                            <Input
                              value={editingAction?.name || ''}
                              onChange={(e) => setEditingAction(prev => prev ? { ...prev, name: e.target.value } : null)}
                              placeholder={t('caseEditor.basic.userActions.namePlaceholder')}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('caseEditor.basic.userActions.descriptionLabel')}</Label>
                            <Textarea
                              value={editingAction?.description || ''}
                              onChange={(e) => setEditingAction(prev => prev ? { ...prev, description: e.target.value } : null)}
                              placeholder={t('caseEditor.basic.userActions.descriptionPlaceholder')}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('caseEditor.basic.userActions.shortDescriptionLabel')}</Label>
                            <Input
                              value={editingAction?.shortDescription || ''}
                              onChange={(e) => setEditingAction(prev => prev ? { ...prev, shortDescription: e.target.value } : null)}
                              placeholder={t('caseEditor.basic.userActions.shortDescriptionPlaceholder')}
                            />
                            <p className="text-xs text-muted-foreground">
                              {t('caseEditor.basic.userActions.shortDescriptionHint')}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>{t('caseEditor.basic.userActions.chatMessageLabel')}</Label>
                            <Textarea
                              value={editingAction?.chatMessage || ''}
                              onChange={(e) => setEditingAction(prev => prev ? { ...prev, chatMessage: e.target.value } : null)}
                              placeholder={t('caseEditor.basic.userActions.chatMessagePlaceholder')}
                            />
                            <p className="text-xs text-muted-foreground">
                              {t('caseEditor.basic.userActions.chatMessageHint')}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>{t('caseEditor.basic.userActions.popupTextLabel')}</Label>
                            <Textarea
                              value={editingAction?.popupText || ''}
                              onChange={(e) => setEditingAction(prev => prev ? { ...prev, popupText: e.target.value } : null)}
                              placeholder={t('caseEditor.basic.userActions.popupTextPlaceholder')}
                            />
                            <p className="text-xs text-muted-foreground">
                              {t('caseEditor.basic.userActions.popupTextHint')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={updateAction} className="flex-1">
                              {t('caseEditor.basic.userActions.update', 'Update Action')}
                            </Button>
                            <Button variant="outline" onClick={() => setEditingAction(null)} className="flex-1">
                              {t('caseEditor.basic.userActions.cancel', 'Cancel')}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <div className="grid gap-3">
                      {(caseData.persona?.actions || []).length > 0 ? (
                        caseData.persona?.actions?.map((action) => (
                          <div key={action.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <h4 className="font-medium">{action.name}</h4>
                              <p className="text-sm text-muted-foreground">{action.description}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingAction(action)}
                              >
                                <Settings className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeAction(action.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t('caseEditor.basic.userActions.emptyState')}
                        </p>
                      )}
                    </div>
                  </div>

                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="persona">
              <Card>
                <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <CardTitle>{t('caseEditor.persona.title')}</CardTitle>
                    <CardDescription>
                      {t('caseEditor.persona.description')}
                    </CardDescription>
                    <p className="text-xs text-muted-foreground">
                      Save persona changes here without saving case, instruction, or evaluation fields.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSavePersona}
                    disabled={isSavingPersona || isSaving || isApplyingDraft || !isEditing || !caseId || !caseData.persona?.id}
                    className="w-full shrink-0 sm:w-auto"
                  >
                    {isSavingPersona ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSavingPersona ? 'Saving persona…' : 'Save persona only'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="personaName">{t('caseEditor.persona.name')}</Label>
                      <Input
                        id="personaName"
                        value={caseData.persona?.name || ''}
                        onChange={(e) => setCaseData(prev => ({
                          ...prev,
                          persona: { ...prev.persona!, name: e.target.value }
                        }))}
                        placeholder={t('caseEditor.persona.namePlaceholder')}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="personaRole">{t('caseEditor.persona.role')}</Label>
                      <MultiLocaleField
                        kind="input"
                        id="personaRole"
                        combined={caseData.persona?.role || ''}
                        onChangeCombined={(value) => setCaseData(prev => ({
                          ...prev,
                          persona: { ...prev.persona!, role: value }
                        }))}
                        placeholder={t('caseEditor.persona.rolePlaceholder')}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="personaVoice">{t('caseEditor.persona.voice')}</Label>
                      <Select
                        value={caseData.persona?.voice || 'openai_alloy'}
                        onValueChange={(value) => setCaseData(prev => ({
                          ...prev,
                          persona: { ...prev.persona!, voice: value }
                        }))}
                      >
                        <SelectTrigger id="personaVoice">
                          <SelectValue placeholder={t('caseEditor.persona.voicePlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {VOICE_OPTIONS.map((voice) => (
                            <SelectItem key={voice.value} value={voice.value}>
                              {voice.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-4">
                      <div className="space-y-1">
                        <Label htmlFor="personaVoiceEnabled">Voice responses</Label>
                        <p className="text-xs text-muted-foreground">
                          Applies to new conversations. Keep voice enabled for audio simulations; turn it off to run a text-only evaluation without media permissions.
                        </p>
                      </div>
                      <Switch
                        id="personaVoiceEnabled"
                        checked={caseData.persona?.voice_enabled !== false}
                        onCheckedChange={(checked) => setCaseData(prev => ({
                          ...prev,
                          persona: { ...prev.persona!, voice_enabled: checked },
                        }))}
                        aria-label="Enable voice responses"
                      />
                    </div>

                    <div className="space-y-3 rounded-lg border border-dashed border-muted-foreground/40 p-4">
                      <div className="space-y-2">
                        <Label htmlFor="voiceSampleText">{t('caseEditor.persona.voiceSampleLabel')}</Label>
                        <Textarea
                          id="voiceSampleText"
                          value={voicePreviewText}
                          onChange={(e) => setVoicePreviewText(e.target.value)}
                          placeholder={t('caseEditor.persona.voiceSamplePlaceholder')}
                          rows={3}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('caseEditor.persona.voiceSampleHint')}
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button
                          type="button"
                          onClick={handleGenerateVoicePreview}
                          disabled={isGeneratingVoicePreview || caseData.persona?.voice_enabled === false}
                          className="sm:w-auto"
                        >
                          {isGeneratingVoicePreview ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Volume2 className="mr-2 h-4 w-4" />
                          )}
                          {isGeneratingVoicePreview
                            ? t('caseEditor.persona.voiceSampleGenerating')
                            : t('caseEditor.persona.voiceSampleButton')}
                        </Button>
                        {voicePreviewAudioUrl && (
                          <AudioPlayer
                            audioUrl={voicePreviewAudioUrl}
                            text={voicePreviewText.trim() || defaultVoiceSampleRef.current || defaultVoiceSample}
                            className="w-full sm:max-w-md"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                    <div className="space-y-1">
                      <Label htmlFor="personaBehaviorMode">Behavior engine</Label>
                      <p className="text-xs text-muted-foreground">
                        Legacy personas keep the existing router and talker flow. Stateful controller enables the structured V2 profile below.
                      </p>
                    </div>
                    <Select
                      value={caseData.persona?.behavior_mode || 'legacy_router_talker'}
                      onValueChange={(value) => handlePersonaBehaviorModeChange(value as PersonaBehaviorMode)}
                    >
                      <SelectTrigger id="personaBehaviorMode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="legacy_router_talker">Legacy router + talker</SelectItem>
                        <SelectItem value="stateful_controller">Stateful controller (V2)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Badge variant="outline" className="w-fit">
                      {caseData.persona?.behavior_mode === 'stateful_controller' ? 'V2 structured profile' : 'Legacy compatible'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="personaDescription">{t('caseEditor.persona.personaDescription')}</Label>
                    <Textarea
                      id="personaDescription"
                      value={caseData.persona?.description || ''}
                      onChange={(e) => setCaseData(prev => ({
                        ...prev,
                        persona: { ...prev.persona!, description: e.target.value }
                      }))}
                      placeholder={t('caseEditor.persona.personaDescriptionPlaceholder')}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="styleAndLanguage">{t('caseEditor.persona.styleAndLanguage')}</Label>
                    <Textarea
                      id="styleAndLanguage"
                      value={caseData.persona?.style_and_language || ''}
                      onChange={(e) => setCaseData(prev => ({
                        ...prev,
                        persona: { ...prev.persona!, style_and_language: e.target.value }
                      }))}
                      placeholder={t('caseEditor.persona.styleAndLanguagePlaceholder')}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="behaviorConstraints">{t('caseEditor.persona.behaviorConstraints')}</Label>
                    <Textarea
                      id="behaviorConstraints"
                      value={caseData.persona?.behavior_constraints || ''}
                      onChange={(e) => setCaseData(prev => ({
                        ...prev,
                        persona: { ...prev.persona!, behavior_constraints: e.target.value }
                      }))}
                      placeholder={t('caseEditor.persona.behaviorConstraintsPlaceholder')}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="internalReasoning">{t('caseEditor.persona.internalReasoning')}</Label>
                    <Textarea
                      id="internalReasoning"
                      value={caseData.persona?.internal_reasoning || ''}
                      onChange={(e) => setCaseData(prev => ({
                        ...prev,
                        persona: { ...prev.persona!, internal_reasoning: e.target.value }
                      }))}
                      placeholder={t('caseEditor.persona.internalReasoningPlaceholder')}
                      rows={3}
                    />
                  </div>

                  {caseData.persona?.behavior_mode === 'stateful_controller' && caseData.persona.behavior_config && (
                    <PersonaBehaviorConfigEditor
                      value={caseData.persona.behavior_config}
                      emotionNames={(caseData.persona.emotions || []).map(emotion => emotion.name).filter(Boolean)}
                      phaseNames={(caseData.persona.reactions || []).map(reaction => reaction.name).filter(Boolean)}
                      onChange={(behavior_config) => setCaseData(prev => ({
                        ...prev,
                        persona: { ...prev.persona!, behavior_config },
                      }))}
                      onJsonValidityChange={handlePersonaV2JsonValidity}
                    />
                  )}

                  {/* Emotions Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>{t('caseEditor.persona.emotions.title')}</Label>
                      <Dialog open={showAddEmotion} onOpenChange={(open) => {
                        setShowAddEmotion(open);
                        if (!open) {
                          setSelectedFileName('');
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Plus className="w-4 h-4 mr-2" />
                            {t('caseEditor.persona.emotions.add')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('caseEditor.persona.emotions.addTitle')}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>{t('caseEditor.persona.emotions.name')}</Label>
                              <Input
                                value={newEmotion.name || ''}
                                onChange={(e) => setNewEmotion(prev => ({ ...prev, name: e.target.value }))}
                                placeholder={t('caseEditor.persona.emotions.namePlaceholder')}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('caseEditor.persona.emotions.description')}</Label>
                              <Textarea
                                value={newEmotion.description || ''}
                                onChange={(e) => setNewEmotion(prev => ({ ...prev, description: e.target.value }))}
                                placeholder={t('caseEditor.persona.emotions.descriptionPlaceholder')}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('caseEditor.persona.emotions.image')}</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/*"
                                  disabled={isUploadingImage}
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setSelectedFileName(file.name);
                                      openCropperForFile(file, { type: 'newEmotion' });
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={isUploadingImage}
                                  className="flex-shrink-0"
                                >
                                  {t('caseEditor.persona.emotions.chooseFile')}
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                  {selectedFileName || t('caseEditor.persona.emotions.noFileChosen')}
                                </span>
                              </div>
                              {isUploadingImage && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  {t('caseEditor.persona.uploading')}
                                </div>
                              )}
                              {newEmotion.imageUrl && !isUploadingImage && (
                                <div className="relative w-24 h-24 border rounded overflow-hidden">
                                  <img
                                    src={newEmotion.imageUrl}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute top-1 right-1">
                                    <Check className="w-4 h-4 text-green-500 bg-white rounded-full" />
                                  </div>
                                </div>
                              )}
                            </div>
                            <Button onClick={addEmotion} className="w-full">
                              {t('caseEditor.persona.emotions.submit')}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    <div className="grid gap-3">
                      {caseData.persona?.emotions?.map((emotion, index) => {
                        // Handle both old format (string) and new format (object)
                        const emotionData = typeof emotion === 'string'
                          ? { id: index.toString(), name: emotion, description: '', imageUrl: undefined }
                          : emotion;

                        return (
                          <div key={emotionData.id || index} className="flex items-center gap-3 p-3 border rounded-lg">
                            <div className="relative w-16 h-16 border rounded overflow-hidden flex-shrink-0 group">
                              {emotionData.imageUrl ? (
                                <img
                                  src={emotionData.imageUrl}
                                  alt={emotionData.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                  {t('caseEditor.persona.noImage')}
                                </div>
                              )}
                              <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center">
                                <Upload className="w-6 h-6 text-white" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      openCropperForFile(file, { type: 'existingEmotion', index });
                                    }
                                  }}
                                />
                              </label>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium">{emotionData.name}</h4>
                              <p className="text-sm text-muted-foreground">{emotionData.description}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeEmotion(emotionData.id || index.toString())}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reactions Section */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <Label>{t('caseEditor.persona.reactions.title')}</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('caseEditor.persona.reactions.helper')}
                        </p>
                      </div>
                      <Dialog open={showAddReaction} onOpenChange={setShowAddReaction}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Plus className="w-4 h-4 mr-2" />
                            {t('caseEditor.persona.reactions.add')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('caseEditor.persona.reactions.addTitle')}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>{t('caseEditor.persona.reactionName')}</Label>
                              <Input
                                value={newReaction.name}
                                onChange={(e) => setNewReaction(prev => ({ ...prev, name: e.target.value }))}
                                placeholder={t('caseEditor.persona.reactionNamePlaceholder')}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('caseEditor.persona.reactionDescription')}</Label>
                              <Textarea
                                value={newReaction.description}
                                onChange={(e) => setNewReaction(prev => ({ ...prev, description: e.target.value }))}
                                placeholder={t('caseEditor.persona.reactionDescriptionPlaceholder')}
                                rows={2}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('caseEditor.persona.reactions.selectionLogic')}</Label>
                              <Textarea
                                value={newReaction.selectionLogic}
                                onChange={(e) => setNewReaction(prev => ({ ...prev, selectionLogic: e.target.value }))}
                                placeholder={t('caseEditor.persona.reactions.selectionLogicPlaceholder')}
                                rows={2}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('caseEditor.persona.reactionPrompt')}</Label>
                              <Textarea
                                value={newReaction.prompt}
                                onChange={(e) => setNewReaction(prev => ({ ...prev, prompt: e.target.value }))}
                                placeholder={t('caseEditor.persona.reactionPromptPlaceholder')}
                                rows={4}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('caseEditor.persona.reactions.goals')}</Label>
                              <Textarea
                                value={newReaction.goals}
                                onChange={(e) => setNewReaction(prev => ({ ...prev, goals: e.target.value }))}
                                placeholder={t('caseEditor.persona.reactions.goalsPlaceholder')}
                                rows={3}
                              />
                              <p className="text-xs text-muted-foreground">
                                {t('caseEditor.persona.reactions.goalsHint')}
                              </p>
                            </div>
                            <Button onClick={addReaction} className="w-full">
                              {t('caseEditor.persona.addReaction')}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="grid gap-3">
                      {caseData.persona?.reactions?.map((reaction) => (
                        <div key={reaction.id} className="flex items-start justify-between p-3 border rounded-lg">
                          <div className="flex-1 space-y-1">
                            <h4 className="font-medium">{reaction.name}</h4>
                            <p className="text-sm text-muted-foreground">{reaction.description}</p>
                            {reaction.goals && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold">{t('caseEditor.persona.reactions.goalsLabel')}</span> {reaction.goals}
                              </p>
                            )}
                            {reaction.selectionLogic && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold">{t('caseEditor.persona.reactions.selectionLogicLabel')}</span> {reaction.selectionLogic}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                              <span className="font-semibold">{t('caseEditor.persona.promptLabel')}</span> {reaction.prompt}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {/* Кнопка редактирования */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingReaction({
                                id: reaction.id,
                                name: reaction.name,
                                description: reaction.description,
                                prompt: reaction.prompt,
                                selectionLogic: reaction.selectionLogic || '',
                                goals: reaction.goals || ''
                              })}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            {/* Кнопка удаления */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeReaction(reaction.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evaluation">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('caseEditor.evaluation.promptSettingsTitle')}</CardTitle>
                    <CardDescription>
                      {t('caseEditor.evaluation.promptSettingsDescription')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="evaluationPrompt">
                          {t('caseEditor.basic.evaluationPrompt')} <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Select
                            value={caseData.evaluationPromptId || 'none'}
                            onValueChange={(value) => setCaseData(prev => ({
                              ...prev,
                              evaluationPromptId: value === 'none' ? null : value
                            }))}
                          >
                            <SelectTrigger id="evaluationPrompt" className={`flex-1 ${!caseData.evaluationPromptId ? 'border-red-300' : ''}`}>
                              <SelectValue placeholder={t('caseEditor.basic.evaluationPromptPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t('caseEditor.basic.noEvaluationPrompt')}</SelectItem>
                              {evaluationPrompts.map((prompt) => (
                                <SelectItem key={prompt.id} value={prompt.id}>
                                  {prompt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {caseData.evaluationPromptId && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowEvaluationPromptDialog(true)}
                              className="flex-shrink-0"
                            >
                              {t('caseEditor.evaluation.viewPrompt')}
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('caseEditor.basic.evaluationPromptPlaceholder')}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="evaluationPromptModel">{t('caseEditor.basic.evaluationModel')}</Label>
                        <Select
                          value={caseData.evaluationPromptModelName || AI_MODELS.DEFAULT}
                          onValueChange={(value) => setCaseData(prev => ({
                            ...prev,
                            evaluationPromptModelName: value
                          }))}
                        >
                          <SelectTrigger id="evaluationPromptModel">
                            <SelectValue placeholder={t('caseEditor.basic.selectAIModel')} />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <TooltipProvider>
                              {MODEL_GROUPS.map((group) => (
                                <React.Fragment key={group.label}>
                                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                    {getModelCategoryLabel(group.label)}
                                  </div>
                                  {group.models.map((model) => (
                                    <SelectItem key={model.value} value={model.value}>
                                      <div className="flex items-center justify-between w-full">
                                        <span>{model.label}</span>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              type="button"
                                              onClick={(e) => e.stopPropagation()}
                                              className="ml-2 p-0.5 hover:bg-muted rounded"
                                              onMouseDown={(e) => e.preventDefault()}
                                            >
                                              <Info className="w-3.5 h-3.5 text-muted-foreground" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="right" className="max-w-xs">
                                            <p>{getModelDescription(model.value, model.description)}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </React.Fragment>
                              ))}
                            </TooltipProvider>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {t('caseEditor.basic.aiModelForCategories')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="finalEvaluationPrompt">
                          {t('caseEditor.basic.finalEvaluationPrompt')} <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Select
                            value={caseData.finalEvaluationPromptId || 'none'}
                            onValueChange={(value) => setCaseData(prev => ({
                              ...prev,
                              finalEvaluationPromptId: value === 'none' ? null : value
                            }))}
                          >
                            <SelectTrigger id="finalEvaluationPrompt" className={`flex-1 ${!caseData.finalEvaluationPromptId ? 'border-red-300' : ''}`}>
                              <SelectValue placeholder={t('caseEditor.basic.finalEvaluationPromptPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t('caseEditor.basic.noFinalEvaluationPrompt')}</SelectItem>
                              {finalEvaluationPrompts.map((prompt) => (
                                <SelectItem key={prompt.id} value={prompt.id}>
                                  {prompt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {caseData.finalEvaluationPromptId && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowFinalEvaluationPromptDialog(true)}
                              className="flex-shrink-0"
                            >
                              {t('caseEditor.evaluation.viewPrompt')}
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('caseEditor.basic.finalEvaluationPromptPlaceholder')}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="finalEvaluationPromptModel">{t('caseEditor.basic.finalEvaluationModel')}</Label>
                        <Select
                          value={caseData.finalEvaluationPromptModelName || AI_MODELS.DEFAULT}
                          onValueChange={(value) => setCaseData(prev => ({
                            ...prev,
                            finalEvaluationPromptModelName: value
                          }))}
                        >
                          <SelectTrigger id="finalEvaluationPromptModel">
                            <SelectValue placeholder={t('caseEditor.basic.selectAIModel')} />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <TooltipProvider>
                              {MODEL_GROUPS.map((group) => (
                                <React.Fragment key={group.label}>
                                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                    {group.label}
                                  </div>
                                  {group.models.map((model) => (
                                    <SelectItem key={model.value} value={model.value}>
                                      <div className="flex items-center justify-between w-full">
                                        <span>{model.label}</span>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              type="button"
                                              onClick={(e) => e.stopPropagation()}
                                              className="ml-2 p-0.5 hover:bg-muted rounded"
                                              onMouseDown={(e) => e.preventDefault()}
                                            >
                                              <Info className="w-3.5 h-3.5 text-muted-foreground" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="right" className="max-w-xs">
                                            <p>{model.description}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </React.Fragment>
                              ))}
                            </TooltipProvider>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {t('caseEditor.basic.aiModelForFinalSummary')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t('caseEditor.evaluation.title')}</CardTitle>
                      <CardDescription>
                        {t('caseEditor.evaluation.description')}
                      </CardDescription>
                    </div>
                    <Dialog open={showAddEvaluation} onOpenChange={setShowAddEvaluation}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="w-4 h-4 mr-2" />
                          {t('caseEditor.evaluation.add')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('caseEditor.evaluation.addTitle')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>{t('caseEditor.evaluation.categoryName')}</Label>
                            <Input
                              value={newEvaluation.name}
                              onChange={(e) => setNewEvaluation(prev => ({ ...prev, name: e.target.value }))}
                              placeholder={t('caseEditor.evaluation.categoryNamePlaceholder')}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('caseEditor.evaluation.adminDescriptionLabel')}</Label>
                            <Textarea
                              value={newEvaluation.description}
                              onChange={(e) => setNewEvaluation(prev => ({ ...prev, description: e.target.value }))}
                              placeholder={t('caseEditor.evaluation.adminDescriptionPlaceholder')}
                              className="min-h-[80px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('caseEditor.evaluation.instructionLabel')}</Label>
                            <Textarea
                              value={newEvaluation.instruction}
                              onChange={(e) => setNewEvaluation(prev => ({ ...prev, instruction: e.target.value }))}
                              placeholder={t('caseEditor.evaluation.categoryInstructionPlaceholder')}
                              className="min-h-[80px]"
                            />
                          </div>
                          <Button onClick={addEvaluation} className="w-full">
                            {t('caseEditor.evaluation.submit')}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Edit Evaluation Category Dialog */}
                    <Dialog open={!!editingEvaluation} onOpenChange={() => setEditingEvaluation(null)}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Evaluation Category</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>{t('caseEditor.evaluation.nameLabel')}</Label>
                            <Input
                              value={editingEvaluation?.name || ''}
                              onChange={(e) => setEditingEvaluation(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                              placeholder={t('caseEditor.evaluation.categoryNamePlaceholder')}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('caseEditor.evaluation.adminDescriptionLabel')}</Label>
                            <Textarea
                              value={editingEvaluation?.description || ''}
                              onChange={(e) => setEditingEvaluation(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                              placeholder={t('caseEditor.evaluation.adminDescriptionPlaceholder')}
                              className="min-h-[80px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('caseEditor.evaluation.instructionLabel')}</Label>
                            <Textarea
                              value={editingEvaluation?.instruction || ''}
                              onChange={(e) => setEditingEvaluation(prev => prev ? ({ ...prev, instruction: e.target.value }) : null)}
                              placeholder={t('caseEditor.evaluation.categoryInstructionPlaceholder')}
                              className="min-h-[80px]"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={updateEvaluation} className="flex-1">
                              Save Changes
                            </Button>
                            <Button variant="outline" onClick={() => setEditingEvaluation(null)} className="flex-1">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                 <CardContent className="space-y-6">
                   {/* Evaluation Logic Container */}
                    <div>
                      <h3 className="font-semibold text-lg mb-4">{t('caseEditor.evaluation.title')}</h3>

                      {/* Evaluation Prompt Editor */}
                      {currentEvaluationPrompt || isCreatingEvaluationPrompt ? (
                        <div
                          ref={promptEditorRef}
                          className={`space-y-4 ${showEditorHighlight ? 'rounded-lg ring-2 ring-primary/60 bg-primary/5 transition-shadow duration-300' : ''}`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <h4 className="font-medium text-base">
                              {isCreatingEvaluationPrompt ? t('caseEditor.evaluation.instructionCreateTitle') : t('caseEditor.evaluation.instructionEditTitle')}
                            </h4>
                            <Badge variant={editedIsDraft ? "outline" : "default"}>
                              {editedIsDraft ? 'Draft' : 'Active'}
                            </Badge>
                          </div>
                          
                          <div className="space-y-4">
                            {/* Prompt Name */}
                            <div className="space-y-2">
                              <Label htmlFor="promptName">{t('caseEditor.evaluation.nameLabel')}</Label>
                              <Input
                                id="promptName"
                                value={editedEvaluationPromptName}
                                onChange={(e) => setEditedEvaluationPromptName(e.target.value)}
                                placeholder={t('caseEditor.evaluation.namePlaceholder')}
                              />
                            </div>

                            {/* Main Prompt */}
                            <div className="space-y-2">
                              <Label htmlFor="mainPrompt">{t('caseEditor.evaluation.instructionLabel')}</Label>
                              <Textarea
                                id="mainPrompt"
                                value={editedEvaluationPrompt}
                                onChange={(e) => setEditedEvaluationPrompt(e.target.value)}
                                rows={8}
                                className="font-mono text-sm"
                                placeholder={t('caseEditor.evaluation.instructionPlaceholder')}
                              />
                              <p className="text-sm text-muted-foreground">
                                {t('caseEditor.evaluation.instructionHint')}
                              </p>
                            </div>


                            {/* Draft Status */}
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="isDraft"
                                checked={editedIsDraft}
                                onCheckedChange={setEditedIsDraft}
                              />
                              <Label htmlFor="isDraft">{t('caseEditor.evaluation.saveAsDraftLabel')}</Label>
                              <p className="text-sm text-muted-foreground">
                                {t('caseEditor.evaluation.saveAsDraftNote')}
                              </p>
                            </div>

                            {/* Save Button for Creating New Prompt */}
                            {isCreatingEvaluationPrompt && (
                              <div className="flex gap-2">
                                <Button
                                  onClick={async () => {
                                    setIsSavingPrompt(true);
                                    try {
                                      const newPrompt = await evaluationPromptService.createEvaluationPrompt({
                                        name: editedEvaluationPromptName,
                                        main_prompt: editedEvaluationPrompt,
                                        categories_prompts: editedCategoriesPrompts,
                                        is_draft: editedIsDraft
                                      });
                                      setCurrentEvaluationPrompt(newPrompt);
                                      setEvaluationPrompts([...evaluationPrompts, { id: newPrompt.id, name: newPrompt.name }]);
                                      setCaseData(prev => ({ ...prev, evaluationPromptId: newPrompt.id }));
                                      setIsCreatingEvaluationPrompt(false);
                                      toast({
                                        title: t('userProfile.toasts.success'),
                                        description: t('caseEditor.evaluation.createSuccess')
                                      });
                                    } catch (error: any) {
                                      console.error('Failed to create instruction for AI:', error);
                                      toast({
                                        title: t('userProfile.toasts.error'),
                                        description: error.message || t('caseEditor.evaluation.createError'),
                                        variant: 'destructive'
                                      });
                                    } finally {
                                      setIsSavingPrompt(false);
                                    }
                                  }}
                                  disabled={!editedEvaluationPromptName || !editedEvaluationPrompt || isSavingPrompt}
                                >
                                  {isSavingPrompt ? 'Creating...' : t('caseEditor.evaluation.createInstructionButton')}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setIsCreatingEvaluationPrompt(false);
                                    setEditedEvaluationPromptName('');
                                    setEditedEvaluationPrompt('');
                                    setEditedCategoriesPrompts({});
                                    setEditedIsDraft(false);
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 border-2 border-dashed border-muted-foreground/25 rounded-lg text-center space-y-4">
                          <div>
                            <h4 className="font-medium text-lg mb-2">{t('caseEditor.evaluation.noInstructionTitle')}</h4>
                            <p className="text-muted-foreground text-sm mb-4">{t('caseEditor.evaluation.noInstructionDescription')}</p>
                          </div>
                          <Button
                            onClick={() => {
                              setIsCreatingEvaluationPrompt(true);
                              setEditedEvaluationPromptName('');
                              setEditedEvaluationPrompt('');
                              // Initialize with empty prompts for existing categories
                              const initialCategories: Record<string, string> = {};
                              caseData.evaluationCategories?.forEach(category => {
                                initialCategories[category.name] = '';
                              });
                              setEditedCategoriesPrompts(initialCategories);
                              setEditedIsDraft(false);
                              scrollPromptEditorIntoView();
                            }}
                          >
                            {t('caseEditor.evaluation.createInstructionCta')}
                          </Button>
                        </div>
                      )}
                    </div>

                   {/* Evaluation Categories */}
                   <div className="space-y-4">
                     <h3 className="font-medium">{t('caseEditor.evaluation.categories')}</h3>
                     <div className="grid gap-4">
                       {caseData.evaluationCategories?.map((category) => (
                         <div key={category.id} className="p-4 border rounded-lg">
                           <div className="flex items-start justify-between">
                             <div className="flex-1">
                               <h4 className="font-medium">{category.name}</h4>
                                <p className="text-sm text-muted-foreground mt-2">{category.description}</p>
                               
                               {/* Show current prompt */}
                               {editedCategoriesPrompts[category.name] && (
                                 <div className="mt-2 p-2 bg-muted rounded text-sm">
                                   <div className="text-xs text-muted-foreground mb-1">{t('caseEditor.evaluation.instructionLabel')}:</div>
                                   <div className="text-sm">{editedCategoriesPrompts[category.name]}</div>
                                 </div>
                               )}
                             </div>
                             <div className="flex gap-1">
                                 <Button
                                   size="sm"
                                   variant="ghost"
                                   onClick={() => {
                                     setEditingEvaluation({
                                       ...category,
                                       instruction: editedCategoriesPrompts[category.name] || ''
                                     });
                                   }}
                                 >
                                 <Settings className="w-4 h-4" />
                               </Button>
                               <Button
                                 size="sm"
                                 variant="ghost"
                                 onClick={() => removeEvaluation(category.id)}
                               >
                                 <Trash2 className="w-4 h-4" />
                               </Button>
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>

                 </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t('caseEditor.finalEvaluation.title')}</CardTitle>
                    <CardDescription>
                      {t('caseEditor.finalEvaluation.description')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {finalEvaluationPrompt || isCreatingFinalPrompt ? (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between mb-4">
                          <h4 className="font-medium text-base">
                            {isCreatingFinalPrompt ? t('caseEditor.finalEvaluation.createTitle') : t('caseEditor.finalEvaluation.editTitle')}
                          </h4>
                          <Badge variant={editedFinalIsDraft ? "outline" : "default"}>
                            {editedFinalIsDraft ? 'Draft' : 'Active'}
                          </Badge>
                        </div>
                        
                        <div className="space-y-4">
                          {/* Prompt Name */}
                          <div className="space-y-2">
                            <Label htmlFor="finalPromptName">{t('caseEditor.evaluation.nameLabel')}</Label>
                            <Input
                              id="finalPromptName"
                              value={editedFinalPromptName}
                              onChange={(e) => setEditedFinalPromptName(e.target.value)}
                              placeholder={t('caseEditor.finalEvaluation.namePlaceholder')}
                            />
                          </div>

                          {/* Final Prompt Content */}
                          <div className="space-y-2">
                            <Label htmlFor="finalPromptContent">{t('caseEditor.finalEvaluation.promptContent')}</Label>
                            <Textarea
                              id="finalPromptContent"
                              value={editedFinalPrompt}
                              onChange={(e) => setEditedFinalPrompt(e.target.value)}
                              rows={10}
                              className="font-mono text-sm"
                              placeholder={t('caseEditor.finalEvaluation.promptPlaceholder')}
                            />
                          </div>

                          {/* Draft Status */}
                          <div className="flex items-center space-x-2">
                          <Switch
                            id="finalIsDraft"
                            checked={editedFinalIsDraft}
                            onCheckedChange={setEditedFinalIsDraft}
                          />
                          <Label htmlFor="finalIsDraft">{t('caseEditor.finalEvaluation.saveAsDraftLabel')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t('caseEditor.finalEvaluation.saveAsDraftNote')}
                          </p>
                          </div>

                          {/* Save Button for Creating New Prompt */}
                          {isCreatingFinalPrompt && (
                            <div className="flex gap-2">
                              <Button
                                onClick={async () => {
                                  setIsSavingPrompt(true);
                                  try {
                                    const newPrompt = await evaluationPromptService.createFinalEvaluationPrompt({
                                      name: editedFinalPromptName,
                                      prompt: editedFinalPrompt,
                                      is_draft: editedFinalIsDraft
                                    });
                                    setFinalEvaluationPrompt(newPrompt);
                                    setFinalEvaluationPrompts([...finalEvaluationPrompts, { id: newPrompt.id, name: newPrompt.name }]);
                                    setCaseData(prev => ({ ...prev, finalEvaluationPromptId: newPrompt.id }));
                                    setIsCreatingFinalPrompt(false);
                                    toast({
                                      title: t('userProfile.toasts.success'),
                                      description: t('caseEditor.finalEvaluation.createSuccess')
                                    });
                                  } catch (error: any) {
                                    console.error('Failed to create final evaluation instruction:', error);
                                    toast({
                                      title: t('userProfile.toasts.error'),
                                      description: error.message || t('caseEditor.finalEvaluation.createError'),
                                      variant: 'destructive'
                                    });
                                  } finally {
                                    setIsSavingPrompt(false);
                                  }
                                }}
                                disabled={!editedFinalPromptName || !editedFinalPrompt || isSavingPrompt}
                              >
                                {t('caseEditor.finalEvaluation.saveInstructionButton')}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setIsCreatingFinalPrompt(false);
                                  setEditedFinalPromptName('');
                                  setEditedFinalPrompt('');
                                  setEditedFinalIsDraft(false);
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-6 border-2 border-dashed border-muted-foreground/25 rounded-lg text-center space-y-4">
                          <div>
                            <h3 className="font-medium text-lg mb-2">{t('caseEditor.finalEvaluation.noPromptFound')}</h3>
                            <p className="text-muted-foreground text-sm mb-4">{t('caseEditor.finalEvaluation.noPromptDescription')}</p>
                          </div>
                          <Button
                            onClick={() => {
                              setIsCreatingFinalPrompt(true);
                              setEditedFinalPromptName('');
                              setEditedFinalPrompt('');
                              setEditedFinalIsDraft(false);
                            }}
                          >
                            {t('caseEditor.finalEvaluation.createPrompt')}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>{t('caseEditor.finalEvaluation.pdfNote')}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* AI Assistant sidebar - Only shown for draft cases */}
        {isDraftCase && (
          <div className="lg:col-span-1">
            <Card className="h-[calc(100vh-200px)] flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="flex items-center">
                <Bot className="w-5 h-5 mr-2" />
                {t('caseEditor.aiAssistant.title')}
              </CardTitle>
              <CardDescription className="text-sm">
                {t('caseEditor.aiAssistant.description')}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col space-y-4 min-h-0">
              {/* Info about chat - removed duplicate */}

              {/* Action Buttons */}
              <div className="flex gap-2 flex-shrink-0">
                <Dialog open={showAILog} onOpenChange={setShowAILog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="flex-1">
                      <Activity className="w-4 h-4 mr-1" />
                      {t('caseEditor.aiAssistant.aiLog')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle className="text-lg sm:text-xl">{t('caseEditor.aiAssistant.aiLogTitle')}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[60vh]">
                      <div className="space-y-2 text-sm font-mono">
                        <p>{t('caseEditor.aiAssistant.logMessages.init')}</p>
                        <p>{t('caseEditor.aiAssistant.logMessages.loadingPersona', { name: caseData.persona?.name || '' })}</p>
                        <p>{t('caseEditor.aiAssistant.logMessages.processingTestPersona', { name: allPersonas.find(p => p.id === selectedTestPersona)?.name || '' })}</p>
                        <p>{t('caseEditor.aiAssistant.logMessages.ready')}</p>
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>

                <Dialog open={showFinalDialogue} onOpenChange={setShowFinalDialogue}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="flex-1">
                      <MessageSquare className="w-4 h-4 mr-1" />
                      {t('caseEditor.aiAssistant.dialogue')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle className="text-lg sm:text-xl">{t('caseEditor.aiAssistant.dialogueTitle')}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[60vh]">
                      <div className="space-y-4">
                        {messages.map((message) => (
                          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg ${
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}>
                              <p className="text-sm">{message.content}</p>
                              <p className="text-xs opacity-70 mt-1">
                                {formatTime(message.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>

              <Separator className="flex-shrink-0" />

              {/* Chat Messages */}
              <div className="flex-1 border rounded-lg bg-muted/20 overflow-hidden flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: '100%' }}>
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      <div className="text-center space-y-2">
                        <Bot className="w-8 h-8 mx-auto opacity-50" />
                        <p>{t('caseEditor.aiAssistant.description')}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((message) => (
                        <div key={message.id} className="space-y-2">
                          <div className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {message.role === 'ai' && (
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-primary" />
                              </div>
                            )}
                            <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-background border rounded-bl-sm'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                              <p className={`text-xs mt-1 ${
                                message.role === 'user'
                                  ? 'text-primary-foreground/70'
                                  : 'text-muted-foreground'
                              }`}>
                                {formatTime(message.timestamp)}
                              </p>
                            </div>
                            {message.role === 'user' && (
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                <User className="w-4 h-4 text-primary-foreground" />
                              </div>
                            )}
                          </div>

                          {/* Display operations if present */}
                          {message.operations && message.operations.length > 0 && (
                            <div className={`space-y-1 ${message.role === 'user' ? 'mr-10' : 'ml-10'}`}>
                              {message.operations.map((op, idx) => (
                                <div key={idx} className="text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-blue-700 dark:text-blue-300">
                                      {op.operation === 'add' && '➕ Add'}
                                      {op.operation === 'remove' && '➖ Remove'}
                                      {op.operation === 'replace' && '🔄 Replace'}
                                    </span>
                                    <span className="text-gray-700 dark:text-gray-300">
                                      {op.entity}.{op.field}
                                    </span>
                                  </div>
                                  {op.operation === 'replace' && (
                                    <div className="mt-1 space-y-1">
                                      {op.old_value && (
                                        <div className="text-gray-500 line-through">
                                          Old: {typeof op.old_value === 'object' ? JSON.stringify(op.old_value) : op.old_value}
                                        </div>
                                      )}
                                      <div className="text-green-700 dark:text-green-300 font-medium">
                                        New: {typeof op.new_value === 'object' ? JSON.stringify(op.new_value) : op.new_value}
                                      </div>
                                    </div>
                                  )}
                                  {op.operation === 'add' && (
                                    <div className="mt-1 text-green-700 dark:text-green-300 font-medium">
                                      {typeof op.new_value === 'object' ? JSON.stringify(op.new_value) : op.new_value}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {isSendingMessage && (
                        <div className="flex gap-2 justify-start">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                          <div className="bg-background border rounded-2xl rounded-bl-sm px-4 py-3">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>
              </div>

              {/* Chat Input */}
              <div className="flex gap-2 pt-2 flex-shrink-0">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={t('caseEditor.aiAssistant.messagePlaceholder')}
                  disabled={isSendingMessage}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isSendingMessage) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isSendingMessage}
                  size="icon"
                  className="flex-shrink-0"
                >
                  {isSendingMessage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        )}
      </div>

      {/* Apply Draft Confirmation Dialog */}
      <AlertDialog open={showApplyDraftDialog} onOpenChange={setShowApplyDraftDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('caseEditor.applyDraftTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('caseEditor.applyDraftDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('caseEditor.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApplyDraftConfirm}
              className="bg-success hover:bg-success/90"
            >
              {t('caseEditor.applyChanges')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showEvaluationPromptDialog} onOpenChange={setShowEvaluationPromptDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{getMockEvaluationPrompt().name}</DialogTitle>
            <DialogDescription>
              {t('caseEditor.basic.evaluationPrompt')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Main Prompt:</h4>
                <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm">
                  {getMockEvaluationPrompt().main_prompt}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Category Prompts:</h4>
                <div className="space-y-3">
                  {Object.entries(getMockEvaluationPrompt().categories_prompts).map(([category, prompt]) => (
                    <div key={category} className="bg-muted p-3 rounded-lg">
                      <strong className="text-primary">{category}:</strong>
                      <p className="mt-1 text-sm text-muted-foreground">{prompt}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showFinalEvaluationPromptDialog} onOpenChange={setShowFinalEvaluationPromptDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{getMockFinalEvaluationPrompt().name}</DialogTitle>
            <DialogDescription>
              {t('caseEditor.basic.finalEvaluationPrompt')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm">
              {getMockFinalEvaluationPrompt().prompt}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingReaction} onOpenChange={() => setEditingReaction(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Reaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>{t('caseEditor.persona.reactionName')}</Label>
              <Input
                value={editingReaction?.name || ''}
                onChange={(e) => setEditingReaction(prev => 
                  prev ? { ...prev, name: e.target.value } : null
                )}
                placeholder={t('caseEditor.persona.reactionNamePlaceholder')}
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('caseEditor.persona.reactionDescription')}</Label>
              <Textarea
                value={editingReaction?.description || ''}
                onChange={(e) => setEditingReaction(prev => 
                  prev ? { ...prev, description: e.target.value } : null
                )}
                placeholder={t('caseEditor.persona.reactionDescriptionPlaceholder')}
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('caseEditor.persona.reactions.selectionLogic')}</Label>
              <Textarea
                value={editingReaction?.selectionLogic || ''}
                onChange={(e) => setEditingReaction(prev => 
                  prev ? { ...prev, selectionLogic: e.target.value } : null
                )}
                placeholder={t('caseEditor.persona.reactions.selectionLogicPlaceholder')}
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('caseEditor.persona.reactionPrompt')}</Label>
              <Textarea
                value={editingReaction?.prompt || ''}
                onChange={(e) => setEditingReaction(prev => 
                  prev ? { ...prev, prompt: e.target.value } : null
                )}
                placeholder={t('caseEditor.persona.reactionPromptPlaceholder')}
                rows={4}
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('caseEditor.persona.reactions.goals')}</Label>
              <Textarea
                value={editingReaction?.goals || ''}
                onChange={(e) => setEditingReaction(prev => 
                  prev ? { ...prev, goals: e.target.value } : null
                )}
                placeholder={t('caseEditor.persona.reactions.goalsPlaceholder')}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {t('caseEditor.persona.reactions.goalsHint')}
              </p>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button onClick={updateReaction} className="flex-1">
                Save Changes
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setEditingReaction(null)} 
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cropperOpen} onOpenChange={(open) => {
        if (!open) {
          closeCropper();
        }
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('caseEditor.persona.cropper.title')}</DialogTitle>
            <DialogDescription>
              {t('caseEditor.persona.cropper.subtitle')}
            </DialogDescription>
          </DialogHeader>
          {cropImageSrc && (
            <div className="space-y-4">
              <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden">
                <Cropper
                  image={cropImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={(value) => setZoom(value)}
                  onCropComplete={(_, croppedArea) => setCroppedAreaPixels(croppedArea)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{t('caseEditor.persona.cropper.zoom')}</Label>
                <Slider
                  value={[zoom]}
                  onValueChange={(value) => setZoom(value[0])}
                  min={1}
                  max={3}
                  step={0.1}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeCropper}>
                  {t('caseEditor.persona.cropper.cancel')}
                </Button>
                <Button onClick={handleCropConfirm} disabled={isUploadingImage}>
                  {isUploadingImage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('caseEditor.persona.cropper.save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Test Runner Modal */}
      <AITestRunnerModal
        isOpen={aiTestModal.isOpen}
        onClose={() => setAITestModal({ isOpen: false, caseId: '', caseTitle: '' })}
        caseId={aiTestModal.caseId}
        caseTitle={aiTestModal.caseTitle}
      />

      <Dialog open={validation.open} onOpenChange={(open) => setValidation((v) => ({ ...v, open }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              {t('caseEditor.validate.title')}
            </DialogTitle>
            {validation.result && (
              <DialogDescription>
                {validation.result.persona_name} · {t('caseEditor.validate.summary', {
                  errors: validation.result.errors,
                  warnings: validation.result.warnings,
                })}
              </DialogDescription>
            )}
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {validation.result && validation.result.findings.length === 0 ? (
              <div className="flex items-center gap-2 text-success py-4">
                <Check className="w-5 h-5" />
                {t('caseEditor.validate.noIssues')}
              </div>
            ) : (
              <div className="space-y-2 pr-3">
                {validation.result?.findings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {f.severity === 'error' ? (
                      <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-destructive" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-warning" />
                    )}
                    <span>{f.message}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CaseEditor;
