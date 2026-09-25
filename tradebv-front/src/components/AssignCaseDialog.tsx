import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Loader2, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { extractLocalizedContent } from '@/utils/localizedContent';
import { RichTextEditor } from '@/components/RichTextEditor';
import { invitationService, type InvitationPublic } from '@/services/invitationService';

interface AssignCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
}

const FROM_ADDRESS = 'no.reply@gart.tech';

// Languages the backend's email_service supports. Default is English so
// invited recipients see a familiar locale unless the admin explicitly
// switches it. Order matches the spec.
type EmailLang = 'en' | 'uk' | 'ar' | 'es' | 'pt' | 'ru';

const EMAIL_LANGS: { code: EmailLang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'uk', label: 'UK' },
  { code: 'ar', label: 'AR' },
  { code: 'es', label: 'ES' },
  { code: 'pt', label: 'PT' },
  { code: 'ru', label: 'RU' },
];

// Preview copy per email language. Mirrors the backend's email_service
// templates so the admin sees roughly what the recipient will get. Kept
// short — full HTML is rendered server-side; this is a plain-text
// approximation for the preview block only.
interface EmailPreviewCopy {
  greeting: (name: string) => string;
  invited: (caseTitle: string) => string;
  credentialsLabel: string;
  loginLabel: string;
  passwordPlaceholder: string;
  startLine: string;
  signoff: string;
  subject: string;
  team: string;
  dir: 'ltr' | 'rtl';
}

const EMAIL_PREVIEW: Record<EmailLang, EmailPreviewCopy> = {
  en: {
    greeting: (n) => `Welcome, ${n}!`,
    invited: (t) => `You are invited to complete the training case «${t}» on the Gart platform.`,
    credentialsLabel: 'Login credentials:',
    loginLabel: 'Login',
    passwordPlaceholder: 'auto-generated',
    startLine: 'Start the case using the link below (it logs you in and opens the case):',
    signoff: 'Best regards,',
    team: 'Gart Team',
    subject: 'Invitation to complete a training case',
    dir: 'ltr',
  },
  uk: {
    greeting: (n) => `Вітаємо, ${n}!`,
    invited: (t) => `Вас запрошено пройти навчальний кейс «${t}» на платформі Gart.`,
    credentialsLabel: 'Дані для входу:',
    loginLabel: 'Логін',
    passwordPlaceholder: 'згенерується автоматично',
    startLine: 'Розпочати кейс — лінк нижче (одразу авторизує і відкриває кейс):',
    signoff: 'З повагою,',
    team: 'Команда Gart',
    subject: 'Запрошення пройти навчальний кейс',
    dir: 'ltr',
  },
  ar: {
    greeting: (n) => `مرحبًا، ${n}!`,
    invited: (t) => `أنت مدعو لإكمال الحالة التدريبية «${t}» على منصة Gart.`,
    credentialsLabel: 'بيانات تسجيل الدخول:',
    loginLabel: 'اسم المستخدم',
    passwordPlaceholder: 'يتم إنشاؤها تلقائيًا',
    startLine: 'ابدأ الحالة عبر الرابط أدناه (يسجّل الدخول ويفتح الحالة):',
    signoff: 'مع التحية،',
    team: 'فريق Gart',
    subject: 'دعوة لإكمال حالة تدريبية',
    dir: 'rtl',
  },
  es: {
    greeting: (n) => `¡Bienvenido, ${n}!`,
    invited: (t) => `Estás invitado a completar el caso de formación «${t}» en la plataforma Gart.`,
    credentialsLabel: 'Datos de acceso:',
    loginLabel: 'Usuario',
    passwordPlaceholder: 'se generará automáticamente',
    startLine: 'Comienza el caso con el enlace siguiente (te autentica y lo abre):',
    signoff: 'Atentamente,',
    team: 'Equipo Gart',
    subject: 'Invitación para completar un caso de formación',
    dir: 'ltr',
  },
  pt: {
    greeting: (n) => `Bem-vindo, ${n}!`,
    invited: (t) => `Você foi convidado a concluir o caso de formação «${t}» na plataforma Gart.`,
    credentialsLabel: 'Dados de acesso:',
    loginLabel: 'Login',
    passwordPlaceholder: 'gerada automaticamente',
    startLine: 'Inicie o caso pelo link abaixo (faz login e abre o caso):',
    signoff: 'Atenciosamente,',
    team: 'Equipe Gart',
    subject: 'Convite para concluir um caso de formação',
    dir: 'ltr',
  },
  ru: {
    greeting: (n) => `Здравствуйте, ${n}!`,
    invited: (t) => `Вы приглашены пройти учебный кейс «${t}» на платформе Gart.`,
    credentialsLabel: 'Данные для входа:',
    loginLabel: 'Логин',
    passwordPlaceholder: 'сгенерируется автоматически',
    startLine: 'Начать кейс по ссылке ниже (сразу авторизует и откроет кейс):',
    signoff: 'С уважением,',
    team: 'Команда Gart',
    subject: 'Приглашение пройти учебный кейс',
    dir: 'ltr',
  },
};

