import React from 'react';
import { PersonaAvatar } from '@/components/PersonaAvatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PersonaChatAvatarProps {
  persona: {
    name: string;
    role?: string;
    currentEmotion?: string;
    image?: string;
  };
  className?: string;
}

export const PersonaChatAvatar: React.FC<PersonaChatAvatarProps> = ({
  persona,
  className = ''
}) => {
  return (
    <Card className={`p-4 w-full max-w-sm mx-auto ${className}`}>
      <div className="flex flex-col items-center space-y-3">
        <PersonaAvatar
          src={persona.image}
          name={persona.name}
          emotion={persona.currentEmotion as any}
          size="xl"
        />
        
        <div className="text-center space-y-1">
          <h3 className="font-semibold text-sm">{persona.name}</h3>
          {persona.role && (
            <p className="text-xs text-muted-foreground">{persona.role}</p>
          )}
          
          {persona.currentEmotion && (
            <Badge variant="secondary" className="text-xs">
              {persona.currentEmotion}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
};
