
import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from './pages/Index';
import TaskView from './pages/TaskView';
import Calendar from './pages/Calendar';
import NotFound from './pages/NotFound';
import { Toaster } from 'sonner';
import { useCheckProjectDueDates } from './hooks/useCheckProjectDueDates';

const queryClient = new QueryClient();

function AppContent() {
  const location = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  
  // Check project due dates
  useCheckProjectDueDates();
  
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/tasks" element={<TaskView />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Suspense fallback={<div>Loading...</div>}>
          <AppContent />
        </Suspense>
      </Router>
      <Toaster position="top-right" closeButton richColors />
    </QueryClientProvider>
  );
}

export default App;
