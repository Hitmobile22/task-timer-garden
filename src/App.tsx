
import React, { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { router } from './router';
import { useUnifiedRecurringTasksCheck } from './hooks/useUnifiedRecurringTasksCheck';

const queryClient = new QueryClient();

// Create a wrapper component that uses hooks after the providers are in place
const AppContent = () => {
  // Use the unified recurring tasks check hook
  useUnifiedRecurringTasksCheck();
  
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RouterProvider router={router} />
    </Suspense>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster position="top-right" closeButton richColors />
    </QueryClientProvider>
  );
}

export default App;
