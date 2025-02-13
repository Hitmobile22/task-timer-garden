
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { fetchSubtasksFromAI } from "@/lib/utils";

interface SubTask {
  name: string;
}

interface Task {
  name: string;
  subtasks: SubTask[];
}

export const TaskForm = ({ onTasksCreate }) => {
  const [numTasks, setNumTasks] = useState(1);
  const [tasks, setTasks] = useState<Task[]>([{ name: "", subtasks: [] }]);
  const [loadingTaskIndex, setLoadingTaskIndex] = useState<number | null>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleNumTasksChange = (value: string) => {
    const num = parseInt(value);
    setNumTasks(num);
    setTasks((prevTasks) =>
      Array(num)
        .fill(null)
        .map((_, i) => ({
          name: prevTasks[i]?.name || "",
          subtasks: prevTasks[i]?.subtasks || [],
        }))
    );
  };

  const handleTaskInputChange = (index: number, value: string) => {
    const newTasks = [...tasks];
    newTasks[index].name = value;
    setTasks(newTasks);

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    typingTimeout.current = setTimeout(async () => {
      if (value.startsWith("@i ")) {
        const taskName = value.substring(3).trim();
        if (taskName.length > 0) {
          setLoadingTaskIndex(index);
          try {
            const aiSubtasks = await fetchSubtasksFromAI(taskName);
            newTasks[index].subtasks = aiSubtasks.map((subtask) => ({
              name: subtask,
            }));
            setTasks([...newTasks]);
          } catch (error) {
            console.error("Error fetching AI subtasks:", error);
          }
          setLoadingTaskIndex(null);
        }
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
    };
  }, []);

  const addSubtask = (taskIndex: number) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].subtasks.push({ name: "" });
    setTasks(newTasks);
  };

  const removeSubtask = (taskIndex: number, subtaskIndex: number) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].subtasks.splice(subtaskIndex, 1);
    setTasks(newTasks);
  };

  const handleSubtaskInputChange = (
    taskIndex: number,
    subtaskIndex: number,
    value: string
  ) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].subtasks[subtaskIndex].name = value;
    setTasks(newTasks);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (tasks.some((task) => !task.name.trim())) {
      toast.error("Please fill in all task names");
      return;
    }
    if (tasks.some((task) => task.subtasks.some((subtask) => !subtask.name.trim()))) {
      toast.error("Please fill in all subtask names");
      return;
    }

    try {
      const currentTime = new Date();

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const taskStartTime = new Date(currentTime);
        // Add 30 minutes for each previous task (25min task + 5min break)
        taskStartTime.setMinutes(taskStartTime.getMinutes() + (i * 30));
        
        const taskDueTime = new Date(taskStartTime);
        taskDueTime.setMinutes(taskDueTime.getMinutes() + 25);

        // Create main task with timestamps
        const { data: taskData, error: taskError } = await supabase
          .from('Tasks')
          .insert([{ 
            "Task Name": task.name,
            "Progress": "Not started",
            "date_started": taskStartTime.toISOString(),
            "date_due": taskDueTime.toISOString()
          }])
          .select()
          .single();

        if (taskError) throw taskError;

        // Create subtasks
        if (task.subtasks.length > 0) {
          const subtasksToInsert = task.subtasks.map(subtask => ({
            "Task Name": subtask.name,
            "Progress": "Not started",
            "Parent Task ID": taskData.id
          }));

          const { error: subtaskError } = await supabase
            .from('subtasks')
            .insert(subtasksToInsert);

          if (subtaskError) throw subtaskError;
        }
      }

      // Reset form state
      setTasks([{ name: "", subtasks: [] }]);
      setNumTasks(1);
      
      // Update parent component with new tasks
      onTasksCreate(tasks);
      
      toast.success("Tasks created successfully");
    } catch (error) {
      console.error('Error creating tasks:', error);
      toast.error('Failed to create tasks');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="numTasks">Number of Tasks</Label>
        <Select value={numTasks.toString()} onValueChange={handleNumTasksChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select number of tasks" />
          </SelectTrigger>
          <SelectContent>
            {[...Array(10)].map((_, i) => (
              <SelectItem key={i + 1} value={(i + 1).toString()}>
                {i + 1} {i === 0 ? "Task" : "Tasks"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {tasks.map((task, taskIndex) => (
          <div key={taskIndex} className="space-y-4 p-4 rounded-lg bg-white/50">
            <div className="space-y-2">
              <Label htmlFor={`task-${taskIndex}`}>Task {taskIndex + 1} Name</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`task-${taskIndex}`}
                  value={task.name}
                  onChange={(e) => handleTaskInputChange(taskIndex, e.target.value)}
                  placeholder={`Enter task ${taskIndex + 1} name`}
                  className="hover-lift flex-grow"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => addSubtask(taskIndex)}
                  className="flex-shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3 pl-4 border-l-2 border-primary/20">
              {loadingTaskIndex === taskIndex ? (
                <p className="text-gray-500">Generating response...</p>
              ) : (
                task.subtasks.map((subtask, subtaskIndex) => (
                  <div key={subtaskIndex} className="flex items-center gap-2">
                    <Input
                      value={subtask.name}
                      onChange={(e) =>
                        handleSubtaskInputChange(taskIndex, subtaskIndex, e.target.value)
                      }
                      placeholder={`Enter subtask ${subtaskIndex + 1} name`}
                      className="hover-lift"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSubtask(taskIndex, subtaskIndex)}
                      className="flex-shrink-0"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <Button type="submit" className="w-full hover-lift">
        Create Tasks
      </Button>
    </form>
  );
};
