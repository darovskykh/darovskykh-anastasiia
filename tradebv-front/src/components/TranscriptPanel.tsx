import React from 'react';
import { Download, FileText, Loader2, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TranscriptMessage } from '@/services/transcriptService';

interface TranscriptPanelProps {
  messages: TranscriptMessage[];
  isLoading?: boolean;
  error?: string | null;
  onDownload?: (format: 'txt' | 'pdf') => void;
  isDownloading?: boolean;
  className?: string;
  personaName?: string;
  participantName?: string;
}

const roleLabel = (messageType: string, personaName: string, participantName: string): string => {
  if (messageType === 'human') return participantName;
  if (messageType === 'system') return 'System';
  return personaName;
};

const TranscriptRows: React.FC<{ messages: TranscriptMessage[]; personaName: string; participantName: string }> = ({ messages, personaName, participantName }) => (
  <div className="space-y-3">
    {messages.map((message, index) => {
      const isHuman = message.message_type === 'human';
      return (
        <div key={`${message.turn_sequence ?? index}-${message.turn_ordinal ?? ''}-${index}`} className={`flex ${isHuman ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] rounded-lg border px-4 py-3 ${isHuman ? 'border-primary/20 bg-primary/5' : 'bg-muted/40'}`}>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{roleLabel(message.message_type, personaName, participantName)}</span>
              {message.created_at && <span className="font-normal normal-case">{new Date(message.created_at).toLocaleString()}</span>}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">{message.message_text}</p>
          </div>
        </div>
      );
    })}
  </div>
);

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  messages,
  isLoading = false,
  error,
  onDownload,
  isDownloading = false,
  className,
  personaName = 'Persona',
  participantName = 'Participant',
}) => (
  <Card className={className} data-testid="transcript-panel">
    <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-primary" />
          Conversation transcript
          <span className="text-sm font-normal text-muted-foreground">({messages.length})</span>
        </CardTitle>
        <CardDescription>Saved conversation messages from this session.</CardDescription>
      </div>
      {onDownload && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onDownload('txt')} disabled={isDownloading}>
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download text
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onDownload('pdf')} disabled={isDownloading}>
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
        </div>
      )}
    </CardHeader>
    <CardContent>
      {isLoading && messages.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading saved transcript…</div>
      ) : error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><FileText className="h-8 w-8 opacity-50" />No saved messages yet.</div>
      ) : (
        <ScrollArea className="max-h-[560px] pr-4"><TranscriptRows messages={messages} personaName={personaName} participantName={participantName} /></ScrollArea>
      )}
    </CardContent>
  </Card>
);

export default TranscriptPanel;
