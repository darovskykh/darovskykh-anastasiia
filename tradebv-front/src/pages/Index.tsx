import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, ArrowRight, Play } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { t } = useLanguage();
  const { user } = useAuth();


  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative py-12 md:py-20 px-4 text-center bg-gradient-primary text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-4xl mx-auto space-y-6 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            {t('welcome.title')}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto">
            {t('welcome.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            {user ? (
              <Button size="lg" variant="secondary" className="px-8" asChild>
                <Link to={user.role === 'admin' || user.role === 'superadmin' ? '/admin-dashboard' : '/member-dashboard'}>
                  <BookOpen className="h-5 w-5 mr-2" />
                  {t('home.goToDashboard')}
                </Link>
              </Button>
            ) : (
              <>
                <Button size="lg" variant="secondary" className="px-8" asChild>
                  <Link to="/login">
                    <Play className="h-5 w-5 mr-2" />
                    {t('home.startLearning')}
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="px-8 border-white text-white bg-transparent hover:bg-white/10 hover:text-white" asChild>
                  <Link to="/login">
                    {t('home.learnMore')}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section removed as per requirement to hide "Why Choose Our Platform?" */}

      {/* Popular Courses section removed */}

      {/* CTA Section */}
      {!user && (
        <section className="py-12 md:py-20 px-4 text-center">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold text-foreground">
              {t('home.cta.title')}
            </h2>
            <p className="text-muted-foreground text-lg">
              {t('home.cta.subtitle')}
            </p>
            <Button size="lg" className="px-8" asChild>
              <Link to="/login">
                {t('nav.login')}
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};

export default Index;
