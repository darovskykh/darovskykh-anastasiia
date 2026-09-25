import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl?: string;
  text: string;
  className?: string;
  /** Id of this message — used to allow only one audio playing at a time */
  messageId?: string;
  /** Id of the message whose audio is currently playing (from parent). When another id, this player pauses. */
  playingMessageId?: string | null;
  /** Notify parent when this instance starts or stops playing */
  onPlayingChange?: (messageId: string, isPlaying: boolean) => void;
  /** If true, playback is disabled (e.g., during user recording) */
  disabled?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  audioUrl, 
  text,
  className = "",
  messageId = "",
  playingMessageId = null,
  onPlayingChange,
  disabled = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!audioUrl) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, [audioUrl]);

  // When another message's audio is playing, pause this one (no parallel playback)
  useEffect(() => {
    if (playingMessageId !== null && playingMessageId !== undefined && playingMessageId !== messageId && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, [playingMessageId, messageId, isPlaying]);

  // Pause playback when recording is active (disabled mode)
  useEffect(() => {
    if (disabled && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      if (messageId && onPlayingChange) onPlayingChange(messageId, false);
    }
  }, [disabled, isPlaying, messageId, onPlayingChange]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl || disabled) {
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (messageId && onPlayingChange) onPlayingChange(messageId, false);
    } else {
      if (messageId && onPlayingChange) onPlayingChange(messageId, true);
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
            if (messageId && onPlayingChange) onPlayingChange(messageId, false);
          });
      } else {
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  const formatTime = (time: number): string => {
    if (!Number.isFinite(time) || time < 0) {
      return '0:00';
    }
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const timeLabel = duration > 0
    ? `${formatTime(currentTime)} / ${formatTime(duration)}`
    : formatTime(currentTime);

  return (
    <div className={`flex items-center space-x-3 p-2 bg-muted/50 rounded-lg ${className}`}>
      {/* Play/Pause Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlay}
        className="h-8 w-8 p-0 hover:bg-muted"
        disabled={!audioUrl || disabled}
        aria-label={isPlaying ? 'Pause audio sample' : `Play audio sample${text ? ` for "${text}"` : ''}`}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      {/* Progress Bar */}
      <div className="flex-1 space-y-1">
        <div className="relative h-1 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-center text-xs text-muted-foreground font-mono">
          {timeLabel}
        </div>
      </div>

      {/* Mute Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleMute}
        className="h-8 w-8 p-0 hover:bg-muted"
        disabled={!audioUrl}
        aria-label={isMuted ? 'Unmute audio sample' : 'Mute audio sample'}
      >
        {isMuted ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </Button>

      {/* Hidden audio element for future use */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          crossOrigin="anonymous"
          muted={isMuted}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration);
            }
          }}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
            if (messageId && onPlayingChange) onPlayingChange(messageId, false);
          }}
        />
      )}
    </div>
  );
};
