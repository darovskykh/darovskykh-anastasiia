import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  MessageSquare, 
  BookOpen, 
  Search, 
  Plus,
  AlertCircle,
  Database,
  FileX,
  UserX
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = AlertCircle,
  title,
  description,
  action,
  className = ""
}) => (
  <Card className={`border-dashed ${className}`}>
    <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="btn-touch">
          <Plus className="h-4 w-4 mr-2" />
          {action.label}
        </Button>
      )}
    </CardContent>
  </Card>
);

export const NoUsersFound = () => {
  const { t } = useLanguage();
  return (
    <EmptyState
      icon={UserX}
      title={t('users.noUsersFound')}
      description={t('users.noUsersFoundDesc')}
    />
  );
};

export const NoFeedbackFound = () => {
  const { t } = useLanguage();
  return (
    <EmptyState
      icon={MessageSquare}
      title={t('feedback.noFeedback')}
      description={t('feedback.noFeedbackAvailable')}
    />
  );
};

export const NoCasesFound = () => (
  <EmptyState
    icon={BookOpen}
    title="No training cases"
    description="Create your first training case to start building interactive learning experiences for your users."
    action={{
      label: "Create Case",
      onClick: () => console.log("Create case clicked")
    }}
  />
);

export const NoSearchResults = () => {
  const { t } = useLanguage();
  return (
    <EmptyState
      icon={Search}
      title={t('users.noSearchResults')}
      description={t('users.noSearchResultsDesc')}
    />
  );
};

export const NoDataAvailable = () => (
  <EmptyState
    icon={Database}
    title="No data available"
    description="There's no data to display at the moment. Data will appear here once it becomes available."
  />
);

export const ErrorState = ({ onRetry }: { onRetry?: () => void }) => (
  <EmptyState
    icon={AlertCircle}
    title="Something went wrong"
    description="We couldn't load the data. Please try again or contact support if the problem persists."
    action={onRetry ? {
      label: "Try Again",
      onClick: onRetry
    } : undefined}
  />
);