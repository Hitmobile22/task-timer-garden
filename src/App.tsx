
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import { router } from './router';
import { Toaster } from 'sonner';
import { AuthProvider } from './hooks/useAuth';
import { InitializationComponent } from './components/goals/InitializationComponent';
import './App.css';

// Create a client
const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" />
          <InitializationComponent />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

const AppRoutes = () => {
  // Use the routes array from the router object
  const routeContent = useRoutes(router.routes);
  return routeContent;
};

export default App;
