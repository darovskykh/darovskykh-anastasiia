import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Globe, User, LogOut, Home, BookOpen, BarChart3, Menu, X, Users, FileText, Shield } from 'lucide-react';
import { useLanguage, Language, LANGUAGE_OPTIONS } from '@/contexts/LanguageContext';
import { persistUserLanguage } from '@/services/userLanguage';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationsBell } from '@/components/NotificationsBell';

const Navigation: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    // Keep the profile in step: the report renders goals and narrative from
    // `user.lang`, so a switch here must not leave the backend on the old one.
    // The case intro's language step is where this choice is confirmed and a
    // failure is surfaced; from the header it is a convenience switch, so a
    // failed sync is logged rather than interrupting whatever they were doing.
    if (user) {
      persistUserLanguage(lang).catch(error =>
        console.error('Failed to persist language from header switcher:', error)
      );
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // Get dashboard path based on role (superadmin uses admin dashboard)
  const getDashboardPath = () => {
    if (!user) return '/';
    return (user.role === 'admin' || user.role === 'superadmin') ? '/admin-dashboard' : '/member-dashboard';
  };

  const adminNavigationItems = [
    {
      title: t('admin.sidebar.home'),
      url: "/admin-dashboard",
      icon: Home,
      exact: true
    },
    {
      title: t('admin.sidebar.users'),
      url: "/admin-dashboard/users",
      icon: Users
    },
    {
      title: t('admin.sidebar.caseManagement'),
      url: "/admin-dashboard/case-management",
      icon: BookOpen
    },
    {
      title: t('admin.sidebar.feedback'),
      url: "/admin-dashboard/feedback",
      icon: FileText
    }
  ];

  const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Mobile Menu Button */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="btn-touch lg:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                <div className={`hamburger ${isMobileMenuOpen ? 'hamburger-open' : ''}`}>
                  <span className="hamburger-line"></span>
                  <span className="hamburger-line"></span>
                  <span className="hamburger-line"></span>
                </div>
              </Button>
              
              {/* Logo */}
              <Link
                to={user ? getDashboardPath() : "/"}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-lg sm:text-xl text-foreground">{t('nav.mhr')}</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-2">
              {user && (
                isAdmin ? (
                  <>
                    <Button variant="ghost" size="sm" className="btn-touch" asChild>
                      <Link to="/">
                        {t('nav.home')}
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="btn-touch" asChild>
                      <Link to={getDashboardPath()}>
                        {t('nav.dashboard')}
                      </Link>
                    </Button>
                  </>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">
                    {t('member.dashboard.welcome')}, {user.name}
                  </span>
                )
              )}
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center gap-2">
              {user && <NotificationsBell />}
              {/* Language Toggle - Desktop Only */}
              <div className="hidden sm:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="btn-touch flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span className="uppercase text-xs">{language}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {LANGUAGE_OPTIONS.map(({ code, label, native }) => (
                      <DropdownMenuItem
                        key={code}
                        onClick={() => handleLanguageChange(code)}
                        className={language === code ? 'bg-accent/10' : ''}
                      >
                        <span className="font-mono text-xs w-7 inline-block">{label}</span>
                        <span>{native}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* User Profile or Login */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative btn-touch rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="flex items-center justify-start gap-2 p-2">
                      <div className="flex flex-col space-y-1 leading-none">
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="w-[200px] truncate text-xs text-muted-foreground">
                          {user.email}
                        </p>
                        <p className="text-xs text-accent font-medium capitalize">
                          {user.role}
                        </p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    {isAdmin && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to={getDashboardPath()} className="flex items-center">
                            <User className="me-2 h-4 w-4" />
                            <span>{t('nav.profile')}</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="me-2 h-4 w-4" />
                      <span>{t('nav.logout')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="default" size="sm" className="btn-touch" asChild>
                  <Link to="/login">{t('nav.login')}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="mobile-nav-overlay" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="mobile-nav-menu animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-xl text-foreground">MHP TradeBV</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="btn-touch"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4">
              {isAdmin && (
                <>
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between mb-3 px-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('admin.sidebar.navigation')}
                      </p>
                      <div className="flex items-center gap-1">
                        <Shield className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Admin</span>
                      </div>
                    </div>
                    {adminNavigationItems.map((item) => {
                      const IconComponent = item.icon;
                      const isItemActive = item.exact 
                        ? location.pathname === item.url
                        : location.pathname.startsWith(item.url);
                      
                      return (
                        <Button
                          key={item.title}
                          variant={isItemActive ? 'secondary' : 'ghost'}
                          size="lg"
                          className="w-full justify-start btn-touch"
                          asChild
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Link to={item.url} className="flex items-center gap-3">
                            <IconComponent className="h-5 w-5" />
                            <span className="text-base">{item.title}</span>
                          </Link>
                        </Button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Mobile Language Toggle */}
              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-3">{t('nav.language')}</p>
                <div className="space-y-2">
                  {LANGUAGE_OPTIONS.map(({ code, label, native }) => (
                    <Button
                      key={code}
                      variant={language === code ? 'secondary' : 'ghost'}
                      size="lg"
                      className="w-full justify-start btn-touch"
                      onClick={() => {
                        handleLanguageChange(code);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <span className="font-mono text-xs w-8 inline-block">{label}</span>
                      <span>{native}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Mobile User Actions */}
              {user && (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback>
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-accent font-medium capitalize">{user.role}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="lg"
                        className="w-full justify-start btn-touch"
                        asChild
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Link to={getDashboardPath()} className="flex items-center gap-3">
                          <User className="h-5 w-5" />
                          <span className="text-base">{t('nav.profile')}</span>
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="lg"
                      className="w-full justify-start btn-touch text-destructive"
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <LogOut className="me-3 h-5 w-5" />
                      <span className="text-base">{t('nav.logout')}</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  
  );
};

export default Navigation;
