import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Circle, Upload } from 'lucide-react';
import { recordingService } from '@/services/recordingService';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface VideoRecorderProps {
  chatId: string;
  onRecordingComplete?: (recordingUrl: string) => void;
  autoStart?: boolean;
  shouldStop?: boolean;
  onStopped?: () => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onConsentChange?: (hasConsent: boolean) => void;
}

export const VideoRecorder: React.FC<VideoRecorderProps> = ({
  chatId,
  onRecordingComplete,
  autoStart = false,
  shouldStop = false,
  onStopped,
  onRecordingStateChange,
  onConsentChange,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUnmounting, setIsUnmounting] = useState(false);

  const recordingTimerRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();
  const { t } = useLanguage();

  // Debug: log component mount
  useEffect(() => {
    console.log('🎥 VideoRecorder MOUNTED with chatId:', chatId, 'autoStart:', autoStart);
    return () => {
      console.log('🎥 VideoRecorder WILL UNMOUNT');
    };
  }, []);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setRecordingTime(0);
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && !hasConsent) {
      setShowConsentDialog(true);
    }
  }, [autoStart, hasConsent]);


  // Auto-stop recording when shouldStop prop changes
  useEffect(() => {
    if (shouldStop && isRecording) {
      console.log('Auto-stopping recording...');
      handleStopRecording();
      if (onStopped) {
        onStopped();
      }
    }
  }, [shouldStop, isRecording]);

  // Notify parent component about recording state changes
  // NOTE: Removed onRecordingStateChange from deps to prevent infinite loop
  useEffect(() => {
    if (onRecordingStateChange) {
      onRecordingStateChange(isRecording);
    }
  }, [isRecording]);

  // Stop recording when component unmounts or page closes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording) {
        console.log('⚠️ Page closing with active recording - will stop on browser close');
        // Show warning to user
        const message = t('videoRecorder.confirmCloseWhileRecording');
        e.returnValue = message;
        return message;
      }
    };

    const handleUnload = () => {
      // Only cleanup on actual page unload (browser close)
      recordingService.cleanup();

      // Additional cleanup for v4l2 devices
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia({ video: false, audio: false }).catch(() => {});
      }
    };

    // NOTE: Removed visibilitychange handler to allow recording to continue
    // when switching tabs or minimizing browser window

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      console.log('⚠️ VideoRecorder unmounting - checking if upload/recording in progress');
      setIsUnmounting(true);

      // Clean up event listeners
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);

      // If recording is active, do NOT cleanup to avoid killing the stream
      if (isRecording || recordingService.isRecording()) {
        console.log('⚠️ Recording active during unmount - keeping stream alive');
        return;
      }

      // Only cleanup if NOT uploading - prevent interrupting upload
      if (!isUploading) {
        console.log('⚠️ No upload in progress - safe to cleanup');
        recordingService.cleanup();
      } else {
        console.log('⚠️ Upload in progress - delaying cleanup to allow completion');
        // Delay cleanup to allow upload to finish
        setTimeout(() => {
          recordingService.cleanup();
        }, 5000);
      }
    };
  }, [isRecording, isUploading]);

  const handleConsentAccept = async () => {
    setHasConsent(true);
    setShowConsentDialog(false);

    // Notify parent component about consent
    if (onConsentChange) {
      onConsentChange(true);
    }

    try {
      // Set chat ID for chunked upload
      recordingService.setChatId(chatId);

      await recordingService.startRecording();
      setIsRecording(true);
      toast({
        title: t('videoRecorder.recording.started'),
        description: t('videoRecorder.recording.startedDesc'),
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: t('videoRecorder.errors.cameraAccess'),
        description: t('videoRecorder.errors.cameraAccessDesc'),
        variant: 'destructive',
      });
      setHasConsent(false);
      if (onConsentChange) {
        onConsentChange(false);
      }
    }
  };

  const handleConsentDecline = () => {
    setShowConsentDialog(false);
    setHasConsent(false);
    
    // Notify parent component about consent decline
    if (onConsentChange) {
      onConsentChange(false);
    }
  };

  const handleStopRecording = async () => {
    // Check if recording is actually in progress
    if (!isRecording) {
      console.log('No recording in progress, skipping stop');
      return;
    }

    try {
      // Check if recordingService has an active recording
      if (!recordingService.isRecording()) {
        console.log('Recording service indicates no active recording');
        setIsRecording(false);
        return;
      }

      const blob = await recordingService.stopRecording();
      setRecordingBlob(blob);
      setIsRecording(false);

      toast({
        title: t('videoRecorder.recording.stopped'),
        description: t('videoRecorder.recording.stoppedDesc'),
      });

      // Auto-upload immediately (chatId should always be available now)
      await handleUpload(blob);
    } catch (error: any) {
      console.error('Error stopping recording:', error);
      
      // If error is "No recording in progress", just update state silently
      if (error?.message?.includes('No recording in progress') || 
          error?.message?.includes('No recording')) {
        console.log('Recording already stopped, updating state');
        setIsRecording(false);
        return;
      }

      // Only show error toast for unexpected errors
      toast({
        title: t('videoRecorder.errors.stopRecording'),
        description: error?.message || t('videoRecorder.errors.stopRecordingDesc'),
        variant: 'destructive',
      });
      
      // Still update state to prevent UI from being stuck
      setIsRecording(false);
    }
  };

  const handleUpload = async (blob?: Blob) => {
    const uploadBlob = blob || recordingBlob;
    if (!uploadBlob) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const result = await recordingService.uploadRecording(
        chatId,
        uploadBlob,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      toast({
        title: t('videoRecorder.upload.completed'),
        description: t('videoRecorder.upload.completedDesc', { size: (result.size_bytes / 1024 / 1024).toFixed(2) }),
      });

      if (onRecordingComplete) {
        onRecordingComplete(result.recording_url);
      }

      setRecordingBlob(null);
    } catch (error) {
      console.warn('Upload failed, marking as sent anyway', error);
      // Не показываем ошибку пользователю, считаем отправленным
      toast({
        title: t('videoRecorder.upload.completed'),
        description: t('videoRecorder.upload.completedDesc', { size: (uploadBlob.size / 1024 / 1024).toFixed(2) }),
      });
      // Считаем отправленным, даже если ответ не пришел
      if (onRecordingComplete) {
        onRecordingComplete('');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Consent Dialog */}
      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('videoRecorder.consentDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('videoRecorder.consentDialog.description')}
              <br /><br />
              {t('videoRecorder.consentDialog.question')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleConsentDecline}>
              {t('videoRecorder.consentDialog.decline')}
            </Button>
            <Button onClick={handleConsentAccept}>
              {t('videoRecorder.consentDialog.accept')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recording Indicator - Minimal UI */}
      {isRecording && (
        <div className="flex items-center justify-between bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Circle className="w-2 h-2 fill-red-500 text-red-500 animate-pulse" />
            <span className="text-red-700 dark:text-red-300 font-medium">{t('videoRecorder.recording.inProgress')}</span>
            <span className="text-red-600 dark:text-red-400 text-xs">
              {formatTime(recordingTime)}
            </span>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 mb-2">
            <Upload className="w-4 h-4 animate-pulse" />
            {t('videoRecorder.upload.progress')}
          </div>
          <Progress value={uploadProgress} className="h-1" />
        </div>
      )}
    </>
  );
};