/** Default body shown when the admin opts into editing. Built from the
 * already-localised EMAIL_PREVIEW for the language the admin picked, so the
 * recipient gets the email in the language they were invited in.
 * Placeholders (`{{login}}`, `{{password}}`, `{{link}}`, `{{case_title}}`,
 * `{{full_name}}`) are replaced on the backend just before sending. */
const buildDefaultBody = (caseTitle: string, lang: EmailLang): string => {
  const p = EMAIL_PREVIEW[lang];
  return (
    `<p>${p.greeting('<strong>{{full_name}}</strong>')}</p>` +
    `<p>${p.invited(`<strong>«${caseTitle}»</strong>`)}</p>` +
    `<p>${p.credentialsLabel}</p>` +
    `<ul><li>${p.loginLabel}: <strong>{{login}}</strong></li><li><strong>{{password}}</strong></li></ul>` +
    `<p>${p.startLine}</p>` +
    `<p><a href="{{link}}">{{link}}</a></p>` +
    `<p>${p.signoff}<br />${p.team}</p>`
  );
};

export const AssignCaseDialog = ({
  open,
  onOpenChange,
  caseId,
  caseTitle,
}: AssignCaseDialogProps) => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InvitationPublic | null>(null);
  const [editBody, setEditBody] = useState(false);
  const [customBody, setCustomBody] = useState('');
  const [emailLang, setEmailLang] = useState<EmailLang>('en');
  const displayTitle = extractLocalizedContent(caseTitle, language);
  const emailTitle = extractLocalizedContent(caseTitle, emailLang);

  useEffect(() => {
    if (!open) {
      setFirstName('');
      setLastName('');
      setEmail('');
      setSubmitting(false);
      setResult(null);
      setEditBody(false);
      setCustomBody('');
      setEmailLang('en');
    }
  }, [open]);

  useEffect(() => {
    if (editBody && !customBody) {
      setCustomBody(buildDefaultBody(emailTitle, emailLang));
    }
  }, [editBody, customBody, emailTitle, emailLang]);

  const previewName = useMemo(() => {
    const composed = `${firstName.trim()} ${lastName.trim()}`.trim();
    return composed || t('userProfile.assignCaseModal.previewName');
  }, [firstName, lastName, t]);

  const previewEmail = email.trim() || 'user@example.com';
  const preview = EMAIL_PREVIEW[emailLang];

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(email.trim()) &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const response = await invitationService.assignCase(caseId, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        ...(editBody && customBody.trim()
          ? { custom_html: customBody }
          : { lang: emailLang }),
      });
      setResult(response);
      toast({
        title: t('userProfile.assignCaseModal.toastInvitationSent'),
        description: t('userProfile.assignCaseModal.toastInvitationDescription', { email: email.trim() }),
      });
    } catch (err: any) {
      toast({
        title: t('userProfile.assignCaseModal.toastInvitationFailed'),
        description: err?.message || t('userProfile.assignCaseModal.toastInvitationFailedDescription'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: t('userProfile.assignCaseModal.toastCopied', { label }) });
    } catch {
      toast({ title: t('userProfile.assignCaseModal.toastCopyFailed'), variant: 'destructive' });
    }
  };

  const copyCredentials = () => {
    if (!result) return;
    const loginLabel = t('userProfile.assignCaseModal.loginLabel');
    const passwordLabel = t('userProfile.assignCaseModal.passwordLabel');
    const linkLabel = t('userProfile.assignCaseModal.linkLabel');
    const passwordFallback = t('userProfile.assignCaseModal.passwordAlreadyGenerated');
    const text =
      `${loginLabel}: ${result.email}\n` +
      `${passwordLabel}: ${result.generated_password ?? passwordFallback}\n` +
      `${linkLabel}: ${result.link}`;
    copyToClipboard(t('userProfile.assignCaseModal.credentialsLabel'), text);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {result
              ? t('userProfile.assignCaseModal.invitationSent')
              : t('userProfile.assignCaseModal.title')}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <Badge variant="secondary" className="font-normal">
              {displayTitle}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="grid gap-4">
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-lg p-3 text-sm">
              <CheckCircle2 className="h-5 w-5" />
              <span
                dangerouslySetInnerHTML={{
                  __html: t('userProfile.assignCaseModal.resultMessage', { email: '__EMAIL__' })
                    .replace('__EMAIL__', `<strong>${result.email}</strong>`),
                }}
              />
            </div>

            <div className="rounded-lg border p-4 space-y-3 text-sm">
              <div className="grid grid-cols-[110px_1fr_auto] items-center gap-x-3 gap-y-2">
                <span className="text-muted-foreground">{t('userProfile.assignCaseModal.loginLabel')}</span>
                <span className="font-mono">{result.email}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(t('userProfile.assignCaseModal.loginLabel'), result.email)}
                >
                  <Copy className="h-4 w-4" />
                </Button>

                <span className="text-muted-foreground">{t('userProfile.assignCaseModal.passwordLabel')}</span>
                <span className="font-mono">
                  {result.generated_password ?? t('userProfile.assignCaseModal.passwordNotAvailable')}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!result.generated_password}
                  onClick={() =>
                    result.generated_password &&
                    copyToClipboard(t('userProfile.assignCaseModal.passwordLabel'), result.generated_password)
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>

                <span className="text-muted-foreground">{t('userProfile.assignCaseModal.linkLabel')}</span>
                <span className="font-mono break-all text-xs">{result.link}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(t('userProfile.assignCaseModal.linkLabel'), result.link)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={copyCredentials}>
                <Copy className="w-4 h-4 mr-2" />
                {t('userProfile.assignCaseModal.copyAll')}
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                {t('userProfile.assignCaseModal.done')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
        <>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="assign-first-name">
                {t('userProfile.assignCaseModal.firstName')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="assign-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t('userProfile.assignCaseModal.firstNamePlaceholder')}
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assign-last-name">
                {t('userProfile.assignCaseModal.lastName')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="assign-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t('userProfile.assignCaseModal.lastNamePlaceholder')}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="assign-email">
              {t('userProfile.assignCaseModal.email')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="assign-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Checkbox
              id="assign-edit-body"
              checked={editBody}
              onCheckedChange={(v) => setEditBody(v === true)}
            />
            <Label htmlFor="assign-edit-body" className="cursor-pointer text-sm">
              {t('userProfile.assignCaseModal.editBodyLabel')}
              <code className="text-xs">{'{{login}} {{password}} {{link}} {{case_title}} {{full_name}}'}</code>)
            </Label>
          </div>

          {editBody ? (
            <RichTextEditor
              value={customBody}
              onChange={setCustomBody}
              placeholder={t('userProfile.assignCaseModal.editorPlaceholder')}
            />
          ) : (
            // Language toggle is mutually exclusive with the rich-text editor:
            // either the admin writes a custom body in any language they want,
            // or they pick one of the supported templates here.
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">
                {t('userProfile.assignCaseModal.emailLanguage')}:
              </span>
              {EMAIL_LANGS.map((opt) => (
                <Button
                  key={opt.code}
                  type="button"
                  size="sm"
                  variant={emailLang === opt.code ? 'default' : 'outline'}
                  onClick={() => setEmailLang(opt.code)}
                  className="h-7 px-3 text-xs"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          )}

          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-2">
            {t('userProfile.assignCaseModal.previewLabel')}
          </div>
          <div
            className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed space-y-3"
            dir={editBody ? 'ltr' : preview.dir}
          >
            <div className="grid grid-cols-[64px_1fr] gap-x-2 text-xs text-muted-foreground" dir="ltr">
              <span>{t('userProfile.assignCaseModal.previewFrom')}</span>
              <span className="text-foreground font-medium">{FROM_ADDRESS}</span>
              <span>{t('userProfile.assignCaseModal.previewTo')}</span>
              <span className="text-foreground">{previewEmail}</span>
              <span>{t('userProfile.assignCaseModal.previewSubject')}</span>
              <span className="text-foreground font-medium">{preview.subject}</span>
            </div>
            <div className="border-t pt-3 space-y-2">
              <p>{preview.greeting(previewName)}</p>
              <p>{preview.invited(emailTitle)}</p>
              <p>{preview.credentialsLabel}</p>
              <ul className="ml-4 list-disc">
                <li>
                  {preview.loginLabel}: <strong>{previewEmail}</strong>
                </li>
                <li>
                  {/* show the localised "auto-generated" hint instead of an actual password */}
                  <strong>{preview.passwordPlaceholder}</strong>
                </li>
              </ul>
              <p>{preview.startLine}</p>
              <p className="text-primary break-all">
                https://tradebv.gart.technology/case/start/&lt;token&gt;
              </p>
              <p className="text-muted-foreground">
                {preview.signoff}
                <br />
                {preview.team}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('userProfile.assignCaseModal.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {t('userProfile.assignCaseModal.sendInvitation')}
          </Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
};
