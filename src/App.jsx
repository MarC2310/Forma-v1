// forma-app-main/src/App.jsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './lib/theme.jsx';
import { BLEProvider } from './context/BLEContext';
import { ProtectedRoute, PublicRoute, AuthCallback } from './components/Auth';
import { queryClient } from './lib/queryClient';
import PWAManager from './components/PWAManager';
import OnboardingWrapper from './components/OnboardingWrapper';
import ErrorBoundary from './components/ErrorBoundary';

import Login from './pages/Login';
import Signup from './pages/Signup';
import { ForgotPassword, ResetPassword } from './pages/AuthExtra';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const WithingsCallback = lazy(() => import('./pages/WithingsCallback'));
const GoogleFitCallback = lazy(() => import('./pages/GoogleFitCallback'));
const NutritionImport = lazy(() => import('./pages/NutritionImport'));
const NutritionTracker = lazy(() => import('./pages/NutritionTracker'));
const HealthDashboard = lazy(() => import('./pages/HealthDashboard'));
const WorkoutPage = lazy(() => import('./pages/WorkoutPage'));
const ProgressPage = lazy(() => import('./pages/ProgressPage'));

function PageLoader() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0E0F12', color: '#9aa0a6', fontSize: 13, fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.12)', borderTopColor: '#22c55e',
          animation: 'formaSpin 0.8s linear infinite'
        }}/>
        <style>{`@keyframes formaSpin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <BLEProvider>
              <OnboardingWrapper>
                <PWAManager />
                <ErrorBoundary full reloadPage>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/auth/login" element={<PublicRoute><Login /></PublicRoute>}/>
                      <Route path="/auth/signup" element={<PublicRoute><Signup /></PublicRoute>}/>
                      <Route path="/auth/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>}/>
                      <Route path="/auth/reset-password" element={<ResetPassword />}/>
                      <Route path="/auth/callback" element={<AuthCallback />} />
                      <Route path="/auth/withings/callback" element={<ProtectedRoute><WithingsCallback /></ProtectedRoute>}/>
                      <Route path="/auth/googlefit/callback" element={<ProtectedRoute><GoogleFitCallback /></ProtectedRoute>}/>
                      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}/>
                      <Route path="/profile" element={<ProtectedRoute><ProfileWrapper /></ProtectedRoute>}/>
                      <Route path="/nutrition" element={<ProtectedRoute><NutritionTrackerWrapper /></ProtectedRoute>}/>
                      <Route path="/nutrition/import" element={<ProtectedRoute><NutritionImportWrapper /></ProtectedRoute>}/>
                      <Route path="/health" element={<ProtectedRoute><HealthWrapper /></ProtectedRoute>}/>
                      <Route path="/workout" element={<ProtectedRoute><WorkoutWrapper /></ProtectedRoute>}/>
                      <Route path="/progress" element={<ProtectedRoute><ProgressWrapper /></ProtectedRoute>}/>
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </OnboardingWrapper>
            </BLEProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

function ProfileWrapper() { const n = useNavigate(); return <Profile onBack={() => n('/dashboard')} />; }
function NutritionTrackerWrapper() { const n = useNavigate(); return <NutritionTracker onBack={() => n('/dashboard')} />; }
function NutritionImportWrapper() { const n = useNavigate(); return <NutritionImport onBack={() => n('/dashboard')} onImported={() => n('/dashboard')} />; }
function HealthWrapper() { const n = useNavigate(); return <HealthDashboard onBack={() => n('/dashboard')} />; }
function WorkoutWrapper() { const n = useNavigate(); return <WorkoutPage onBack={() => n('/dashboard')} />; }
function ProgressWrapper() { const n = useNavigate(); return <ProgressPage onBack={() => n('/dashboard')} />; }
