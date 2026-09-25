import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import {
  Send,
  Mic,
  Square,
  MessageSquare,
  Settings,
  Compass,
  Keyboard,
  Clock,
  Eye,
  ChevronDown,
  MessageCircle,
  Camera,
  AlertTriangle,
  X,
  Loader2,
  FileText,
  Download
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { extractLocalizedContent } from '@/utils/localizedContent';
import { useAuth } from '@/contexts/AuthContext';
import { PreLaunchTest } from '@/components/PreLaunchTest';
import { AudioPlayer } from '@/components/AudioPlayer';
import { PersonaChatAvatar } from '@/components/PersonaChatAvatar';
import { VideoRecorder } from '@/components/VideoRecorder';
import { SessionRecorder } from '@/components/SessionRecorder';
import SimulationTimer from '@/components/SimulationTimer';
import { RichTextContent } from '@/components/RichTextContent';
import { apiClient } from '@/services/api';
import { transcriptService, type TranscriptMessage } from '@/services/transcriptService';
import { logEvent } from '@/services/eventLogService';
import { wsService, type ConnectionState } from '@/services/websocket';
import { formatTime as formatTimestamp } from '@/utils/dateTime';
import { mockPersonaToPersonaUpdate } from '@/utils/caseMapper';
import { getSimulationVoiceEnabled } from '@/utils/simulationPersona';

type InputMode = 'text' | 'audio';
type MessageType = 'user' | 'ai' | 'divider';

interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  audioUrl?: string;
  isError?: boolean;
}

// Marker the AI persona inserts in its own response text to signal a stage
// transition (e.g. "the visit happened, conversation continues post-visit").
// Stripped from the bubble content; rendered as a centered grey divider
// inserted right before the AI message that contained it.
//
// Format: <<DIVIDER:visible text shown to user>>
// Example: "Let's meet tomorrow at the plant. <<DIVIDER:Візит відбувся, розмова продовжується після візиту>>"
const DIVIDER_MARKER_RE = /<<DIVIDER:([^>]+)>>/g;

