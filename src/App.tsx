
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import { routes } from './router';
import { Toaster } from 'sonner';
import { InitializationComponent } from './components/goals/InitializationComponent';
import './App.css';

// Create a client
const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" />
        <InitializationComponent />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const AppRoutes = () => {
  const routeContent = useRoutes(routes);
  return routeContent;
};

export default App;
