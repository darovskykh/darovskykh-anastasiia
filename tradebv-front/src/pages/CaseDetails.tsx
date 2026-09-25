import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  Clock,
  Users,
  Target,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Volume2,
  Mic,
  Video,
  Settings,
  Pause,
  Square,
  RotateCcw,
  Bot,
  Loader2
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { extractLocalizedContent } from '@/utils/localizedContent';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const CaseDetails: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { canAccessCase } = useAuth();

  // Equipment test states
  const [audioTestActive, setAudioTestActive] = useState(false);
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [videoTestActive, setVideoTestActive] = useState(false);

  // Agent simulation state
  const [agentSimulationLoading, setAgentSimulationLoading] = useState(false);
  const [startSimulationLoading, setStartSimulationLoading] = useState(false);
  
  // Simulate audio test
  const handleAudioTest = () => {
    setAudioTestActive(true);
    setTimeout(() => setAudioTestActive(false), 3000); // Auto-stop after 3 seconds
  };
  
  // Simulate recording
  const handleRecording = () => {
    if (recordingActive) {
      setRecordingActive(false);
      setRecordedAudio('mock-recording'); // Simulate recorded audio
    } else {
      setRecordingActive(true);
    }
  };
  
  // Simulate video test
  const handleVideoTest = () => {
    setVideoTestActive(true);
    setTimeout(() => setVideoTestActive(false), 5000); // Auto-stop after 5 seconds
  };

  // Handle agent simulation start
  const handleStartSimulation = async () => {
    setStartSimulationLoading(true);
    try {
      // Import apiClient and ApiError type
      const { apiClient } = await import('@/services/api');
      type ApiError = import('@/services/api').ApiError;
      
      // Create chat first - response IS the data envelope
      const response = await apiClient.post<{ 
        event: string;
        success: boolean;
        data: { 
          id: number;
          user_id: string;
          case_id: number;
          name: string;
          [key: string]: any;
        };
        error: any;
      }>(
        `/simulation/start/${caseId}`
      );
      
      // response is already the envelope with { event, success, data, error }
      const chatId = response.data.id;
      console.log('💾 Chat created:', chatId);
      
      // Navigate to simulation with just the chat ID
      navigate(`/simulation/${chatId}`);
    } catch (error) {
      console.error('Failed to create chat:', error);
      
      const apiError = error as ApiError;
      let errorMessage = t('caseDetails.toast.startErrorDefault');
      let errorTitle = t('caseDetails.toast.errorTitle');

      // Handle specific error codes
      if (apiError.status === 403) {
        errorTitle = t('caseDetails.toast.forbiddenTitle');
        if (apiError.details?.message === "You don't have access to this case") {
          errorMessage = t('caseDetails.toast.forbiddenNoCase');
        } else {
          errorMessage = t('caseDetails.toast.forbiddenGeneric');
        }
      } else if (apiError.status === 404) {
        errorTitle = t('caseDetails.toast.notFoundTitle');
        errorMessage = t('caseDetails.toast.notFoundMessage');
      } else if (apiError.status === 401) {
        errorTitle = t('caseDetails.toast.authTitle');
        errorMessage = t('caseDetails.toast.authMessage');
      } else if (apiError.message) {
        errorMessage = apiError.details?.message || apiError.message;
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setStartSimulationLoading(false);
    }
  };

  const handleStartAgentSimulation = async () => {
    setAgentSimulationLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/simulation/start/${caseId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      const data = await response.json();

      if (data.success === false && data.error) {
        toast({
          variant: 'destructive',
          title: t('caseDetails.toast.agentInDevTitle'),
          description: data.error.message || t('caseDetails.toast.agentInDevFallback'),
        });
      } else if (data.success) {
        toast({
          title: t('caseDetails.toast.agentStartedTitle'),
          description: t('caseDetails.toast.agentStartedDescription'),
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('caseDetails.toast.errorTitle'),
        description: t('caseDetails.toast.agentStartErrorDescription'),
      });
    } finally {
      setAgentSimulationLoading(false);
    }
  };

  const caseData = {
    'case-1': {
      title: t('caseDetails.mock.case1.title'),
      description: t('caseDetails.mock.case1.description'),
      duration: t('caseDetails.mock.case1.duration'),
      difficulty: t('caseDetails.mock.case1.difficulty'),
      participants: t('caseDetails.mock.case1.participants'),
      objectives: [
        t('caseDetails.mock.case1.objective1'),
        t('caseDetails.mock.case1.objective2'),
        t('caseDetails.mock.case1.objective3'),
        t('caseDetails.mock.case1.objective4'),
      ],
      instructions: [
        t('caseDetails.mock.case1.instruction1'),
        t('caseDetails.mock.case1.instruction2'),
        t('caseDetails.mock.case1.instruction3'),
        t('caseDetails.mock.case1.instruction4'),
        t('caseDetails.mock.case1.instruction5'),
        t('caseDetails.mock.case1.instruction6'),
      ],
      aiPersona: {
        name: t('caseDetails.mock.case1.personaName'),
        role: t('caseDetails.mock.case1.personaRole'),
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=anna',
        description: t('caseDetails.mock.case1.personaDescription'),
      },
      status: 'available',
    },
    'case-2': {
      title: t('caseDetails.mock.case2.title'),
      description: t('caseDetails.mock.case2.description'),
      duration: t('caseDetails.mock.case2.duration'),
      difficulty: t('caseDetails.mock.case2.difficulty'),
      participants: t('caseDetails.mock.case2.participants'),
      objectives: [
        t('caseDetails.mock.case2.objective1'),
        t('caseDetails.mock.case2.objective2'),
        t('caseDetails.mock.case2.objective3'),
        t('caseDetails.mock.case2.objective4'),
      ],
      instructions: [
        t('caseDetails.mock.case2.instruction1'),
        t('caseDetails.mock.case2.instruction2'),
        t('caseDetails.mock.case2.instruction3'),
        t('caseDetails.mock.case2.instruction4'),
        t('caseDetails.mock.case2.instruction5'),
        t('caseDetails.mock.case2.instruction6'),
      ],
      aiPersona: {
        name: t('caseDetails.mock.case2.personaName'),
        role: t('caseDetails.mock.case2.personaRole'),
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
        description: t('caseDetails.mock.case2.personaDescription'),
      },
      status: 'available',
    },
  };

  const currentCase = caseData[caseId as keyof typeof caseData];

  if (!currentCase) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">{t('caseDetails.notFound.title')}</h2>
            <p className="text-muted-foreground">{t('caseDetails.notFound.description')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {extractLocalizedContent(currentCase.title, language)}
          </h1>
          <p className="text-muted-foreground text-lg">
            {currentCase.description}
          </p>
        </div>
        <Badge className="bg-primary text-primary-foreground">
          {currentCase.difficulty}
        </Badge>
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center space-x-3">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">{t('caseDetails.info.duration')}</p>
              <p className="font-semibold">{currentCase.duration}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center space-x-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">{t('caseDetails.info.participants')}</p>
              <p className="font-semibold">{currentCase.participants}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center space-x-3">
            <Target className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">{t('caseDetails.info.level')}</p>
              <p className="font-semibold">{currentCase.difficulty}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Persona */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>{t('caseDetails.aiPersona.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start space-x-4">
            <img
              src={currentCase.aiPersona.avatar}
              alt={currentCase.aiPersona.name}
              className="w-16 h-16 rounded-full"
            />
            <div>
              <h3 className="font-semibold text-lg">{currentCase.aiPersona.name}</h3>
              <p className="text-primary font-medium">{currentCase.aiPersona.role}</p>
              <p className="text-muted-foreground mt-1">{currentCase.aiPersona.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Learning Objectives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>{t('caseDetails.objectives.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {currentCase.objectives.map((objective, index) => (
              <li key={index} className="flex items-start space-x-2">
                <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5" />
            <span>{t('caseDetails.instructions.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-success mb-2 flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>{t('caseDetails.instructions.allowed')}</span>
            </h4>
            <ul className="space-y-1 ml-6">
              {currentCase.instructions
                .filter((i, idx) => !(idx === 4 || idx === 5))
                .map((instruction, index) => (
                  <li key={index} className="text-sm">• {instruction}</li>
                ))}
              <li className="text-sm">• {currentCase.instructions[5]}</li>
            </ul>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium text-destructive mb-2 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{t('caseDetails.instructions.forbidden')}</span>
            </h4>
            <ul className="space-y-1 ml-6">
              <li className="text-sm">• {currentCase.instructions[4]}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Equipment Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>{t('caseDetails.equipment.title')}</span>
          </CardTitle>
          <CardDescription>
            {t('caseDetails.equipment.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="audio" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="audio" className="flex items-center space-x-2">
                <Volume2 className="h-4 w-4" />
                <span>{t('caseDetails.equipment.tabs.audio')}</span>
              </TabsTrigger>
              <TabsTrigger value="recording" className="flex items-center space-x-2">
                <Mic className="h-4 w-4" />
                <span>{t('caseDetails.equipment.tabs.recording')}</span>
              </TabsTrigger>
              <TabsTrigger value="video" className="flex items-center space-x-2">
                <Video className="h-4 w-4" />
                <span>{t('caseDetails.equipment.tabs.video')}</span>
              </TabsTrigger>
            </TabsList>

            {/* Audio Test Tab */}
            <TabsContent value="audio" className="mt-6">
              <Card>
                <CardContent className="p-6 text-center space-y-4">
                  <Volume2 className="h-12 w-12 text-primary mx-auto" />
                  <h3 className="text-lg font-semibold">{t('caseDetails.equipment.audio.title')}</h3>
                  <p className="text-muted-foreground">
                    {t('caseDetails.equipment.audio.description')}
                  </p>
                  <div className="flex justify-center space-x-4">
                    <Button
                      onClick={handleAudioTest}
                      disabled={audioTestActive}
                      className="min-w-[120px]"
                    >
                      {audioTestActive ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          {t('caseDetails.equipment.audio.playing')}
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          {t('caseDetails.equipment.audio.start')}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setAudioTestActive(false)}
                      disabled={!audioTestActive}
                    >
                      <Square className="h-4 w-4 mr-2" />
                      {t('caseDetails.equipment.audio.stop')}
                    </Button>
                  </div>
                  {audioTestActive && (
                    <div className="text-sm text-success">
                      {t('caseDetails.equipment.audio.success')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Voice Recording Tab */}
            <TabsContent value="recording" className="mt-6">
              <Card>
                <CardContent className="p-6 text-center space-y-4">
                  <Mic className="h-12 w-12 text-primary mx-auto" />
                  <h3 className="text-lg font-semibold">{t('caseDetails.equipment.recording.title')}</h3>
                  <p className="text-muted-foreground">
                    {t('caseDetails.equipment.recording.description')}
                  </p>
                  <div className="flex justify-center space-x-4">
                    <Button
                      onClick={handleRecording}
                      variant={recordingActive ? "destructive" : "default"}
                      className="min-w-[120px]"
                    >
                      {recordingActive ? (
                        <>
                          <Square className="h-4 w-4 mr-2" />
                          {t('caseDetails.equipment.recording.stop')}
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4 mr-2" />
                          {t('caseDetails.equipment.recording.start')}
                        </>
                      )}
                    </Button>
                    {recordedAudio && (
                      <Button variant="outline" onClick={() => setRecordedAudio(null)}>
                        <Play className="h-4 w-4 mr-2" />
                        {t('caseDetails.equipment.recording.play')}
                      </Button>
                    )}
                  </div>
                  {recordingActive && (
                    <div className="text-sm text-destructive animate-pulse">
                      🔴 {t('simulation.recordingActive')} {t('caseDetails.equipment.recording.speakHint')}
                    </div>
                  )}
                  {recordedAudio && (
                    <div className="text-sm text-success">
                      {t('caseDetails.equipment.recording.success')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Video Test Tab */}
            <TabsContent value="video" className="mt-6">
              <Card>
                <CardContent className="p-6 text-center space-y-4">
                  <Video className="h-12 w-12 text-primary mx-auto" />
                  <h3 className="text-lg font-semibold">{t('caseDetails.equipment.video.title')}</h3>
                  <p className="text-muted-foreground">
                    {t('caseDetails.equipment.video.description')}
                  </p>
                  <div className="flex justify-center space-x-4">
                    <Button
                      onClick={handleVideoTest}
                      disabled={videoTestActive}
                      className="min-w-[120px]"
                    >
                      {videoTestActive ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          {t('caseDetails.equipment.audio.playing')}
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          {t('caseDetails.equipment.audio.start')}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setVideoTestActive(false)}
                      disabled={!videoTestActive}
                    >
                      <Square className="h-4 w-4 mr-2" />
                      {t('caseDetails.equipment.audio.stop')}
                    </Button>
                  </div>
                  {videoTestActive && (
                    <div className="space-y-2">
                      <div className="w-full h-32 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
                        <Play className="h-8 w-8 text-primary animate-pulse" />
                      </div>
                      <div className="text-sm text-success">
                        {t('caseDetails.equipment.video.success')}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 pt-6">
        {caseId && !canAccessCase(caseId) ? (
          <Card className="bg-destructive/10 border-destructive">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('caseDetails.access.title')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('caseDetails.access.description')}
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/cases')}
              >
                {t('caseDetails.access.backToCases')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
        <Button
          size="lg"
          className="px-12 py-3 text-lg font-semibold hover:scale-105 transition-transform"
          onClick={handleStartSimulation}
          disabled={startSimulationLoading || (caseId && !canAccessCase(caseId))}
        >
          {startSimulationLoading ? (
            <>
              <Loader2 className="h-6 w-6 mr-3 animate-spin" />
              {t('caseDetails.actions.creatingChat')}
            </>
          ) : (
            <>
              <Play className="h-6 w-6 mr-3" />
              {t('caseDetails.actions.startSimulation')}
            </>
          )}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="px-12 py-3 text-lg font-semibold hover:scale-105 transition-transform"
          onClick={handleStartAgentSimulation}
          disabled={agentSimulationLoading}
        >
          {agentSimulationLoading ? (
            <>
              <Loader2 className="h-6 w-6 mr-3 animate-spin" />
              {t('caseDetails.actions.starting')}
            </>
          ) : (
            <>
              <Bot className="h-6 w-6 mr-3" />
              {t('caseDetails.actions.startWithAgent')}
            </>
          )}
        </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default CaseDetails;
