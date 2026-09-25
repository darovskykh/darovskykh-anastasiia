import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { apiClient } from "./services/api";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Navigation from "./components/Navigation";
import Index from "./pages/Index";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import UserManagement from "./pages/UserManagement";
import UserProfile from "./pages/UserProfile";
import FeedbackManagement from "./pages/FeedbackManagement";
import MemberDashboard from "./pages/MemberDashboard";
import Simulation from "./pages/Simulation";
import SimulationResults from "./pages/SimulationResults";
import CaseDetails from "./pages/CaseDetails";
import CaseManagement from "./pages/CaseManagement";
import CaseEditor from "./pages/CaseEditor";
import BasePrompt from "./pages/BasePrompt";
import Cases from "./pages/Cases";
import PromotionDashboard from "./pages/PromotionDashboard";
import HelloPage from "./pages/HelloPage";
import NotFound from "./pages/NotFound";
import CaseIntro from "./pages/CaseIntro";
import CaseStart from "./pages/CaseStart";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  useEffect(() => {
    // Setup unauthorized callback
    apiClient.setUnauthorizedCallback(() => {
      logout();
      navigate('/login');
    });
  }, [logout, navigate]);

  // Hide navigation for retail-dashboard, hello and retail-scaner pages to make them independent (for Telegram WebView)
  const showNavigation = !location.pathname.startsWith('/retail-dashboard') && !location.pathname.startsWith('/hello') && !location.pathname.startsWith('/retail-scaner');

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {showNavigation && <Navigation />}
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/hello" element={<HelloPage />} />
        <Route path="/retail-scaner" element={<HelloPage />} />
        <Route path="/case/start/:token" element={<CaseStart />} />

        {/* Admin routes - require admin role */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/users/:userId"
          element={
            <ProtectedRoute requiredRole="admin">
              <UserProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/case-management"
          element={
            <ProtectedRoute requiredRole="admin">
              <CaseManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/case-management/editor/:caseId?"
          element={
            <ProtectedRoute requiredRole="admin">
              <CaseEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/base-prompt"
          element={
            <ProtectedRoute requiredRole="admin">
              <BasePrompt />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/feedback"
          element={
            <ProtectedRoute requiredRole="admin">
              <FeedbackManagement />
            </ProtectedRoute>
          }
        />

        {/* Member routes - require any authenticated user */}
        <Route
          path="/member-dashboard"
          element={
            <ProtectedRoute>
              <MemberDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/case-intro/:caseId/step/:step"
          element={
            <ProtectedRoute>
              <CaseIntro />
            </ProtectedRoute>
          }
        />
        <Route
          path="/simulation/:chatId"
          element={
            <ProtectedRoute>
              <Simulation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/simulation/:chatId/results"
          element={
            <ProtectedRoute>
              <SimulationResults />
            </ProtectedRoute>
          }
        />
        <Route
          path="/case-details/:caseId"
          element={
            <ProtectedRoute>
              <CaseDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases"
          element={
            <ProtectedRoute>
              <Cases />
            </ProtectedRoute>
          }
        />
        <Route
          path="/retail-dashboard"
          element={
            <ProtectedRoute>
              <PromotionDashboard />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
