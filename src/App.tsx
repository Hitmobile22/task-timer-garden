
import React, { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useCheckProjectDueDates } from './hooks/useCheckProjectDueDates';
import { router } from './router';

const queryClient = new QueryClient();

function App() {
  // Check project due dates
  useCheckProjectDueDates();
  
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>Loading...</div>}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster position="top-right" closeButton richColors />
    </QueryClientProvider>
  );
}

export default App;
