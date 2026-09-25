import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, isInitializing } = useAuth();
  const { t } = useLanguage();

  // Show loading while checking authentication
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // If user is not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If a specific role is required, check if user has that role
  if (requiredRole && user.role !== requiredRole) {
    // Superadmin has access to all admin routes
    if (requiredRole === 'admin' && user.role === 'superadmin') {
      return <>{children}</>;
    }

    // Redirect to appropriate dashboard based on user's actual role
    const redirectPath = (user.role === 'admin' || user.role === 'superadmin') ? '/admin-dashboard' : '/member-dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};
