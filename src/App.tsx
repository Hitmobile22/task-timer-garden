
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { useRecurringTasksCheck } from "./hooks/useRecurringTasksCheck";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RecurringTasksProvider />
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}

// Separate component to use hooks
function RecurringTasksProvider() {
  useRecurringTasksCheck();
  return null;
}

export default App;
