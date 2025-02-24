
import { createBrowserRouter } from "react-router-dom";
import { Index } from "./pages/Index";
import { Calendar } from "./pages/Calendar";
import { TaskView } from "./pages/TaskView";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
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
]);