const parseStageMarkers = (
  content: string
): { dividers: string[]; cleanContent: string } => {
  const dividers: string[] = [];
  const cleanContent = content
    .replace(DIVIDER_MARKER_RE, (_match, text) => {
      dividers.push(String(text).trim());
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { dividers, cleanContent };
};

// Map of reaction-name patterns (set by case author in admin) to a translation
// key for the divider text shown when the reaction transitions to that pattern.
// Programmatic path — reliable, doesn't depend on the LLM remembering to emit
// a marker. Localised via `t()` at call site so the divider follows the UI
// language, not the case's source language.
//
// To add a divider for a new transition: name the reaction with a recognizable
// prefix in the case editor, then add an entry below with a new locale key.
const REACTION_DIVIDER_PATTERNS: Array<{ test: RegExp; key: string }> = [
  {
    test: /^post[_-]?visit/i,
    key: 'simulation.divider.postVisit',
  },
];

const getReactionDividerKey = (reactionName: string | null | undefined): string | null => {
  if (!reactionName) return null;
  const match = REACTION_DIVIDER_PATTERNS.find(p => p.test.test(reactionName));
  return match ? match.key : null;
};

interface CaseData {
  id: string;
  title: string;
  intro_text: string;
  prompt: string;
  is_draft: boolean;
  timer_time?: number | null;
  simulation_navigation?: string | null;
  role_in_simulation?: string | null;
  persona_description?: string | null;
  case_overview?: string | null;
  brief_items?: { label: string; value: string }[];
  phases?: { id: string; name: string; reaction_ids?: string[] }[];
}

interface EmotionData {
  description: string;
  image_url?: string;
}

interface PersonaData {
  id: string;
  name: string;
  role?: string;
  persona_description: string;
  avatar_base_url: string | null;
  emotions: Record<string, EmotionData>; // emotions is an object, not array
  actions: Record<string, string>;
  action_labels?: Record<string, string>;
  action_descriptions?: Record<string, string>;
  action_chat_messages?: Record<string, string>;
  action_popup_texts?: Record<string, string>;
  /** Omitted on historical personas; omission keeps the legacy voice path. */
  voice_enabled?: boolean;
  is_draft: boolean;
}

const Simulation: React.FC = () => {
  const { chatId: chatIdFromUrl } = useParams<{ chatId: string }>();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  // Single-fire guard: LLM 1 may signal `should_end: true` on several
  // consecutive turns. We surface the wrap-up suggestion toast only ONCE per
  // session so the user isn't spammed.
  const endSuggestionShownRef = useRef<boolean>(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const isHrVersion = String(
    (import.meta.env as any)?.VITE_HR_VERSION ??
    ''
  ).toLowerCase() === 'true';

  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [userRoleDescription, setUserRoleDescription] = useState<string | null>(null); // First message with user role description
  const [firstBotMessage, setFirstBotMessage] = useState<string | null>(null); // First message from bot/AI
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>([]);
  const [showPreLaunchTest, setShowPreLaunchTest] = useState(false); // Will be set after loading chat
  const [testsCompleted, setTestsCompleted] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [chatPersonaSnapshot, setChatPersonaSnapshot] = useState<PersonaData | null>(null);
  const [chatSnapshotLoaded, setChatSnapshotLoaded] = useState(false);

  // Modal states
  const [showEndSimulationModal, setShowEndSimulationModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showPersonaInfoModal, setShowPersonaInfoModal] = useState(false);
  const [showNavigationModal, setShowNavigationModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ id: string; label: string; chatMessage: string; popupText: string } | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  // Case data from backend
  const [currentCase, setCurrentCase] = useState<CaseData | null>(null);
  const [currentPersona, setCurrentPersona] = useState<PersonaData | null>(null);
  const [isLoadingCase, setIsLoadingCase] = useState(true);
  const [caseLoadError, setCaseLoadError] = useState<{ title: string; message: string } | null>(null);
  const [showRecommendAction, setShowRecommendAction] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  // Surface a hint once thinking exceeds ~30s so the user doesn't think the
  // socket died (client request after Alvaro repeatedly typed "are you there?"
  // because the LLM took 60+ seconds with no UI feedback).
  const [aiTypingTookLong, setAiTypingTookLong] = useState(false);
  const aiTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hard recovery: if a reply never lands (lost socket edge case, n8n 300s
  // timeout, backend 500), the typing dots used to spin forever and the only
  // way out was a reload. After this long we clear the indicator and tell the
  // user to resend. 75s sits above the worst legitimate case (slow LLM + one
  // reconnect cycle, ~50s) and well below the backend's 300s dead-hang.
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AI_REPLY_TIMEOUT_MS = 75_000;
  // Lets the timeout below call the latest loadChatHistory (defined further down)
  // without a forward reference in its deps.
  const loadChatHistoryRef = useRef<(() => Promise<boolean>) | null>(null);

  // A missing receipt is not proof that the turn failed: the final response
  // can still arrive after a transient delivery problem. The final reply
  // watchdog below is the only path that may show a resend error.
  const sendTurn = (payload: Parameters<typeof wsService.sendSimulationMessage>[1]) => {
    wsService.sendSimulationMessage(caseId!, payload);
  };

  // A dropped link used to be invisible: the typing dots kept bouncing while
  // the turn sat in the send queue, so a dead socket was indistinguishable from
  // a slow persona and the only way out was a page reload.
  const [connectionState, setConnectionState] = useState<ConnectionState>(wsService.getState());

  useEffect(() => wsService.onStateChange(setConnectionState), []);

  useEffect(() => {
    if (isAiTyping) {
      setAiTypingTookLong(false);
      aiTypingTimerRef.current = setTimeout(() => setAiTypingTookLong(true), 30_000);
      aiTimeoutRef.current = setTimeout(async () => {
        // A half-open socket swallows live delivery, but the backend already saved
        // the reply. Resync first: if history now ends with an AI reply the turn
        // landed — show it and skip the error (a resend would double the turn).
        const landed = await loadChatHistoryRef.current?.();
        setAiTypingTookLong(false);
        setIsAiTyping(false);
        if (!landed) {
          setMessages(prev => [
            ...prev,
            {
              id: `timeout-${Date.now()}`,
              type: 'ai',
              content: t('simulation.replyTimeout'),
              timestamp: new Date(),
              isError: true,
            },
          ]);
        }
      }, AI_REPLY_TIMEOUT_MS);
    } else {
      if (aiTypingTimerRef.current) clearTimeout(aiTypingTimerRef.current);
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      setAiTypingTookLong(false);
    }
    return () => {
      if (aiTypingTimerRef.current) clearTimeout(aiTypingTimerRef.current);
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, [isAiTyping, t]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(chatIdFromUrl || null);
  // Runtime phase tracking (right-panel progress widget). Reflects the
  // most recent `reaction_name` emitted by the router LLM (LLM 1) and
  // forwarded by n8n in the ai_response envelope. Null until we receive
  // the first AI response. UI falls back to the first phase in
  // case.phases when this is null.
  const [currentReactionName, setCurrentReactionName] = useState<string | null>(null);
  // Monotonic progress index — never regresses even if the router LLM
  // returns to an earlier phase (e.g. user pulls negotiation back to
  // discovery). Reset implicitly on new chat (component remount).
  const [maxPhaseIndex, setMaxPhaseIndex] = useState(0);
  const [shouldStopRecording, setShouldStopRecording] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [isRecordingUploadComplete, setIsRecordingUploadComplete] = useState(false);
  const [isEndingSimulation, setIsEndingSimulation] = useState(false);
  const [hasRecordingConsent, setHasRecordingConsent] = useState(false);
  const [isSessionRecording, setIsSessionRecording] = useState(false);
  const [isSessionRecordingUploadComplete, setIsSessionRecordingUploadComplete] = useState(false);
  const [shouldStopSessionRecording, setShouldStopSessionRecording] = useState(false);
  const [hasSessionRecording, setHasSessionRecording] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string>('neutral');
  /** Id of the message whose audio is currently playing; null = none. Used to disable record and prevent parallel playback. */
  const [playingAudioMessageId, setPlayingAudioMessageId] = useState<string | null>(null);
  /** Which case-intro step modal is open (1, 2, 3) or null */
  const [showStepModal, setShowStepModal] = useState<1 | 2 | 3 | null>(null);
  const [showTranscriptDialog, setShowTranscriptDialog] = useState(false);
  const [isTranscriptDownloading, setIsTranscriptDownloading] = useState(false);
  const [savedTranscriptMessages, setSavedTranscriptMessages] = useState<TranscriptMessage[]>([]);
  const [isSavedTranscriptLoading, setIsSavedTranscriptLoading] = useState(false);
  const [savedTranscriptError, setSavedTranscriptError] = useState<string | null>(null);
  const [savedTranscriptPersonaName, setSavedTranscriptPersonaName] = useState('Persona');
  const [savedTranscriptParticipantName, setSavedTranscriptParticipantName] = useState('Participant');

  // Timer state (countdown, auto-end simulation, 10 min warning)
  const [timerAutoStart, setTimerAutoStart] = useState(false);
  // Nudge user to click "End" at 15/25/35 min of dialog time; auto-hides after 2 min.
  const [endReminderOpen, setEndReminderOpen] = useState(false);

  // Historical personas omit the switch and retain voice. Text-only sessions
  // skip all media setup after the persona snapshot is known.
  const voiceEnabled = getSimulationVoiceEnabled(chatPersonaSnapshot, currentPersona);

  useEffect(() => {
    if (!currentPersona) return;
    setInputMode(currentPersona.voice_enabled === false ? 'text' : isHrVersion ? 'audio' : 'text');
    if (currentPersona.voice_enabled === false) {
      setShowPreLaunchTest(false);
      setTestsCompleted(true);
    }
  }, [currentPersona, isHrVersion]);

  useEffect(() => {
    if (!showTranscriptDialog || !currentChatId) return;
    let cancelled = false;
    setIsSavedTranscriptLoading(true);
    setSavedTranscriptError(null);
    transcriptService.getTranscript(String(currentChatId))
      .then((transcript) => {
        if (cancelled) return;
        setSavedTranscriptMessages(transcript.messages);
        setSavedTranscriptPersonaName(transcript.persona_snapshot?.name || currentPersona?.name || 'Persona');
        setSavedTranscriptParticipantName(transcript.participant_name || 'Participant');
      })
      .catch((error: { message?: string }) => {
        if (cancelled) return;
        setSavedTranscriptMessages([]);
        setSavedTranscriptError(error?.message || 'Could not load the saved transcript.');
      })
      .finally(() => {
        if (!cancelled) setIsSavedTranscriptLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showTranscriptDialog, currentChatId, currentPersona?.name]);

  // Separate function to complete simulation
  const completeSimulation = useCallback(async (chatId: string, recordingCompletedSuccessfully: boolean) => {
    try {
      console.log('🏁 Completing simulation with recording status:', recordingCompletedSuccessfully);
      wsService.sendSimulationMessage(caseId!, {
        type: 'end_simulation',
        simulation_id: chatId,
        recording_completed: recordingCompletedSuccessfully,
        lang: language
      });
      console.log('✅ Simulation completion message sent via WebSocket');
    } catch (error) {
      console.error('❌ Failed to send completion message:', error);
    }

    // Navigate to results page
    navigate(`/simulation/${chatId}/results`);
    setIsEndingSimulation(false);
  }, [caseId, language, navigate]);

  const startTimer = useCallback(() => setTimerAutoStart(true), []);
  const stopTimer = useCallback(() => setTimerAutoStart(false), []);

  // Debug: log currentChatId changes
  useEffect(() => {
    console.log('🔄 currentChatId changed to:', currentChatId);
  }, [currentChatId]);

  // Debug: log testsCompleted changes
  useEffect(() => {
    console.log('🧪 testsCompleted changed to:', testsCompleted, 'showPreLaunchTest:', showPreLaunchTest);
  }, [testsCompleted, showPreLaunchTest]);

  // Auto-complete simulation when recording upload finishes
  useEffect(() => {
    if (!isEndingSimulation || !currentChatId) return;

    const pendingWebcam = hasRecordingConsent && !isRecordingUploadComplete;
    const pendingSession = hasSessionRecording && !isSessionRecordingUploadComplete;

    if (!pendingWebcam && !pendingSession) {
      console.log('✅ All recordings uploaded - auto-completing simulation');
      completeSimulation(String(currentChatId), true);
    }
  }, [
    isEndingSimulation,
    isRecordingUploadComplete,
    isSessionRecordingUploadComplete,
    hasRecordingConsent,
    hasSessionRecording,
    currentChatId,
    completeSimulation,
  ]);

  // Timeout for recording upload if it takes too long (handles background/tab switches)
  useEffect(() => {
    if (isEndingSimulation && currentChatId) {
      const pendingWebcam = hasRecordingConsent && !isRecordingUploadComplete;
      const pendingSession = hasSessionRecording && !isSessionRecordingUploadComplete;

      if (!pendingWebcam && !pendingSession) {
        return;
      }

      console.log('⏰ Starting recording upload timeout (30 seconds)');
      const timeout = setTimeout(() => {
        if (isEndingSimulation && (pendingWebcam || pendingSession)) {
          console.warn('⚠️ Recording upload timeout - completing simulation anyway');
          completeSimulation(String(currentChatId), false);
        }
      }, 30000); // 30 seconds timeout - reasonable for most recordings

      return () => clearTimeout(timeout);
    }
  }, [
    isEndingSimulation,
    hasRecordingConsent,
    currentChatId,
    isRecordingUploadComplete,
    hasSessionRecording,
    isSessionRecordingUploadComplete,
    completeSimulation,
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const firstBotMessageSetRef = useRef<boolean>(false);
  // Last reaction_name seen on an ai_response. Used to detect stage transitions
  // and render a divider once when the reaction changes to a divider-mapped one.
  const lastReactionRef = useRef<string | null>(null);

  // --- Streaming AI turn (backend feature-flagged, OFF by default) ---
  // A turn is "streamed" when ai_stream_start arrives before its ai_response.
  // Refs (not state) because the WS handler is a stable closure that must
  // read/write this synchronously across the many messages of one turn.
  const streamingTurnRef = useRef<{
    active: boolean;
    simulationId: string | null;
    messageId: string | null;
  }>({ active: false, simulationId: null, messageId: null });
  // Sequential play-queue for a streamed turn's audio chunks. Clips play
  // back-to-back in `seq` order; `failed` flips on decode/playback error so the
  // final ai_response.audio_url is used as a fallback.
  const audioQueueRef = useRef<{
    turnMessageId: string | null;
    queue: Array<{ seq: number; url: string }>;
    current: HTMLAudioElement | null;
    playing: boolean;
    failed: boolean;
  }>({ turnMessageId: null, queue: [], current: null, playing: false, failed: false });

  // Load chat data first to get case_id and determine if pre-launch test is needed
  useEffect(() => {
    const loadChatData = async () => {
      if (!chatIdFromUrl) return;
      
      try {
        setIsLoadingCase(true);
        setChatSnapshotLoaded(false);
        setChatPersonaSnapshot(null);
        setCurrentPersona(null);
        // Get chat data to extract case_id
        const response = await apiClient.get<{
          data: {
            chat_data: {
              id: number;
              case_id: number;
              user_id: string;
              chat_history: any[];
              persona_snapshot?: PersonaData | null;
              [key: string]: any;
            };
            history_formatted: any[];
          }
        }>(`/simulation/${chatIdFromUrl}/all_data`);
        
        const chatData = response.data.chat_data;
        setChatPersonaSnapshot(chatData.persona_snapshot);
        setChatSnapshotLoaded(true);
        const caseIdFromChat = String(chatData.case_id);
        setCaseId(caseIdFromChat);
        
        // Determine if we should show pre-launch test
        // Show test if chat is new (no messages yet)
        const hasMessages = chatData.chat_history && chatData.chat_history.length > 0;
        if (!hasMessages) {
          setShowPreLaunchTest(true);
          setTestsCompleted(false);
        } else {
          setShowPreLaunchTest(false);
          setTestsCompleted(true);
        }
        
        console.log('Chat data loaded, case_id:', caseIdFromChat, 'has messages:', hasMessages);
      } catch (error) {
        console.error('Failed to load chat data:', error);
        // If chat doesn't exist, redirect to dashboard
        navigate('/member-dashboard');
      }
    };
    
    loadChatData();
  }, [chatIdFromUrl, navigate]);
  const recordingTimer = useRef<NodeJS.Timeout>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  // Fetch case data and persona from backend
  useEffect(() => {
    const fetchCaseAndPersona = async () => {
      if (!caseId || !chatSnapshotLoaded) return;

      try {
        // Fetch case with all data including personas
        const response = await apiClient.get<{
          data: {
            case: CaseData;
            persona: PersonaData
          }
        }>(`/cases/${caseId}/all_data`);
        console.log('📜 Fetched case data:', response.data);

        const caseData = response.data.case;
        const persona = response.data.persona;
        const normalizedCase: CaseData = {
          ...caseData,
          timer_time: caseData.timer_time != null ? Number(caseData.timer_time) : null
        };

        setCurrentCase(normalizedCase);
        setCurrentPersona(chatPersonaSnapshot ?? persona);
        setCaseLoadError(null); // Clear any previous errors

        console.log('✅ Case and persona loaded:', {
          case: caseData,
          persona: chatPersonaSnapshot ?? persona,
          personaSource: chatPersonaSnapshot ? 'chat snapshot' : 'current case persona',
        });
        console.log('🎭 Emotions data:', (chatPersonaSnapshot ?? persona).emotions);
        console.log('🎭 Available emotion keys:', Object.keys((chatPersonaSnapshot ?? persona).emotions || {}));
        
        // Log new case fields
        console.log('📋 Case fields:');
        console.log('  - role_in_simulation:', caseData.role_in_simulation);
        console.log('  - persona_description:', caseData.persona_description);
        console.log('  - case_overview:', caseData.case_overview);
      } catch (error) {
        console.error('Failed to fetch case and persona:', error);
        
        // Handle error properly
        const apiError = error as import('@/services/api').ApiError;
        
        if (apiError.status === 403) {
          setCaseLoadError({
            title: t('simulation.errors.forbiddenTitle'),
            message: t('simulation.errors.forbiddenMessage')
          });
        } else if (apiError.status === 404) {
          setCaseLoadError({
            title: t('simulation.errors.notFoundTitle'),
            message: t('simulation.errors.notFoundMessage')
          });
        } else if (apiError.status === 401) {
          setCaseLoadError({
            title: t('simulation.errors.authTitle'),
            message: t('simulation.errors.authMessage')
          });
          // Optionally redirect to login
          setTimeout(() => navigate('/login'), 2000);
        } else {
          setCaseLoadError({
            title: t('simulation.errors.loadErrorTitle'),
            message: apiError.details?.message || apiError.message || t('simulation.errors.loadErrorMessage')
          });
        }
      } finally {
        setIsLoadingCase(false);
      }
    };

    fetchCaseAndPersona();
  }, [caseId, chatPersonaSnapshot, chatSnapshotLoaded, navigate, t]);

  // Load chat history when we have both chatId and caseId. Returns whether the
  // rebuilt history ends with an AI reply, so a reconnect resync can tell a
  // recovered turn (clear the typing dots) from a still-pending one.
  const loadChatHistory = useCallback(async (): Promise<boolean> => {
      if (!currentChatId || !caseId) return false;

      try {
        console.log('📜 Loading chat history for:', currentChatId);
        const response = await apiClient.get<{
          data: {
            history_formatted: Array<{
              message_text: string;
              message_type: 'ai' | 'human' | 'system';
              audio_file_url?: string;
              created_at: string;
            }>;
          }
        }>(`/simulation/${currentChatId}/all_data`);

        const history = response.data.history_formatted;
        console.log('📜 Fetched response', response);
        console.log('📥 Chat history response:', history);

        // Convert to Message format. System messages render as grey dividers
        // (same shape as <<DIVIDER:...>> markers from ai responses).
        const allMessages: Message[] = [];
        history.forEach((msg, index) => {
          if (msg.message_type === 'system') {
            allMessages.push({
              id: `loaded-${index}-system`,
              type: 'divider',
              content: msg.message_text,
              timestamp: new Date(msg.created_at),
            });
            return;
          }
          if (msg.message_type === 'ai') {
            const { dividers, cleanContent } = parseStageMarkers(msg.message_text);
            dividers.forEach((text, di) => {
              allMessages.push({
                id: `loaded-${index}-divider-${di}`,
                type: 'divider',
                content: text,
                timestamp: new Date(msg.created_at),
              });
            });
            allMessages.push({
              id: `loaded-${index}`,
              type: 'ai',
              content: cleanContent,
              timestamp: new Date(msg.created_at),
              audioUrl: msg.audio_file_url,
            });
            return;
          }
          allMessages.push({
            id: `loaded-${index}`,
            type: 'user',
            content: msg.message_text,
            timestamp: new Date(msg.created_at),
            audioUrl: msg.audio_file_url,
          });
        });

        // Check if first message is a user role description (starts with "You are" or similar)
        if (allMessages.length > 0) {
          const firstMessage = allMessages[0];
          const isRoleDescription = firstMessage.type === 'ai' && 
            (firstMessage.content.toLowerCase().startsWith('you are') || 
             firstMessage.content.toLowerCase().includes('category manager') ||
             firstMessage.content.toLowerCase().includes('you are a') ||
             firstMessage.content.toLowerCase().includes('you are an'));
          
          // Find and save first message from bot/AI (not role description)
          // This is the first AI message that is NOT a role description
          let firstAiMessage: Message | undefined;
          if (isRoleDescription) {
            // If first message is role description, find next AI message
            firstAiMessage = allMessages.find(msg => msg.type === 'ai' && msg.id !== firstMessage.id);
            // Save role description
            setUserRoleDescription(firstMessage.content);
          } else {
            // If first message is not role description, it might be the first bot message
            firstAiMessage = allMessages.find(msg => msg.type === 'ai');
          }
          
          // Save first bot message for sidebar if found and not already saved
          if (firstAiMessage && !firstBotMessageSetRef.current) {
            setFirstBotMessage(firstAiMessage.content);
            firstBotMessageSetRef.current = true; // Mark as set
            console.log('✅ First bot message saved for sidebar');
          }
          
          // Keep all messages including first bot message in chat
          let messagesToShow = allMessages;
          
          // Only remove role description if it exists (but keep first bot message in chat)
          if (isRoleDescription) {
            messagesToShow = messagesToShow.filter(msg => msg.id !== firstMessage.id);
            console.log('✅ User role description extracted and moved to sidebar');
          }
          
          setMessages(messagesToShow);
          console.log('✅ Chat history loaded:', messagesToShow.length, 'messages (first bot message shown in chat)');

          // Show recommend action button if last message is from AI
          let lastIsAi = false;
          if (messagesToShow.length > 0) {
            const lastMessage = messagesToShow[messagesToShow.length - 1];
            lastIsAi = lastMessage.type === 'ai';
            // Recommend-action button is HR-only; lastIsAi stays general so the
            // reconnect/timeout resync detects a landed reply on TradeBV too.
            setShowRecommendAction(lastIsAi && isHrVersion);
          }
          return lastIsAi;
        }
        return false;
      } catch (error) {
        console.error('Failed to load chat history:', error);
        return false;
      }
  }, [currentChatId, caseId]);
  loadChatHistoryRef.current = loadChatHistory;

  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  // A slow turn (voice especially: STT + 2 LLM + TTS runs ~30s) can outlive the
  // socket. The backend still saves the AI reply to history, but its live
  // delivery is lost when the socket is briefly dead — the user then waits out
  // the 75s typing timeout and resends, double-sending the turn. On reconnect we
  // resync from history: if it now ends with an AI reply, the lost turn landed —
  // show it and clear the typing dots instead of hanging.
  const prevConnRef = useRef<ConnectionState>(wsService.getState());
  useEffect(() => {
    const prev = prevConnRef.current;
    prevConnRef.current = connectionState;
    if (prev !== 'connected' && connectionState === 'connected' && currentChatId && caseId) {
      loadChatHistory().then(lastIsAi => {
        if (lastIsAi) setIsAiTyping(false);
      });
    }
  }, [connectionState, currentChatId, caseId, loadChatHistory]);

  // --- Streamed-audio queue helpers (ref-based, no globals) ---
  const stopStreamAudio = useCallback(() => {
    const q = audioQueueRef.current;
    if (q.current) {
      q.current.onended = null;
      q.current.onerror = null;
      q.current.pause();
      q.current = null;
    }
    for (const item of q.queue) URL.revokeObjectURL(item.url);
    q.queue = [];
    q.playing = false;
  }, []);

  const resetStreamAudioQueue = useCallback((turnMessageId: string) => {
    stopStreamAudio();
    audioQueueRef.current = {
      turnMessageId,
      queue: [],
      current: null,
      playing: false,
      failed: false,
    };
  }, [stopStreamAudio]);

  const playNextStreamClip = useCallback(() => {
    const q = audioQueueRef.current;
    if (q.failed) return;
    const next = q.queue.shift();
    if (!next) {
      q.playing = false;
      q.current = null;
      return;
    }
    q.playing = true;
    const audio = new Audio(next.url);
    q.current = audio;
    const fail = () => {
      URL.revokeObjectURL(next.url);
      q.failed = true;
      stopStreamAudio();
    };
    audio.onended = () => {
      URL.revokeObjectURL(next.url);
      if (q.current === audio) q.current = null;
      playNextStreamClip();
    };
    audio.onerror = () => {
      console.error('❌ Streamed audio clip failed to play, seq:', next.seq);
      fail();
    };
    const p = audio.play();
    if (p !== undefined) {
      p.catch(err => {
        console.error('❌ Streamed audio clip play() rejected, seq:', next.seq, err);
        fail();
      });
    }
  }, [stopStreamAudio]);

  const enqueueStreamClip = useCallback((seq: number, url: string) => {
    const q = audioQueueRef.current;
    if (q.failed) {
      URL.revokeObjectURL(url);
      return;
    }
    const idx = q.queue.findIndex(item => item.seq > seq);
    if (idx === -1) q.queue.push({ seq, url });
    else q.queue.splice(idx, 0, { seq, url });
    if (!q.playing) playNextStreamClip();
  }, [playNextStreamClip]);

  const decodeBase64ToObjectUrl = useCallback((b64: string, mime: string): string => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }, []);

  // Revoke any pending object URLs on unmount to avoid leaks.
  useEffect(() => () => stopStreamAudio(), [stopStreamAudio]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!caseId) return;

    const token = localStorage.getItem('auth_token');

    const setupHandler = () => {
      // Listen for AI responses
      const eventName = `/simulation/chat/${caseId}`;
      const handler = (data: any) => {
        console.log('📨 Received WebSocket message:', eventName, data);

        // Handle errors
        if (data.error || data.success === false) {
          console.error('❌ Error from server:', data.error);
          setIsAiTyping(false);
          const errorText = typeof data.error === 'string' ? data.error : (data.error?.message || 'Something went wrong');
          logEvent('bot_reply_error', {}, errorText);
          // The participant only ever sees a localized message, never the server's
          // internal wording — a config/contract fault must not surface as the
          // persona's line. 504 gets a distinct "resend" hint.
          const isTimeout = data.error?.code === 504;
          const errorMessage: Message = {
            id: Date.now().toString(),
            type: 'ai',
            content: isTimeout
              ? t('simulation.replyTimeout')
              : t('simulation.errorGeneric'),
            timestamp: new Date(),
            isError: true
          };
          setMessages(prev => [...prev, errorMessage]);
          // Show recommend action button when AI sends a message (even if error)
          if (isHrVersion) {
            setShowRecommendAction(true);
          }
          return;
        }

        if (data.type === 'transcription_ready') {
          // Update the last user message with transcription
          console.log('📝 Transcription received:', data.transcription);
          console.log('📝 Current messages before update:', messages);
          
          setMessages(prev => {
            console.log('📝 Messages in setState:', prev);
            const updated = [...prev];
            let found = false;
            
            // Find the last user message with placeholder text
            for (let i = updated.length - 1; i >= 0; i--) {
              console.log(`📝 Checking message ${i}:`, updated[i].type, updated[i].content);
              if (updated[i].type === 'user' && updated[i].content === 'Transcribing...') {
                console.log('📝 Found message to update at index:', i);
                updated[i] = { ...updated[i], content: data.transcription };
                found = true;
                break;
              }
            }
            
            if (!found) {
              console.warn('⚠️ Could not find Transcribing... message to update');
            }
            
            console.log('📝 Updated messages:', updated);
            return updated;
          });
          // Now start showing AI typing indicator
          setIsAiTyping(true);
        } else if (data.type === 'processing_status') {
          // Processing status - don't show AI typing yet if still transcribing
          if (data.message !== 'Transcribing audio...') {
            setIsAiTyping(data.status === 'processing');
          }
        } else if (data.type === 'ai_stream_start') {
          // Backend streaming flag ON: a new AI turn begins. Create the
          // in-progress bubble now and reset a fresh audio play-queue for it.
          // Guarded so an oddly-shaped message can't crash the handler.
          try {
            setIsAiTyping(false);
            const bubbleId = `stream-${Date.now()}`;
            streamingTurnRef.current = {
              active: true,
              simulationId: data.simulation_id ?? null,
              messageId: bubbleId,
            };
            resetStreamAudioQueue(bubbleId);
            if (data.emotion) setCurrentEmotion(data.emotion);
            const bubble: Message = {
              id: bubbleId,
              type: 'ai',
              content: '',
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, bubble]);
          } catch (err) {
            console.error('❌ Failed to handle ai_stream_start:', err);
          }
        } else if (data.type === 'ai_reply_delta') {
          // Incremental text — append to the in-progress bubble (typewriter).
          try {
            const st = streamingTurnRef.current;
            const text = typeof data.text === 'string' ? data.text : '';
            if (st.active && st.messageId && text) {
              const targetId = st.messageId;
              setMessages(prev =>
                prev.map(m =>
                  m.id === targetId ? { ...m, content: m.content + text } : m
                )
              );
            }
          } catch (err) {
            console.error('❌ Failed to handle ai_reply_delta:', err);
          }
        } else if (data.type === 'ai_audio_chunk') {
          // Decode one base64 audio clip and push it onto the sequential queue.
          // On any failure, mark the turn's playback failed so ai_response falls
          // back to audio_url — never crash the turn.
          try {
            const st = streamingTurnRef.current;
            if (st.active) {
              const b64 = data.audio_b64;
              const mime = typeof data.mime === 'string' ? data.mime : 'audio/mpeg';
              const seq = typeof data.seq === 'number' ? data.seq : 0;
              if (typeof b64 === 'string' && b64) {
                enqueueStreamClip(seq, decodeBase64ToObjectUrl(b64, mime));
              }
            }
          } catch (err) {
            console.error('❌ Failed to decode/queue ai_audio_chunk:', err);
            audioQueueRef.current.failed = true;
            stopStreamAudio();
          }
        } else if (data.type === 'ai_response') {
          setIsAiTyping(false);

          // Store chat_id if received
          if (data.chat_id && !currentChatId) {
            setCurrentChatId(data.chat_id);
            console.log('💾 Chat ID received:', data.chat_id);
          }

          // Update emotion if provided
          if (data.emotion) {
            console.log('😊 Emotion received from WebSocket:', data.emotion);
            console.log('🎭 Available emotions:', currentPersona?.emotions ? Object.keys(currentPersona.emotions) : 'none');
            setCurrentEmotion(data.emotion);
          }

          // Update current reaction name if provided by router LLM via n8n.
          // Right-panel progress widget maps this to a Case.phase via
          // phase.reaction_ids[].
          if (data.reaction_name) {
            setCurrentReactionName(data.reaction_name);
          }

          const { dividers, cleanContent } = parseStageMarkers(data.message);
          const baseId = Date.now();

          // Programmatic divider: backend (n8n "Prepare data" node) includes
          // reaction_name in ai_response. When it transitions to a mapped
          // pattern (e.g. /^post_visit/), we inject a divider once. This is
          // independent of the LLM-marker path and acts as the primary signal;
          // <<DIVIDER:...>> from parseStageMarkers stays as a manual fallback.
          const incomingReaction: string | null = data.reaction_name ?? null;
          const reactionChanged =
            incomingReaction && incomingReaction !== lastReactionRef.current;
          const reactionDividerKey = reactionChanged
            ? getReactionDividerKey(incomingReaction)
            : null;
          const reactionDividerText = reactionDividerKey ? t(reactionDividerKey) : null;
          if (incomingReaction) {
            lastReactionRef.current = incomingReaction;
          }
          if (
            reactionDividerText &&
            !dividers.some(d => d === reactionDividerText)
          ) {
            dividers.push(reactionDividerText);
          }

          // A turn is "streamed" when ai_stream_start arrived before this
          // ai_response. Then the bubble already exists and its audio already
          // played chunk-by-chunk, so we finalize in place and don't auto-play
          // audio_url. Flag OFF → ai_stream_start never arrives → false → the
          // original append path below runs unchanged.
          const streamedTurn = streamingTurnRef.current;
          const isStreamed =
            streamedTurn.active &&
            !!streamedTurn.messageId &&
            (!data.simulation_id ||
              !streamedTurn.simulationId ||
              data.simulation_id === streamedTurn.simulationId);

          const dividerMessages: Message[] = dividers.map((text, i) => ({
            id: `${baseId}-divider-${i}`,
            type: 'divider',
            content: text,
            timestamp: new Date(),
          }));

          if (!isStreamed) {
            const aiMessage: Message = {
              id: baseId.toString(),
              type: 'ai',
              content: cleanContent,
              timestamp: new Date(),
              audioUrl: data.audio_url
            };
            const newMessages: Message[] = [...dividerMessages, aiMessage];

            // Check if this is the first bot message using ref (avoids stale closure issues)
            if (!firstBotMessageSetRef.current) {
              // This is the first bot message - save it for sidebar and add to chat
              firstBotMessageSetRef.current = true;
              setFirstBotMessage(cleanContent);
              setMessages(prev => [...prev, ...newMessages]);
              console.log('✅ First bot message saved for sidebar and added to chat:', cleanContent);
            } else {
              // Not the first message - add to chat normally
              setMessages(prev => [...prev, ...newMessages]);
              console.log('✅ AI message added to chat:', cleanContent);
            }
          } else {
            // Streamed turn: replace the in-progress bubble's text with the
            // authoritative final `message`, keep audio_url for the replay
            // button, and inject any dividers just before the bubble.
            const targetId = streamedTurn.messageId;
            setMessages(prev => {
              const idx = prev.findIndex(m => m.id === targetId);
              if (idx === -1) {
                // Bubble vanished (shouldn't happen) — don't lose the reply.
                return [
                  ...prev,
                  ...dividerMessages,
                  {
                    id: baseId.toString(),
                    type: 'ai',
                    content: cleanContent,
                    timestamp: new Date(),
                    audioUrl: data.audio_url,
                  } as Message,
                ];
              }
              const updated = [...prev];
              updated[idx] = { ...updated[idx], content: cleanContent, audioUrl: data.audio_url };
              if (dividerMessages.length) updated.splice(idx, 0, ...dividerMessages);
              return updated;
            });
            if (!firstBotMessageSetRef.current) {
              firstBotMessageSetRef.current = true;
              setFirstBotMessage(cleanContent);
            }
            // Streamed chunks already played; only fall back to audio_url if the
            // streamed playback failed, so the user still hears the reply.
            if (audioQueueRef.current.failed && data.audio_url) {
              try {
                new Audio(data.audio_url).play().catch(err =>
                  console.error('❌ Fallback audio_url playback failed:', err)
                );
              } catch (err) {
                console.error('❌ Fallback audio_url playback threw:', err);
              }
            }
            streamingTurnRef.current = { active: false, simulationId: null, messageId: null };
            console.log('✅ Streamed AI turn finalized:', cleanContent);
          }
          // Show recommend action button when AI sends a new message
          if (isHrVersion) {
            setShowRecommendAction(true);
          }
        } else if (data.type === 'simulation_ended') {
          // n8n LLM 1 router signals `should_end: true` when the dialogue
          // reached a clear close (target terms agreed / breakdown / safety /
          // explicit wrap-up request). We treat this as a SUGGESTION — surface
          // a non-blocking toast with a "Finish" action. The player always
          // decides when to actually end (customer's explicit requirement).
          setIsAiTyping(false);
          console.log('💡 AI suggests end-of-dialog:', data);

          if (data.simulation_id && !currentChatId) {
            setCurrentChatId(data.simulation_id);
          }

          if (endSuggestionShownRef.current) return;
          endSuggestionShownRef.current = true;

          toast({
            title: t('simulation.endSuggestion.title'),
            description: t('simulation.endSuggestion.description'),
            duration: 30000,
            action: (
              <ToastAction
                altText={t('simulation.endSuggestion.finish')}
                onClick={() => {
                  setShowEndSimulationModal(true);
                }}
              >
                {t('simulation.endSuggestion.finish')}
              </ToastAction>
            ),
          });
        }
      };

      wsService.on(eventName, handler);

      return () => {
        console.log('Cleaning up WebSocket handler for', eventName);
        wsService.off(eventName, handler);
        // Don't disconnect here - might be used by other components
      };
    };

    // The handler is registered before connecting, and its teardown is
    // returned to React. Previously both were inside an async function whose
    // returned cleanup React never saw: handlers piled up across remounts, and
    // a failed initial connect skipped registration entirely, so replies that
    // arrived after a later reconnect had nowhere to land.
    const teardown = setupHandler();
    wsService.connect(token || undefined).catch(error => {
      // Not fatal: the service retries with backoff and flushes queued turns.
      console.error('❌ Initial WebSocket connect failed, retrying in background:', error);
    });

    return teardown;
  }, [caseId]); // Removed currentCase from dependencies to avoid reconnecting

  // Initialize with AI greeting message (only for new sessions without history)
  useEffect(() => {
    // Show initial message only if we have a case and no messages loaded from history
    if (currentCase && messages.length === 0 && testsCompleted && !showPreLaunchTest) {
      const initialMessage: Message = {
        id: '1',
        type: 'ai',
        content: extractLocalizedContent(currentCase.intro_text || '', language) || t('simulation.initialBotMessage'),
        timestamp: new Date()
      };
      // Save first bot message for sidebar and add to chat
      if (!firstBotMessage) {
        setFirstBotMessage(initialMessage.content);
        firstBotMessageSetRef.current = true; // Mark as set
        setMessages([initialMessage]);
        console.log('✅ First bot message saved for sidebar and added to chat');
        // Show recommend action button when AI sends initial message
        if (isHrVersion) {
          setShowRecommendAction(true);
        }
      }
    }
  }, [currentCase, messages.length, testsCompleted, showPreLaunchTest, firstBotMessage, t]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start timer after tests completed
  useEffect(() => {
    if (testsCompleted && !timerAutoStart) {
      startTimer();
    }
  }, [testsCompleted, timerAutoStart, startTimer]);

  // End-of-dialog reminder popup: fires at 15/25/35 min after timer starts,
  // each stays for 2 min unless the user dismisses it.
  useEffect(() => {
    if (!timerAutoStart) return;
    const openAtMs = [15 * 60_000, 25 * 60_000, 35 * 60_000];
    const autoHideMs = 2 * 60_000;
    const timers: number[] = [];
    openAtMs.forEach((openAt) => {
      timers.push(
        window.setTimeout(() => {
          setEndReminderOpen(true);
          timers.push(window.setTimeout(() => setEndReminderOpen(false), autoHideMs));
        }, openAt)
      );
    });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      setEndReminderOpen(false);
    };
  }, [timerAutoStart]);

  // Warn user before page unload during video recording (but don't force stop)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isVideoRecording) {
        const message = t('simulation.beforeUnloadWarning');
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isVideoRecording, t]);

  // Handle navigation (back/forward buttons) during recording
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isVideoRecording) {
        const shouldLeave = window.confirm(t('simulation.beforeUnloadWarning'));
        if (shouldLeave) {
          console.log('⚠️ User navigating away - stopping recording');
          setShouldStopRecording(true);
          // Allow navigation to proceed
        } else {
          // Push current state back to prevent navigation
          e.preventDefault();
          window.history.pushState(null, '', window.location.href);
        }
      }
    };

    if (isVideoRecording) {
      window.addEventListener('popstate', handlePopState);
      // Push a dummy state to intercept back button
      window.history.pushState(null, '', window.location.href);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isVideoRecording, t]);

  // Simulate waveform animation during recording
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setRecordingWaveform(prev => [
          ...prev.slice(-20),
          Math.random() * 100
        ]);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setRecordingWaveform([]);
    }
  }, [isRecording]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !caseId) return;

    console.log('🔍 Debug - handleSendMessage called with currentChatId:', currentChatId);
    
    const messageText = inputText.trim();
    setInputText(''); // Clear input first

    // Ensure we have a chat_id before sending
    let chatIdToUse = currentChatId;
    
    if (!chatIdToUse) {
      console.log('📝 No chat ID available, need to create chat first');
      // For now, just show an error - chat should be created when entering simulation
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: 'Chat not initialized. Please refresh the page.',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
      // Show recommend action button when AI sends a message (even if error)
      if (isHrVersion) {
        setShowRecommendAction(true);
      }
      setInputText(messageText); // Restore the input
      return;
    }

    // Send message with existing chatId
    await sendMessageWithChatId(chatIdToUse, messageText);
  };

  const sendMessageWithChatId = async (chatId: string, messageText: string) => {
    console.log('🔍 Debug - sendMessageWithChatId called with:', { chatId, messageText });
    
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    // Hide recommend action button when user sends a message
    setShowRecommendAction(false);

    // wsService queues the turn and reconnects on its own if the socket is
    // down, so there is no "not connected" branch here: a turn is never
    // dropped, and the connection banner reports a stalled link instead of
    // faking a reply that never came.
    logEvent('user_sent_message', { sent: true });
    setIsAiTyping(true);
    sendTurn({
      type: 'text_message',
      simulation_id: chatId,
      content: messageText,
      lang: language
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
      if (!caseId) return;

      let stream: MediaStream | null = null;
      try {
        const savedMicId = localStorage.getItem('selectedMicrophoneId');
        const getUserMediaConstraints: MediaStreamConstraints = savedMicId
          ? { audio: { deviceId: { exact: savedMicId } } }
          : { audio: true };
        stream = await navigator.mediaDevices.getUserMedia(getUserMediaConstraints);

        // Basic check - if getUserMedia succeeded, we have access to microphone
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error('No audio tracks available');
        }

        // Log track info for debugging
        const activeTrack = audioTracks[0];
        console.log('🎤 Audio track state:', {
          id: activeTrack.id,
          label: activeTrack.label,
          enabled: activeTrack.enabled,
          muted: activeTrack.muted,
          readyState: activeTrack.readyState
        });

        // If getUserMedia succeeded, start recording - microphone is available
        // Modern browsers/OS allow multiple apps to use microphone simultaneously
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
            console.log('🎤 Audio data received:', event.data.size, 'bytes');
          }
        };

        // Handle MediaRecorder errors
        mediaRecorder.onerror = (event) => {
          console.error('❌ MediaRecorder error:', event);
          const errorMessage: Message = {
            id: Date.now().toString(),
            type: 'ai',
            content: t('simulation.recordingError') || 'Recording error occurred. Please try again.',
            timestamp: new Date(),
            isError: true
          };
          setMessages(prev => [...prev, errorMessage]);
          setIsRecording(false);
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
          if (isHrVersion) {
            setShowRecommendAction(true);
          }
        };

        mediaRecorder.onstop = async () => {
          // Check if we actually recorded anything
          if (audioChunksRef.current.length === 0 || 
              audioChunksRef.current.every(chunk => chunk.size === 0)) {
            console.error('❌ No audio data was recorded');
            const errorMessage: Message = {
              id: Date.now().toString(),
              type: 'ai',
              content: t('simulation.noAudioRecorded') || 'No audio was recorded. Please try again.',
              timestamp: new Date(),
              isError: true
            };
            setMessages(prev => [...prev, errorMessage]);
            if (isHrVersion) {
              setShowRecommendAction(true);
            }
            if (stream) {
              stream.getTracks().forEach(track => track.stop());
            }
            return;
          }

          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          // Create URL for playback
          const audioUrl = URL.createObjectURL(audioBlob);

          // Add user message to UI with audio URL
          const recordedMessage: Message = {
            id: Date.now().toString(),
            type: 'user',
            content: 'Transcribing...',
            timestamp: new Date(),
            audioUrl: audioUrl
          };
          setMessages(prev => [...prev, recordedMessage]);

          // Convert to base64 and send
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            
            // Ensure we have a chat_id before sending
            let chatIdToUse = currentChatId;
            
            if (!chatIdToUse) {
              console.log('📝 No chat ID available for audio');
              // Show error message
              const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: 'Chat not initialized. Please refresh the page.',
                timestamp: new Date(),
                isError: true
              };
              setMessages(prev => [...prev, errorMessage]);
              // Show recommend action button when AI sends a message (even if error)
              if (isHrVersion) {
                setShowRecommendAction(true);
              }
              return;
            }

            // Send via WebSocket
            if (wsService.isConnected()) {
              console.log('🎤 Sending audio message via WebSocket, chat_id:', chatIdToUse);
              logEvent('user_sent_message', { sent: true, type: 'audio' });
              console.log('🎤 Current message ID:', recordedMessage.id);
              console.log('🎤 Current message content:', recordedMessage.content);
              // Don't set isAiTyping here - wait for transcription to complete first
              const timestamp = Date.now();
              const fileName = `audio_message_${timestamp}.webm`;
              sendTurn({
                type: 'audio_message',
                simulation_id: chatIdToUse,
                audio_data: base64Audio,
                file_name: fileName,
                format: 'webm',
                lang: language
              });
            } else {
              console.error('❌ WebSocket not connected');
            }
          };
          reader.readAsDataURL(audioBlob);

          // Stop all tracks
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        console.log('🎤 Recording started');
      } catch (error: any) {
        console.error('Failed to start recording:', error);
        
        // Clean up stream if it was created
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        // Provide specific error messages based on error type
        let errorMessage = t('simulation.micAccessError') || 'Failed to access microphone';
        
        if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
          errorMessage = t('simulation.micPermissionError') || 'Microphone permission denied. Please allow microphone access in your browser settings.';
        } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
          errorMessage = t('simulation.micNotFoundError') || 'No microphone found. Please connect a microphone and try again.';
        } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
          // NotReadableError can occur if microphone is exclusively locked by another app
          // But in most modern systems, multiple apps can share microphone
          errorMessage = t('simulation.micAccessError') || 'Failed to access microphone. Please check your microphone settings.';
        } else if (error?.message) {
          errorMessage = error.message;
        }
        
        // Show error message to user
        const userErrorMessage: Message = {
          id: Date.now().toString(),
          type: 'ai',
          content: errorMessage,
          timestamp: new Date(),
          isError: true
        };
        setMessages(prev => [...prev, userErrorMessage]);
        if (isHrVersion) {
          setShowRecommendAction(true);
        }
        
        // Also show alert for immediate feedback
        alert(errorMessage);
      }
    }
  };

  const handleTestsComplete = async () => {
    console.log('🧪 Tests completed');
    // IMPORTANT: Set tests completed BEFORE closing dialog to prevent VideoRecorder unmount
    setTestsCompleted(true);

    // Small delay to ensure state updates before closing dialog
    setTimeout(() => {
      setShowPreLaunchTest(false);
      console.log('ℹ️ Using existing chat:', currentChatId, 'Tests completed, VideoRecorder should mount now');
    }, 100);
  };

  const handleDownloadTranscript = async (format: 'txt' | 'pdf') => {
    if (!currentChatId || isTranscriptDownloading) return;
    setIsTranscriptDownloading(true);
    try {
      const blob = await transcriptService.downloadTranscript(String(currentChatId), format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `simulation-transcript-${currentChatId}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: 'Transcript download failed',
        description: error?.message || 'The saved transcript could not be downloaded.',
        variant: 'destructive',
      });
    } finally {
      setIsTranscriptDownloading(false);
    }
  };

  const formatTime = (date: Date): string => {
    return formatTimestamp(date, language === 'uk' ? 'uk-UA' : 'en-US');
  };

  // Helper function to get icon for action
  const getActionIcon = (actionId: string) => {
    switch (actionId) {
      // HR (Oleg) non-verbal cues
      case 'look-around': return Eye;
      case 'nod': return MessageCircle;
      case 'shake-head': return X;
      case 'pause-think': return Clock;
      case 'show-confusion': return AlertTriangle;
      // TradeBV (Sarah) named actions — defined per-persona under
      // Persona.actions in admin; the label is also the id.
      case 'Visit production site': return Camera;
      case 'Show detailed price proposal': return MessageSquare;
      case 'Share internal volume commitment': return Settings;
      case 'Summarise and move to closure': return Compass;
      default: return MessageCircle;
    }
  };

  // Bump monotonic phase index when a newer reaction arrives that maps
  // to a later phase. Used by the right-panel Progress widget so the bar
  // never goes backward.
  useEffect(() => {
    const phases = currentCase?.phases ?? [];
    if (!currentReactionName || phases.length === 0) return;
    const idx = phases.findIndex(p =>
      (p.reaction_ids && p.reaction_ids.includes(currentReactionName))
      || p.id === currentReactionName
    );
    if (idx > maxPhaseIndex) setMaxPhaseIndex(idx);
  }, [currentReactionName, currentCase, maxPhaseIndex]);

  // Get non-verbal actions from persona data
  const nonVerbalActions = currentPersona?.actions ? Object.entries(currentPersona.actions).map(([id]) => {
    const i18nKey = `simulation.actionButtons.${id}`;
    const translated = t(i18nKey);
    const rawLabel = currentPersona?.action_labels?.[id] ?? '';
    const rawDesc = currentPersona?.action_descriptions?.[id] ?? '';
    const rawChatMessage = currentPersona?.action_chat_messages?.[id] ?? '';
    const rawPopupText = currentPersona?.action_popup_texts?.[id] ?? '';
    // Localised button caption comes from persona data (multi-locale markers);
    // fall back to the static i18n table, then to the raw action id.
    const label = rawLabel
      ? extractLocalizedContent(rawLabel, language)
      : translated === i18nKey ? id : translated;
    const chatMessage = rawChatMessage ? extractLocalizedContent(rawChatMessage, language) : label;
    const popupText = rawPopupText ? extractLocalizedContent(rawPopupText, language) : '';
    return {
      id,
      label,
      description: rawDesc ? extractLocalizedContent(rawDesc, language) : '',
      chatMessage,
      popupText,
      icon: getActionIcon(id),
    };
  }) : [];

  const handleNonVerbalAction = (action: { id: string; label: string; chatMessage: string; popupText: string }) => {
    setPendingAction({ id: action.id, label: action.label, chatMessage: action.chatMessage, popupText: action.popupText });
  };

  const executeNonVerbalAction = async (action: { id: string; label: string; chatMessage: string; popupText?: string }) => {
    const actionMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: action.chatMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, actionMessage]);

    try {
      setIsAiTyping(true);

      sendTurn({
        type: 'non_verbal',
        action: action.id,
        simulation_id: currentChatId,
        lang: language
      });
    } catch (error) {
      console.error('Failed to send non-verbal action:', error);
      setIsAiTyping(false);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Failed to send action. Please try again.',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
      if (isHrVersion) {
        setShowRecommendAction(true);
      }
    }
  };

  const handleTimerExpire = useCallback(async () => {
    stopTimer();
    setIsEndingSimulation(true);

    const chatIdToUse = currentChatId;
    if (!chatIdToUse) {
      navigate('/cases');
      setIsEndingSimulation(false);
      return;
    }

    const pendingWebcam = hasRecordingConsent && !isRecordingUploadComplete;
    const pendingSession = hasSessionRecording && !isSessionRecordingUploadComplete;

    if (hasRecordingConsent && isVideoRecording) {
      setShouldStopRecording(true);
    }
    if (hasSessionRecording && isSessionRecording) {
      setShouldStopSessionRecording(true);
    }

    if (!pendingWebcam && !pendingSession) {
      await completeSimulation(chatIdToUse, true);
    }
  }, [currentChatId, hasRecordingConsent, isRecordingUploadComplete, hasSessionRecording, isSessionRecordingUploadComplete, isVideoRecording, isSessionRecording, stopTimer, navigate, completeSimulation]);

  const handleEndSimulation = async () => {
    stopTimer();
    setShowEndSimulationModal(false);
    setIsEndingSimulation(true);

    // Ensure we have a chat_id before ending simulation
    let chatIdToUse = currentChatId;
    
    if (!chatIdToUse) {
      console.log('📝 No chat ID available for ending simulation');
      // Just navigate to cases page if no chat was created
      navigate('/cases');
      setIsEndingSimulation(false);
      return;
    }

    const pendingWebcam = hasRecordingConsent && !isRecordingUploadComplete;
    const pendingSession = hasSessionRecording && !isSessionRecordingUploadComplete;

    // If recording is active, stop it and wait for upload completion
    if (hasRecordingConsent && isVideoRecording) {
      console.log('🎥 Recording is active - stopping recording and waiting for upload...');
      setShouldStopRecording(true);
    }

    if (hasSessionRecording && isSessionRecording) {
      console.log('🖥️ Screen recording is active - stopping it before completion');
      setShouldStopSessionRecording(true);
    }

    if (!pendingWebcam && !pendingSession) {
      // No uploads pending - proceed immediately
      await completeSimulation(chatIdToUse, true);
    }
  };

  const captureScreenshot = async () => {
    if (!chatAreaRef.current) {
      console.error('Chat area ref not found');
      return;
    }

    try {
      setIsCapturingScreenshot(true);

      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;

      // Capture the chat area (excluding modals)
      const canvas = await html2canvas(chatAreaRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true
      });

      // Convert to base64
      const screenshotData = canvas.toDataURL('image/png');
      setScreenshot(screenshotData);
      setIsCapturingScreenshot(false);
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      setIsCapturingScreenshot(false);
    }
  };

  const submitFeedback = async () => {
    try {
      await apiClient.post('/feedback', {
        page: `simulation/${caseId}`,
        has_accepted_grade: false,
        case_id: caseId || null,
        persona_id: currentPersona?.id || null,
        chat_id: currentChatId || null,
        text: feedbackText,
        screenshot_data: screenshot || undefined,
        source: 'simulation'
      });

      console.log('Feedback submitted successfully');

      // Reset feedback form
      setFeedbackText('');
      setScreenshot(null);
      setShowFeedbackModal(false);

      // Show success message
      // TODO: Add toast notification if available
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      // TODO: Show error message to user
    }
  };

  const resetFeedbackForm = () => {
    setFeedbackText('');
    setScreenshot(null);
    setShowFeedbackModal(false);
  };

  if (isLoadingCase) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">{t('simulation.loadingCase')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if case failed to load
  if (caseLoadError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">{caseLoadError.title}</h2>
            <p className="text-muted-foreground mb-4">{caseLoadError.message}</p>
            <Button onClick={() => navigate('/cases')} variant="outline">
              {t('simulation.backToCases')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!currentCase) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">{t('simulation.errors.notFoundTitle')}</h2>
            <p className="text-muted-foreground">{t('simulation.errors.notFoundMessage')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PreLaunchTest
        // Keep media permissions out of the text-only path. The open state is
        // also held until the persona snapshot has loaded so a legacy default
        // cannot briefly flash the equipment dialog.
        open={showPreLaunchTest && currentPersona !== null && voiceEnabled}
        voiceEnabled={voiceEnabled}
        onOpenChange={(open) => {
          // Don't allow closing the dialog unless tests are completed
          if (!open && !testsCompleted) {
            return; // Block closing
          }
          setShowPreLaunchTest(open);
        }}
        onTestComplete={handleTestsComplete}
      />

      <Dialog open={showTranscriptDialog} onOpenChange={setShowTranscriptDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Conversation transcript
            </DialogTitle>
            <DialogDescription>
              Saved conversation messages from this session. The transcript remains available while a report is still generating.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="min-h-0 flex-1 pr-4">
            <div className="space-y-3 py-2">
              {isSavedTranscriptLoading && savedTranscriptMessages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading saved transcript…</p>
              ) : savedTranscriptError ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{savedTranscriptError}</p>
              ) : savedTranscriptMessages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No saved messages yet.</p>
              ) : (
                savedTranscriptMessages.map((message, index) => {
                  const isParticipant = message.message_type === 'human';
                  const speaker = message.message_type === 'system'
                    ? 'System'
                    : isParticipant
                      ? savedTranscriptParticipantName
                      : savedTranscriptPersonaName;
                  return (
                    <div key={`${message.turn_sequence ?? index}-${message.turn_ordinal ?? ''}-${index}`} className={`flex ${isParticipant ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg border px-4 py-3 ${isParticipant ? 'border-primary/20 bg-primary/5' : 'bg-muted/40'}`}>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{speaker}</div>
                        <p className="whitespace-pre-wrap break-words text-sm">{message.message_text}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => handleDownloadTranscript('txt')} disabled={!currentChatId || isTranscriptDownloading}>
              {isTranscriptDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download text
            </Button>
            <Button type="button" variant="outline" onClick={() => handleDownloadTranscript('pdf')} disabled={!currentChatId || isTranscriptDownloading}>
              {isTranscriptDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    {/* Covers the recording-upload + navigation wait after "End" so the chat UI doesn't look frozen. */}
    {isEndingSimulation && (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-4 px-6 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="max-w-sm text-sm text-muted-foreground">
            {t('simulation.finishingResults')}
          </p>
        </div>
      </div>
    )}

    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row animate-fade-in">
      {/* Persona Avatar Section (HR version only) */}
      {isHrVersion && (
        <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r bg-card p-4 lg:p-6 flex flex-col lg:max-h-[50vh] lg:max-h-none" style={{ overflowY: 'auto' }}>
          <PersonaChatAvatar
            persona={{
              name: currentPersona?.name || t('simulation.personaNameFallback'),
              role: extractLocalizedContent(currentCase.title, language),
              currentEmotion: currentEmotion,
              image: (() => {
                // Find the emotion image from the persona's emotions object
                const emotions = currentPersona?.emotions;
                if (emotions && typeof emotions === 'object') {
                  // Try to find emotion by exact key match (case-insensitive)
                  const emotionKey = Object.keys(emotions).find(
                    key => key.toLowerCase() === currentEmotion.toLowerCase()
                  );
                  if (emotionKey && emotions[emotionKey]?.image_url) {
                    return emotions[emotionKey].image_url;
                  }
                }
                // Fallback to base avatar
                return currentPersona?.avatar_base_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentCase.id}`;
              })()
            }}
            className="mb-4 lg:mb-6"
          />

          {/* Persona Description */}
          {currentPersona?.persona_description && (
            <div className="mb-4 lg:mb-6 space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">{t('simulation.sidebar.personaDescription')}</h3>
              <div className="bg-muted/50 rounded-lg p-3 border">
                <RichTextContent html={extractLocalizedContent(currentPersona.persona_description, language)} className="text-sm" plainHeadings />
              </div>
            </div>
          )}

          <div className="flex-1 space-y-4">
            {currentPersona && (
              <>
                {/* User Role Description */}
                {userRoleDescription && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm text-muted-foreground">{t('simulation.sidebar.userRole')}</h3>
                    <p className="text-sm whitespace-pre-wrap">{userRoleDescription}</p>
                  </div>
                )}
              </>
            )}

            <div>
              <h3 className="font-medium mb-2">{t('simulation.personaInfo.currentState')}</h3>
              <Badge variant="secondary">{t('simulation.personaInfo.online')}</Badge>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-auto">
              <Dialog open={showPersonaInfoModal} onOpenChange={setShowPersonaInfoModal}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 text-xs sm:text-sm relative z-10 h-9" title={t('simulation.personaInfo.title')}>
                    <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">{t('simulation.personaInfo.title')}</span>
                    <span className="sm:hidden">{t('simulation.personaInfo.title')}</span>
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>
        </div>
      )}

      {/* Resizable chat + right panel.
          Group renders unconditionally; the right ResizablePanel + handle
          are only mounted when persona/case actually has data for the
          Actions/Brief/Progress widgets. PanelGroup with a single panel
          collapses to that panel taking the full width, so legacy cases
          without a right panel behave the same as before. */}
      {(() => {
        // Right panel currently only hosts the Actions list. Brief items and
        // Progress widget were removed per Nastya's spec — the case schema
        // fields (brief_items, phases) are still populated so we can reintroduce
        // them later without a migration, just no UI right now.
        const hasRightPanelData = !!(currentChatId && nonVerbalActions.length > 0);

        return (
      <ResizablePanelGroup
        direction="horizontal"
        autoSaveId="tradebv-simulation-panels"
        className="flex-1 flex min-w-0"
      >
      <ResizablePanel defaultSize={72} minSize={35} className="overflow-hidden">
      <div className="h-full flex flex-col min-h-0 overflow-hidden">

      {/* Messages Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="p-3 sm:p-6 flex-shrink-0 bg-background z-10 border-b">
          <div className="flex flex-col gap-3">
            {/* Top row: title + timer + Feedback + End */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="flex items-center space-x-2 text-base sm:text-lg min-w-0 sm:flex-1">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="truncate">{t('simulation.titleWithCase', { title: extractLocalizedContent(currentCase.title, language) })}</span>
              </CardTitle>
              {currentCase && (
                <div className="flex items-center justify-center order-2 sm:order-none flex-shrink-0">
                  <SimulationTimer
                    duration={currentCase?.timer_time ?? 2700}
                    autoStart={timerAutoStart}
                    onExpire={handleTimerExpire}
                    warningThreshold={600}
                    className="text-2xl sm:text-3xl font-bold text-foreground whitespace-nowrap"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2 order-3 sm:order-none flex-shrink-0 sm:flex-1 sm:justify-end">
                {/* Feedback Button */}
                <Dialog open={showFeedbackModal} onOpenChange={setShowFeedbackModal}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                      <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      {t('simulation.personaInfo.feedback')}
                    </Button>
                  </DialogTrigger>
                </Dialog>
                {/* End Simulation Button with Modal */}
                <div className="relative">
                  <Dialog open={showEndSimulationModal} onOpenChange={setShowEndSimulationModal}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs sm:text-sm"
                        disabled={isEndingSimulation}
                      >
                        <Square className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        {isEndingSimulation ? t('simulation.ending') : t('simulation.endButton')}
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                  {endReminderOpen && (
                    <div
                      role="status"
                      className="absolute top-full right-0 mt-2 w-72 sm:w-80 z-30 rounded-lg border border-primary/30 bg-background shadow-lg p-3 flex items-start gap-2 animate-in fade-in slide-in-from-top-2"
                    >
                      <p className="text-xs sm:text-sm text-foreground leading-snug flex-1">
                        {t('simulation.endReminder.message')}
                      </p>
                      <button
                        type="button"
                        onClick={() => setEndReminderOpen(false)}
                        aria-label={t('simulation.endReminder.dismiss')}
                        className="flex-shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step row: HR-only helpers + 3 case-intro content modals */}
            {currentCase && (
              <div className="flex flex-wrap gap-2">
                {showRecommendAction && isHrVersion && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs sm:text-sm flex items-center gap-1">
                        Recommend Action
                        <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => {
                        console.log('Selected action: Action 1');
                        setShowRecommendAction(false);
                      }}>
                        Action 1
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        console.log('Selected action: Action 2');
                        setShowRecommendAction(false);
                      }}>
                        Action 2
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        console.log('Selected action: Action 3');
                        setShowRecommendAction(false);
                      }}>
                        Action 3
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {isHrVersion && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs sm:text-sm"
                    onClick={() => setShowNavigationModal(true)}
                  >
                    <Compass className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    {t('simulation.navigation.button')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm bg-background"
                  onClick={() => setShowTranscriptDialog(true)}
                  disabled={!currentChatId}
                >
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Transcript
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm bg-background"
                  onClick={() => setShowStepModal(1)}
                >
                  {t('simulation.stepButtons.step1')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm bg-background"
                  onClick={() => setShowStepModal(2)}
                >
                  {t('simulation.stepButtons.step2')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm bg-background"
                  onClick={() => setShowStepModal(3)}
                >
                  {t('simulation.stepButtons.step3')}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        {/* Video Recorder - show after tests completed and chat created */}
        {(() => {
          const shouldShowRecorder = voiceEnabled && testsCompleted && currentChatId != null;
          console.log('🎥 VideoRecorder render check:', {
            voiceEnabled,
            testsCompleted,
            currentChatId,
            shouldShowRecorder
          });

          return shouldShowRecorder ? (
            <div className="px-3 sm:px-6 pt-4 space-y-3">
              <VideoRecorder
                key="simulation-video-recorder"
                chatId={String(currentChatId)}
                autoStart={true}
                shouldStop={shouldStopRecording}
                onStopped={() => setShouldStopRecording(false)}
                onRecordingComplete={(url) => {
                  console.log('✅ Recording uploaded successfully:', url);
                  setIsRecordingUploadComplete(true);
                }}
                onRecordingStateChange={(recording) => {
                  console.log('🎥 Recording state changed:', recording);
                  setIsVideoRecording(recording);
                  // Reset upload complete state when recording starts
                  if (recording) {
                    setIsRecordingUploadComplete(false);
                  }
                }}
                onConsentChange={setHasRecordingConsent}
              />

              {/* Hidden UI, functionality stays */}
              <div className="hidden">
                <SessionRecorder
                  chatId={String(currentChatId)}
                  autoStart
                  shouldStop={shouldStopSessionRecording}
                  onStopped={() => setShouldStopSessionRecording(false)}
                  onRecordingComplete={(url) => {
                    console.log('✅ Simulation recording uploaded successfully:', url);
                    setIsSessionRecordingUploadComplete(true);
                  }}
                  onRecordingStateChange={(recording) => {
                    console.log('🖥️ Session recording state changed:', recording);
                    setIsSessionRecording(recording);
                    if (recording) {
                      setHasSessionRecording(true);
                      setIsSessionRecordingUploadComplete(false);
                    }
                  }}
                />
              </div>

            </div>
          ) : null;
        })()}

        <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 sm:px-6">
          <ScrollArea className="flex-1">
              <div ref={chatAreaRef} className="space-y-3 sm:space-y-4 py-3 sm:py-4">
                {messages.map((message) => (
                  message.type === 'divider' ? (
                    <div key={message.id} className="flex justify-center my-2 px-4">
                      <div className="text-xs text-muted-foreground italic text-center max-w-[80%]">
                        — {message.content} —
                      </div>
                    </div>
                  ) : message.isError ? (
                    <div key={message.id} className="flex justify-center my-2 px-4">
                      <div className="max-w-[85%] rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive text-center">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                  <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start space-x-3 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className="flex-shrink-0">
                        {message.type === 'ai' ? (
                          <img
                            src={currentPersona?.avatar_base_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentCase.id}`}
                            alt={currentPersona?.name || t('simulation.personaAltFallback')}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-white text-xs font-medium">{t('simulation.userLabel')}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className={`rounded-lg p-3 shadow-sm ${
                          message.type === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : message.isError
                              ? 'bg-destructive/10 border border-destructive text-destructive'
                              : 'bg-card border'
                        }`}>
                          {message.content === 'Transcribing...' ? (
                            <div className="flex items-center space-x-2">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-primary-foreground rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                                <div className="w-2 h-2 bg-primary-foreground rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                                <div className="w-2 h-2 bg-primary-foreground rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                              </div>
                              <span className="text-sm">Transcribing...</span>
                            </div>
                          ) : (
                            <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
                          )}
                          {voiceEnabled && message.audioUrl && message.content !== 'Transcribing...' && (
                            <AudioPlayer
                              audioUrl={message.audioUrl}
                              text={message.content}
                              className="mt-2"
                              messageId={message.id}
                              playingMessageId={playingAudioMessageId}
                              onPlayingChange={(id, isPlaying) =>
                                setPlayingAudioMessageId((prev) =>
                                  isPlaying ? id : prev === id ? null : prev
                                )
                              }
                              disabled={isRecording}
                            />
                          )}
                        </div>
                        <div className={`flex items-center space-x-1 mt-1 ${
                          message.type === 'user' ? 'justify-end' : 'justify-start'
                        }`}>
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  )
                ))}

                {/* AI is typing indicator */}
                {isAiTyping && (
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-3 max-w-[80%]">
                      <div className="flex-shrink-0">
                        <img
                          src={currentPersona?.avatar_base_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentCase?.id}`}
                          alt={currentPersona?.name || t('simulation.personaAltFallback')}
                          className="w-8 h-8 rounded-full"
                        />
                      </div>
                      <div className="flex flex-col">
                        <div className="rounded-lg p-3 shadow-sm bg-card border">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                          </div>
                        </div>
                        {aiTypingTookLong && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t('simulation.aiThinkingLong', { name: currentPersona?.name || t('simulation.personaNameFallback') })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
              </ScrollArea>
          </div>
          
          {/* Input Area */}
          <div className="border-t p-3 sm:p-4 space-y-3 sm:space-y-4 flex-shrink-0">
            {connectionState !== 'connected' && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
              >
                <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-amber-500" />
                <span>{t('simulation.connectionReconnecting')}</span>
              </div>
            )}

            {/* Input Mode Buttons */}
            <div className="flex justify-center space-x-2">
              <Button
                variant={inputMode === 'text' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInputMode('text')}
                className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm"
              >
                <Keyboard className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{t('simulation.inputMode.text')}</span>
              </Button>
              {voiceEnabled && (
                <Button
                  variant={inputMode === 'audio' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInputMode('audio')}
                  className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm"
                >
                  <Mic className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{t('simulation.inputMode.audioRecording')}</span>
                  <span className="sm:hidden">{t('simulation.inputMode.audio')}</span>
                </Button>
              )}
            </div>

            {/* Input Controls */}
            {inputMode === 'text' && (
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t('simulation.inputPlaceholder')}
                    className="flex-1 text-sm sm:text-base"
                  />
                  <Button onClick={handleSendMessage} disabled={!inputText.trim()} size="sm" className="flex-shrink-0">
                    <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
                
                {/* Non-verbal Actions Dropdown (HR version only) */}
                {isHrVersion && (
                  <div className="flex justify-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-background border-input hover:bg-accent text-xs sm:text-sm">
                          <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">{t('simulation.nonVerbalActionsButton')}</span>
                          <span className="sm:hidden">{t('simulation.nonVerbalActionsMobile')}</span>
                          <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        className="w-48 bg-background border border-border shadow-lg z-50"
                        align="center"
                      >
                        {nonVerbalActions.map((action) => (
                          <DropdownMenuItem
                            key={action.id}
                            onClick={() => handleNonVerbalAction(action)}
                            className="flex items-center space-x-2 px-3 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer"
                          >
                            <action.icon className="h-4 w-4" />
                            <span>{action.label}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            )}

            {voiceEnabled && inputMode === 'audio' && (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <Button
                    onClick={toggleRecording}
                    variant={isRecording ? 'destructive' : 'default'}
                    size="lg"
                    className="rounded-full w-16 h-16"
                    disabled={playingAudioMessageId != null}
                  >
                    {isRecording ? (
                      <Square className="h-6 w-6" />
                    ) : (
                      <Mic className="h-6 w-6" />
                    )}
                  </Button>
                </div>
                {isRecording && (
                  <div className="space-y-2">
                    <p className="text-center text-sm text-destructive animate-pulse">
                      🔴 {t('simulation.recordingActive')}
                    </p>
                    <div className="flex justify-center items-end space-x-1 h-12">
                      {recordingWaveform.map((height, index) => (
                        <div
                          key={index}
                          className="w-1 bg-primary rounded-full transition-all duration-100"
                          style={{ height: `${Math.max(4, height * 0.4)}px` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Navigation Modal */}
      <Dialog open={showNavigationModal} onOpenChange={setShowNavigationModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('simulation.navigation.title')}</DialogTitle>
            <DialogDescription>
              {t('simulation.navigation.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-md p-3 bg-muted/40 whitespace-pre-wrap text-sm">
            {currentCase.simulation_navigation?.trim() || t('simulation.navigation.empty')}
          </div>
        </DialogContent>
      </Dialog>

      {/* End Simulation Modal */}
      <Dialog open={showEndSimulationModal} onOpenChange={setShowEndSimulationModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('simulation.endDialog.title')}</DialogTitle>
            <DialogDescription className="space-y-2">
              <div>{t('simulation.endDialog.description')}</div>
              {voiceEnabled && (hasRecordingConsent || hasSessionRecording) && (
                <div className="text-warning font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t('simulation.endDialog.recordingWarning')}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowEndSimulationModal(false)} className="w-full sm:w-auto">
              {t('simulation.endDialog.continue')}
            </Button>
            <Button variant="destructive" onClick={handleEndSimulation} className="w-full sm:w-auto">
              {t('simulation.endDialog.endSimulation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal */}
      <Dialog open={showFeedbackModal} onOpenChange={setShowFeedbackModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('simulation.feedbackDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('simulation.feedbackDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('simulation.feedbackDialog.label')}</label>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={t('simulation.feedbackDialog.placeholder')}
                className="min-h-[100px]"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={captureScreenshot}
                disabled={isCapturingScreenshot}
              >
                <Camera className="h-4 w-4 mr-2" />
                {isCapturingScreenshot ? t('simulation.feedbackDialog.capturingScreenshot') : t('simulation.feedbackDialog.addScreenshot')}
              </Button>
              {screenshot && (
                <span className="text-sm text-success">{t('simulation.feedbackDialog.screenshotAdded')}</span>
              )}
            </div>
            {screenshot && (
              <div className="border rounded p-2">
                <img src={screenshot} alt="Screenshot" className="max-w-full h-20 object-cover rounded" />
              </div>
            )}
          </div>
          <DialogFooter className="flex space-x-2">
            <Button variant="outline" onClick={resetFeedbackForm}>
              {t('simulation.feedbackDialog.cancel')}
            </Button>
            <Button onClick={submitFeedback} disabled={!feedbackText.trim()}>
              {t('simulation.feedbackDialog.submit')}
            </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

      {/* Persona Info Modal */}
      <Dialog open={showPersonaInfoModal} onOpenChange={setShowPersonaInfoModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('simulation.personaInfo.title')}</DialogTitle>
            <DialogDescription>
              {t('simulation.personaInfo.description')}
            </DialogDescription>
          </DialogHeader>
          {currentPersona && (
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="flex items-start space-x-4">
                <img
                  src={currentPersona.avatar_base_url || (currentCase?.id ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentCase.id}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentPersona.id}`)}
                  alt={currentPersona.name}
                  className="w-24 h-24 rounded-full border-2 border-primary object-cover"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{currentPersona.name}</h3>
                  {currentCase?.role_in_simulation && (
                    <div className="text-sm text-muted-foreground">
                      <span>{t('simulation.personaInfo.role')}: </span>
                      <RichTextContent html={extractLocalizedContent(currentCase.role_in_simulation, language)} className="text-sm text-muted-foreground inline" />
                    </div>
                  )}
                  {currentPersona.persona_description && (
                    <div className="text-sm text-muted-foreground mt-2">
                      <RichTextContent html={extractLocalizedContent(currentPersona.persona_description, language)} className="text-sm" plainHeadings />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPersonaInfoModal(false)}>
              {t('simulation.personaInfo.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 1/2/3 modals (same content as case-intro steps) */}
      <Dialog open={showStepModal != null} onOpenChange={(open) => !open && setShowStepModal(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {showStepModal === 1 && t('member.caseIntro.roleInSimulation')}
              {showStepModal === 2 && t('member.caseIntro.personaDescription')}
              {showStepModal === 3 && t('member.caseIntro.caseOverview')}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto py-4 flex-1 min-h-0">
            <RichTextContent
              html={extractLocalizedContent(
                showStepModal === 1
                  ? (currentCase?.role_in_simulation ?? t('simulation.personaInfo.noDescription'))
                  : showStepModal === 2
                    ? (currentCase?.persona_description ?? currentPersona?.persona_description ?? t('simulation.personaInfo.noDescription'))
                    : showStepModal === 3
                      ? (currentCase?.case_overview ?? t('simulation.personaInfo.noDescription'))
                      : '',
                language,
              )}
              className="leading-relaxed"
              plainHeadings
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStepModal(null)}>
              {t('simulation.personaInfo.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
       </div>
       </ResizablePanel>

       {hasRightPanelData && (
         <>
           <ResizableHandle withHandle className="hidden lg:flex" />
           <ResizablePanel
             defaultSize={28}
             minSize={18}
             maxSize={50}
             className="hidden lg:flex"
           >
             <aside className="h-full w-full flex flex-col gap-5 border-l bg-background p-5 overflow-y-auto">
               {nonVerbalActions.length > 0 && (
                 <div>
                   <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                     {t('simulation.rightPanel.actions')}
                   </p>
                   <div className="flex flex-col gap-1.5">
                     {nonVerbalActions.map(action => (
                       <button
                         key={action.id}
                         type="button"
                         disabled={isAiTyping || isRecording || isEndingSimulation}
                         onClick={() => handleNonVerbalAction(action)}
                         title={action.description ? `${action.label}\n${action.description}` : action.label}
                         className="flex w-full items-start gap-2.5 rounded-[9px] border border-border bg-background p-2.5 text-left hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                       >
                         <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[7px] bg-primary/10 text-primary">
                           <action.icon className="h-4 w-4" />
                         </div>
                         <div className="min-w-0 flex-1">
                           <div className="text-[13px] font-medium text-foreground whitespace-normal break-words">{action.label}</div>
                           {action.description && (
                             <div className="mt-0.5 text-[11px] text-muted-foreground whitespace-normal break-words">{action.description}</div>
                           )}
                         </div>
                       </button>
                     ))}
                   </div>
                 </div>
               )}

             </aside>
           </ResizablePanel>
         </>
       )}
       </ResizablePanelGroup>
        );
      })()}
    </div>

    <AlertDialog
      open={pendingAction !== null}
      onOpenChange={(open) => { if (!open) setPendingAction(null); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pendingAction?.label || t('simulation.confirmAction.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingAction?.popupText || t('simulation.confirmAction.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('simulation.confirmAction.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const action = pendingAction;
              setPendingAction(null);
              if (action) void executeNonVerbalAction(action);
            }}
          >
            {t('simulation.confirmAction.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default Simulation;
