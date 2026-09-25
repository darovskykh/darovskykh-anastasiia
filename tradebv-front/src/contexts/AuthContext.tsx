import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'admin' | 'member' | 'superadmin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  allowed_cases_ids?: (number | string)[];
  case_access_expiry?: Record<string, string>; // case_id -> expiry datetime ISO string
}

interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  isLoading: boolean;
  isInitializing: boolean;
  canAccessCase: (caseId: number | string) => boolean;
  refreshUser: () => Promise<void>;
}

// Backend API configuration from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Check for existing session on mount and fetch fresh user data
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');

      if (token) {
        try {
          // Fetch fresh user data from /auth/me endpoint
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
            },
          });

          if (!response.ok) {
            // Token is invalid or expired
            console.error('Failed to fetch user data, status:', response.status);
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            setIsInitializing(false);
            return;
          }

          const responseData = await response.json();
          
          if (responseData.success && responseData.data) {
            const userData = responseData.data;
            
            // Map backend role to frontend role
            let frontendRole: UserRole;
            if (userData.role === 'admin' || userData.role === 'superadmin') {
              frontendRole = userData.role;
            } else if (userData.role === 'user') {
              frontendRole = 'member';
            } else {
              frontendRole = 'member';
            }

            const authenticatedUser: User = {
              id: userData.id,
              name: userData.name || userData.username,
              email: userData.email || userData.username,
              role: frontendRole,
              avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userData.email || userData.username)}`,
              allowed_cases_ids: userData.allowed_cases_ids || [],
              case_access_expiry: userData.case_access_expiry || {},
            };

            // Update localStorage with fresh data
            localStorage.setItem('auth_user', JSON.stringify(authenticatedUser));
            setUser(authenticatedUser);
          }
        } catch (error) {
          console.error('Failed to fetch user data:', error);
          // Fallback to localStorage if network error
          const storedUser = localStorage.getItem('auth_user');
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              console.log('Network error, using cached user from localStorage:', userData);
              setUser(userData);
            } catch (parseError) {
              console.error('Failed to parse stored user:', parseError);
              localStorage.removeItem('auth_token');
              localStorage.removeItem('auth_user');
            }
          }
        }
      }

      setIsInitializing(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    console.log('Login attempt:', email);

    try {
      console.log('Calling API:', `${API_BASE_URL}/auth/login`);
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          username: email,
          password: password,
        }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Login failed:', errorData);
        setIsLoading(false);
        const errorMessage = errorData?.detail || 'Invalid login or password';
        return { success: false, error: errorMessage };
      }

      const responseData = await response.json();
      console.log('Login successful');

      // Backend returns: { data: { token, user: { id, username, role: "user"|"admin"|"superadmin", ... } } }
      // Frontend uses: { id, name, email, role: "admin"|"member"|"superadmin"|"user", avatar }
      const { data } = responseData;
      const backendRole = data.user.role;

      // Map backend roles to frontend roles
      let frontendRole: UserRole;
      if (backendRole === 'admin' || backendRole === 'superadmin') {
        frontendRole = backendRole; // Keep admin/superadmin as is
      } else if (backendRole === 'user') {
        frontendRole = 'member'; // Map 'user' to 'member' for frontend
      } else {
        frontendRole = 'member'; // Default to member
      }

      const authenticatedUser: User = {
        id: data.user.id,
        name: data.user.name || data.user.username,
        email: data.user.email || data.user.username,
        role: frontendRole,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.user.email || data.user.username)}`,
        allowed_cases_ids: data.user.allowed_cases_ids,
        case_access_expiry: data.user.case_access_expiry,
      };


      // Store token and user in localStorage
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(authenticatedUser));

      setUser(authenticatedUser);
      setIsLoading(false);
      return { success: true, user: authenticatedUser };
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
      return { success: false };
    }
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token || !user) return;

    try {
      console.log('Refreshing user data from /auth/me');
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        if (responseData.success && responseData.data) {
          const userData = responseData.data;
          
          // Map backend role to frontend role
          let frontendRole: UserRole;
          if (userData.role === 'admin' || userData.role === 'superadmin') {
            frontendRole = userData.role;
          } else if (userData.role === 'user') {
            frontendRole = 'member';
          } else {
            frontendRole = 'member';
          }

          const authenticatedUser: User = {
            id: userData.id,
            name: userData.name || userData.username,
            email: userData.email || userData.username,
            role: frontendRole,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userData.email || userData.username)}`,
            allowed_cases_ids: userData.allowed_cases_ids || [],
            case_access_expiry: userData.case_access_expiry || {},
          };

          console.log('User data refreshed:', authenticatedUser);
          localStorage.setItem('auth_user', JSON.stringify(authenticatedUser));
          setUser(authenticatedUser);
        }
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  const canAccessCase = (caseId: number | string): boolean => {
    if (!user) return false;

    // Validate caseId
    if (!caseId) return false;
    const caseIdStr = String(caseId);

    // Admins have access to all cases
    if (user.role === 'admin' || user.role === 'superadmin') return true;

    // If allowed_cases_ids is not set or empty, user has no access
    if (!user.allowed_cases_ids || user.allowed_cases_ids.length === 0) return false;

    // Check if user has access to all cases (0 means all cases)
    const hasAllAccess = user.allowed_cases_ids.some(id => String(id) === '0');
    if (hasAllAccess) {
      // User has access to all cases, but check if there's a specific expiry for this case
      if (user.case_access_expiry && user.case_access_expiry[caseIdStr]) {
        const expiryDate = new Date(user.case_access_expiry[caseIdStr]);
        if (isNaN(expiryDate.getTime()) || new Date() > expiryDate) return false; // Access expired for this specific case
      }
      return true;
    }

    // Check if user has access to this specific case (compare as strings)
    const hasAccess = user.allowed_cases_ids.some(id => String(id) === caseIdStr);
    if (!hasAccess) return false;

    // Check if access has expired
    if (user.case_access_expiry && user.case_access_expiry[caseIdStr]) {
      const expiryDate = new Date(user.case_access_expiry[caseIdStr]);
      if (isNaN(expiryDate.getTime()) || new Date() > expiryDate) return false; // Access expired
    }

    return true;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, isInitializing, canAccessCase, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
