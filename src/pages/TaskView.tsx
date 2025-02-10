
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { TaskForm } from '@/components/TaskForm';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Task = {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
};

export default function TaskView() {
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Task[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const { error } = await supabase
        .from('Tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete task');
      console.error('Delete error:', error);
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ taskId, progress }: { taskId: number; progress: Task['Progress'] }) => {
      const { error } = await supabase
        .from('Tasks')
        .update({ Progress: progress })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task progress updated');
    },
    onError: (error) => {
      toast.error('Failed to update task progress');
      console.error('Update error:', error);
    },
  });

  const handleTasksCreate = async (tasks: string[]) => {
    try {
      const { error } = await supabase
        .from('Tasks')
        .insert(tasks.map(task => ({ "Task Name": task })));
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tasks created successfully');
    } catch (error) {
      toast.error('Failed to create tasks');
      console.error('Create error:', error);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">Task Manager</h1>
      
      <div className="glass bg-white/90 backdrop-blur-lg rounded-xl p-8 shadow-lg">
        <TaskForm onTasksCreate={handleTasksCreate} />
      </div>

      <div className="glass bg-white/90 backdrop-blur-lg rounded-xl p-8 shadow-lg">
        <h2 className="text-2xl font-semibold mb-4">Task List</h2>
        
        {isLoading ? (
          <p>Loading tasks...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task Name</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks?.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task["Task Name"]}</TableCell>
                  <TableCell>
                    <Select
                      value={task.Progress}
                      onValueChange={(value: Task['Progress']) => 
                        updateProgressMutation.mutate({ taskId: task.id, progress: value })
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select progress" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Not started">Not started</SelectItem>
                        <SelectItem value="In progress">In progress</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Backlog">Backlog</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(task.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
