import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FieldLabel } from '@/components/AudienceBadge';
import { ConditionalFactsEditor } from '@/components/persona/ConditionalFactsEditor';
import { PromptAssemblyScheme } from '@/components/prompt/PromptAssemblyScheme';
import { personaStructureService } from '@/services/personaStructureService';
import { useToast } from '@/hooks/use-toast';
import type { BasePromptConfig } from '@/types/personaStructure';

const EMPTY: BasePromptConfig = { talkerPrompt: '', controllerPrompt: '', universalFacts: [] };

const BasePrompt = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<BasePromptConfig>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    personaStructureService
      .getBasePrompt()
      .then(setConfig)
      .catch(error => {
        console.error('Failed to load base prompt:', error);
        toast({ title: 'Не вдалося завантажити базовий промпт', variant: 'destructive' });
      })
      .finally(() => setIsLoading(false));
  }, [toast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      setConfig(await personaStructureService.saveBasePrompt(config));
      toast({ title: 'Базовий промпт збережено', description: 'Зміни застосуються до всіх персон.' });
    } catch (error: any) {
      toast({ title: 'Не вдалося зберегти', description: error?.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold sm:text-2xl">Базовий промпт</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Спільна частина інструкцій для всіх персон. Те, що стосується конкретної персони, налаштовується в її кейсі.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || isLoading} className="w-full sm:w-auto">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Зберегти
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Промпти</CardTitle>
              <CardDescription>
                У діалозі працюють дві AI: одна говорить з юзером, друга вирішує, як рухатися по діалогу.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <FieldLabel audience="ai" htmlFor="talkerPrompt">1. Базовий промпт AI-співрозмовника</FieldLabel>
                <Textarea
                  id="talkerPrompt"
                  value={config.talkerPrompt}
                  onChange={e => setConfig(prev => ({ ...prev, talkerPrompt: e.target.value }))}
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  AI, яка говорить з юзером від імені персони і намагається спілкуватися по-людськи.
                </p>
              </div>
              <div className="space-y-2">
                <FieldLabel audience="ai" htmlFor="controllerPrompt">2. Базовий промпт AI, що веде діалог</FieldLabel>
                <Textarea
                  id="controllerPrompt"
                  value={config.controllerPrompt}
                  onChange={e => setConfig(prev => ({ ...prev, controllerPrompt: e.target.value }))}
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  AI, яка бачить увесь діалог, стани з фазами та умови фактів і вирішує, в яку фазу перейти і які факти зараз
                  релевантні.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <ConditionalFactsEditor
                title="3. Універсальні факти"
                description="Як факти персони, але спільні для всіх: як реагувати на нісенітницю, мат, спроби вийти з ролі тощо. AI отримує лише ті, умова яких спрацювала."
                facts={config.universalFacts}
                onChange={universalFacts => setConfig(prev => ({ ...prev, universalFacts }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Як збирається інструкція для AI</CardTitle>
                <Badge variant="outline">Прикидка</Badge>
              </div>
              <CardDescription>
                У якому порядку шматки тексту склеюються в одну інструкцію і читаються AI. Порядок блоків ще уточнюємо.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PromptAssemblyScheme />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default BasePrompt;
