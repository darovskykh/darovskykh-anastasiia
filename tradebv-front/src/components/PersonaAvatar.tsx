import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface PersonaAvatarProps {
  src?: string;
  name: string;
  emotion?: 'happy' | 'neutral' | 'concerned' | 'surprised' | 'thinking';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const PersonaAvatar: React.FC<PersonaAvatarProps> = ({
  src,
  name,
  emotion = 'neutral',
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-16 w-16',
    lg: 'h-24 w-24',
    xl: 'h-32 w-32'
  };

  const emotionStyles = {
    happy: 'border-success ring-success/20',
    neutral: 'border-muted ring-muted/20',
    concerned: 'border-warning ring-warning/20',
    surprised: 'border-accent ring-accent/20',
    thinking: 'border-primary ring-primary/20'
  };

  const getEmotionIndicator = (emotion: string) => {
    const indicators = {
      happy: '😊',
      neutral: '😐',
      concerned: '😟',
      surprised: '😲',
      thinking: '🤔'
    };
    return indicators[emotion as keyof typeof indicators] || '😐';
  };

  return (
    <div className={cn('relative', className)}>
      <Avatar 
        className={cn(
          sizeClasses[size],
          'border-2 ring-4',
          emotionStyles[emotion],
          'transition-all duration-300'
        )}
      >
        <AvatarImage src={src} alt={name} className="object-cover" />
        <AvatarFallback className="bg-muted">
          {name.split(' ').map(n => n[0]).join('').toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      {/* Emotion indicator */}
      <div className="absolute -bottom-1 -right-1 text-xs bg-background rounded-full p-1 border shadow-sm">
        {getEmotionIndicator(emotion)}
      </div>
    </div>
  );
};
