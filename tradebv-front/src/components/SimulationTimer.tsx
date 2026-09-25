import React, { useState, useEffect, useRef } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';

interface SimulationTimerProps {
  duration: number; // в секундах
  autoStart?: boolean;
  onExpire?: () => void;
  onWarning?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  warningThreshold?: number; // по умолчанию 600 (10 минут)
  className?: string;
}

const SimulationTimer: React.FC<SimulationTimerProps> = ({
  duration,
  autoStart = false,
  onExpire,
  onWarning,
  onStart,
  onStop,
  warningThreshold = 600,
  className = ''
}) => {
  const { t } = useLanguage();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const warningShownRef = useRef<boolean>(false);
  const expireTriggeredRef = useRef<boolean>(false);
  const startTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    if (autoStart && !isActive && !startTriggeredRef.current) {
      const now = Date.now();
      endTimeRef.current = now + duration * 1000;
      expireTriggeredRef.current = false;
      warningShownRef.current = false;
      setShowWarning(false);
      setRemaining(duration);
      setIsActive(true);
      startTriggeredRef.current = true;
      if (onStart) onStart();
    } else if (!autoStart && startTriggeredRef.current) {
      startTriggeredRef.current = false;
    }
  }, [autoStart, duration, isActive, onStart]);

  useEffect(() => {
    if (!isActive || !endTimeRef.current) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      if (!endTimeRef.current) return;
      const now = Date.now();
      const newRemaining = Math.max(Math.ceil((endTimeRef.current - now) / 1000), 0);
      setRemaining(newRemaining);

      if (newRemaining <= warningThreshold && newRemaining > 0 && !warningShownRef.current) {
        warningShownRef.current = true;
        setShowWarning(true);
        if (onWarning) onWarning();
      }

      if (newRemaining <= 0 && !expireTriggeredRef.current) {
        expireTriggeredRef.current = true;
        setIsActive(false);
        if (onExpire) onExpire();
        if (onStop) onStop();
      }
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, duration, warningThreshold, onExpire, onWarning, onStop]);

  const formatTime = (seconds: number | null): string => {
    if (seconds === null) {
      return `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;
    }
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  return (
    <>
      <span className={className}>{formatTime(remaining)}</span>
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('simulation.timerWarning.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('simulation.timerWarning.message')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={() => setShowWarning(false)}>
            {t('simulation.timerWarning.ok')}
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SimulationTimer;
