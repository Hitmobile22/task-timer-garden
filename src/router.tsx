
import { createBrowserRouter, useLocation, Outlet } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import Calendar from "./pages/Calendar";
import TaskView from "./pages/TaskView";
import NotFound from "./pages/NotFound";
import { useCheckProjectDueDates } from './hooks/useCheckProjectDueDates';
import { useUnifiedRecurringTasksCheck } from './hooks/useUnifiedRecurringTasksCheck';

// ScrollToTop component to handle scrolling to top on route change
// and check project due dates and recurring tasks
function ScrollToTop() {
  const { pathname } = useLocation();
  
  // Check project due dates
  useCheckProjectDueDates();
  
  // Check recurring tasks on navigation
  const recurringTasksChecker = useUnifiedRecurringTasksCheck();
  
  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Check recurring tasks on route change, but not forcing the check
    recurringTasksChecker.checkRecurringTasks(false);
  }, [pathname]);
  
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <ScrollToTop />,
    children: [
      {
        path: "/",
        element: <Index />,
        errorElement: <NotFound />,
      },
      {
        path: "/calendar",
        element: <Calendar />,
      },
      {
        path: "/tasks",
        element: <TaskView />,
      },
      {
        path: "*",
        element: <NotFound />,
      }
    ]
  }
]);
