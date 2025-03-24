
import { createBrowserRouter, useLocation, Outlet } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import Calendar from "./pages/Calendar";
import TaskView from "./pages/TaskView";
import NotFound from "./pages/NotFound";
import { useCheckProjectDueDates } from './hooks/useCheckProjectDueDates';

// ScrollToTop component to handle scrolling to top on route change
// and check project due dates
function ScrollToTop() {
  const { pathname } = useLocation();
  
  // Check project due dates
  useCheckProjectDueDates();
  
  useEffect(() => {
    window.scrollTo(0, 0);
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
