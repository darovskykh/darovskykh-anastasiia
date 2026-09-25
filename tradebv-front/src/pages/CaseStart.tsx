import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { invitationService } from '@/services/invitationService';

type Status = 'redeeming' | 'expired' | 'invalid' | 'error';

const CaseStart = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>('redeeming');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await invitationService.redeem(token);
        if (cancelled) return;

        localStorage.setItem('auth_token', result.access_token);
        localStorage.removeItem('auth_user');

        // AuthContext reads localStorage only at first mount, so without an
        // explicit refresh the ProtectedRoute on the intro page would see
        // user=null and bounce us to /login. This fetches /auth/me and
        // populates the context with the fresh user before we navigate.
        await refreshUser();
        if (cancelled) return;

        navigate(`/case-intro/${result.case_id}/step/1`, { replace: true });
      } catch (err: any) {
        if (cancelled) return;
        const httpStatus = err?.status;
        if (httpStatus === 410) {
          setStatus('expired');
        } else if (httpStatus === 404) {
          setStatus('invalid');
        } else {
          setStatus('error');
          setErrorMessage(err?.message || t('caseStart.unknownError'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, navigate, refreshUser, t]);

  if (status === 'redeeming') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p>{t('caseStart.activating')}</p>
        </div>
      </div>
    );
  }

  const titles: Record<Exclude<Status, 'redeeming'>, string> = {
    expired: t('caseStart.title.expired'),
    invalid: t('caseStart.title.invalid'),
    error: t('caseStart.title.error'),
  };

  const descriptions: Record<Exclude<Status, 'redeeming'>, string> = {
    expired: t('caseStart.description.expired'),
    invalid: t('caseStart.description.invalid'),
    error: errorMessage || t('caseStart.description.error'),
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <CardTitle>{titles[status]}</CardTitle>
          </div>
          <CardDescription className="pt-2">{descriptions[status]}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => navigate('/login', { replace: true })}>
            {t('caseStart.goToLogin')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CaseStart;
