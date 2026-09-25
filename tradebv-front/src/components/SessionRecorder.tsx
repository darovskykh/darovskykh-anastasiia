import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { sessionRecordingService } from '@/services/sessionRecordingService';
import { Circle, MonitorPlay, Square, Upload } from 'lucide-react';

interface SessionRecorderProps {
  chatId: string;
  shouldStop?: boolean;
  onStopped?: () => void;
  onRecordingComplete?: (recordingUrl: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  autoStart?: boolean;
}

export const SessionRecorder: React.FC<SessionRecorderProps> = ({
  chatId,
  shouldStop = false,
  onStopped,
  onRecordingComplete,
  onRecordingStateChange,
  autoStart = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>();
  const autoStartAttemptedRef = useRef(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      setRecordingTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  useEffect(() => {
    if (shouldStop && isRecording) {
      stopRecording();
      onStopped?.();
    }
  }, [shouldStop, isRecording]);

  useEffect(() => {
    return () => {
      sessionRecordingService.cleanup();
    };
  }, []);

  // Try to start automatically when allowed
  useEffect(() => {
    if (autoStart && !autoStartAttemptedRef.current && !isRecording) {
      autoStartAttemptedRef.current = true;
      startRecording(true);
    }
  }, [autoStart, isRecording]);

  const startRecording = async (isAuto = false) => {
    try {
      await sessionRecordingService.startRecording(chatId);
      setIsRecording(true);
      onRecordingStateChange?.(true);
      if (!isAuto) {
        toast({
          title: t('sessionRecorder.start'),
          description: t('sessionRecorder.description'),
        });
      }
    } catch (error: any) {
      console.error('Failed to start screen recording', error);
      onRecordingStateChange?.(false);
      toast({
        title: t('sessionRecorder.startFailed'),
        description: t('sessionRecorder.startFailedDesc'),
        variant: 'destructive',
      });
    }
  };

  const stopRecording = async () => {
    if (!isRecording && !sessionRecordingService.isRecording()) {
      return;
    }

    try {
      const blob = await sessionRecordingService.stopRecording();
      setIsRecording(false);
      onRecordingStateChange?.(false);
      await uploadRecording(blob);
    } catch (error: any) {
      console.error('Failed to stop screen recording', error);
      setIsRecording(false);
      onRecordingStateChange?.(false);
      toast({
        title: t('sessionRecorder.stopFailed'),
        description: error?.message || t('sessionRecorder.stopFailedDesc'),
        variant: 'destructive',
      });
    }
  };

  const uploadRecording = async (blob: Blob) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const result = await sessionRecordingService.uploadRecording(
        chatId,
        blob,
        (progress) => setUploadProgress(progress)
      );

      onRecordingComplete?.(result.simulation_recording_url);
      toast({
        title: t('sessionRecorder.uploadCompleted'),
        description: t('sessionRecorder.uploadCompletedDesc', {
          size: (result.size_bytes / 1024 / 1024).toFixed(2),
        }),
      });
    } catch (error: any) {
      console.warn('Failed to upload simulation recording, marking as sent anyway', error);
      onRecordingComplete?.('');
      toast({
        title: t('sessionRecorder.uploadCompleted'),
        description: t('sessionRecorder.uploadCompletedDesc', {
          size: (blob.size / 1024 / 1024).toFixed(2),
        }),
      });
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
    <div className="bg-muted/30 border rounded-lg p-3 sm:p-4 space-y-2">
      <div className="flex items-start sm:items-center sm:justify-between gap-3 flex-col sm:flex-row">
        <div>
          <p className="text-sm font-medium">{t('sessionRecorder.title')}</p>
          <p className="text-xs text-muted-foreground">
            {t('sessionRecorder.description')}
          </p>
        </div>
        <div className="flex gap-2">
          {isRecording ? (
            <Button variant="destructive" size="sm" onClick={stopRecording} disabled={isUploading}>
              <Square className="h-4 w-4 mr-2" />
              {t('sessionRecorder.stop')}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={startRecording} disabled={isUploading}>
              <MonitorPlay className="h-4 w-4 mr-2" />
              {t('sessionRecorder.start')}
            </Button>
          )}
        </div>
      </div>

      {isRecording && (
        <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
          <Circle className="h-3 w-3 fill-blue-500 text-blue-500 animate-pulse" />
          <span>{t('sessionRecorder.inProgress')}</span>
          <span className="text-xs text-muted-foreground">{formatTime(recordingTime)}</span>
        </div>
      )}

      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Upload className="h-4 w-4" />
            {t('sessionRecorder.uploading')}
          </div>
          <Progress value={uploadProgress} className="h-1" />
        </div>
      )}
    </div>
  );
};
