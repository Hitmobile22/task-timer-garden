
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Clock } from "lucide-react";
import { toast } from "sonner";
import { fetchSubtasksFromAI } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
// Import from the correct package
import type { DismissEvent } from "@radix-ui/react-dismissable-layer";

type Status = Database['public']['Enums']['status'];
interface SubTask {
  name: string;
}
interface Task {
  name: string;
  subtasks: SubTask[];
}

interface TimeBlockProps {
  name: string;
  startDate: Date;
  duration: string;
}

export const TaskForm = ({
  onTasksCreate,
  onTimeBlockCreate
}) => {
  const {
    data: taskLists
  } = useQuery({
    queryKey: ['task-lists'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('TaskLists').select('*').order('order', {
        ascending: true
      });
      if (error) throw error;
      return data;
    }
  });
  
  const [numTasks, setNumTasks] = useState<string>("none");
  const [tasks, setTasks] = useState<Task[]>([{
    name: "",
    subtasks: []
  }]);
  const [loadingTaskIndex, setLoadingTaskIndex] = useState<number | null>(null);
  const [delayType, setDelayType] = useState<'minutes' | 'datetime' | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedMinutes, setSelectedMinutes] = useState<string>('');
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const [showTimeBlockModal, setShowTimeBlockModal] = useState(false);
  const [timeBlockName, setTimeBlockName] = useState("");
  const [timeBlockDate, setTimeBlockDate] = useState<Date | undefined>(undefined);
  const [timeBlockDuration, setTimeBlockDuration] = useState<string>("30");

  const handleNumTasksChange = (value: string) => {
    setNumTasks(value);
    if (value === "none") {
      setTasks([{
        name: "",
        subtasks: []
      }]);
      setDelayType(null);
      setSelectedDate(undefined);
      setSelectedMinutes('');
    } else {
      const numericValue = parseInt(value);
      const newTasks = Array(numericValue).fill(null).map((_, i) => ({
        name: tasks[i]?.name || "",
        subtasks: tasks[i]?.subtasks || []
      }));
      setTasks(newTasks);
    }
  };
  
  const handleCreateTasks = () => {
    setNumTasks("1");
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
            newTasks[index].subtasks = aiSubtasks.map(subtask => ({
              name: subtask
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
    newTasks[taskIndex].subtasks.push({
      name: ""
    });
    setTasks(newTasks);
  };
  
  const removeSubtask = (taskIndex: number, subtaskIndex: number) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].subtasks.splice(subtaskIndex, 1);
    setTasks(newTasks);
  };
  
  const handleSubtaskInputChange = (taskIndex: number, subtaskIndex: number, value: string) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].subtasks[subtaskIndex].name = value;
    setTasks(newTasks);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tasks.some(task => !task.name.trim())) {
      toast.error("Please fill in all task names");
      return;
    }
    if (tasks.some(task => task.subtasks.some(subtask => !subtask.name.trim()))) {
      toast.error("Please fill in all subtask names");
      return;
    }
    try {
      const currentTime = new Date();
      let delayMilliseconds = 0;
      if (delayType === 'minutes' && selectedMinutes) {
        delayMilliseconds = parseInt(selectedMinutes) * 60 * 1000;
      } else if (delayType === 'datetime' && selectedDate) {
        delayMilliseconds = selectedDate.getTime() - currentTime.getTime();
        if (delayMilliseconds < 0) {
          toast.error("Selected time is in the past");
          return;
        }
      }
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const taskStartTime = new Date(currentTime.getTime() + delayMilliseconds);
        taskStartTime.setMinutes(taskStartTime.getMinutes() + i * 30);
        const taskDueTime = new Date(taskStartTime);
        taskDueTime.setMinutes(taskDueTime.getMinutes() + 25);

        const {
          data: taskData,
          error: taskError
        } = await supabase.from('Tasks').insert([{
          "Task Name": task.name,
          "Progress": "Not started" as Status,
          "date_started": taskStartTime.toISOString(),
          "date_due": taskDueTime.toISOString(),
          "delay_type": delayType,
          "delay_value": delayType === 'minutes' ? selectedMinutes : selectedDate?.toISOString()
        }]).select().single();
        if (taskError) throw taskError;

        if (task.subtasks.length > 0) {
          const subtasksToInsert = task.subtasks.map(subtask => ({
            "Task Name": subtask.name,
            "Progress": "Not started" as Status,
            "Parent Task ID": taskData.id
          }));
          const {
            error: subtaskError
          } = await supabase.from('subtasks').insert(subtasksToInsert);
          if (subtaskError) throw subtaskError;
        }
      }

      setTasks([{
        name: "",
        subtasks: []
      }]);
      setNumTasks("none");
      setDelayType(null);
      setSelectedDate(undefined);
      setSelectedMinutes('');
      onTasksCreate(tasks);
      toast.success("Tasks created successfully");
    } catch (error) {
      console.error('Error creating tasks:', error);
      toast.error('Failed to create tasks');
    }
  };
  
  const handleTimeBlockSubmit = async () => {
    if (!timeBlockName.trim()) {
      toast.error("Please enter a time block name");
      return;
    }
    
    if (!timeBlockDate) {
      toast.error("Please select a start time");
      return;
    }
    
    if (!timeBlockDuration) {
      toast.error("Please select a duration");
      return;
    }
    
    try {
      const startTime = new Date(timeBlockDate);
      const endTime = new Date(startTime);
      const durationMinutes = parseInt(timeBlockDuration);
      endTime.setMinutes(startTime.getMinutes() + durationMinutes);
      
      const { data: timeBlockData, error } = await supabase
        .from('Tasks')
        .insert([{
          "Task Name": timeBlockName,
          "Progress": "Not started",
          "date_started": startTime.toISOString(),
          "date_due": endTime.toISOString(),
          "details": { isTimeBlock: true }
        }])
        .select()
        .single();
        
      if (error) throw error;
      
      setTimeBlockName("");
      setTimeBlockDate(undefined);
      setTimeBlockDuration("30");
      setShowTimeBlockModal(false);
      
      if (onTimeBlockCreate) {
        onTimeBlockCreate(timeBlockData);
      }
      
      toast.success("Time block created successfully");
    } catch (error) {
      console.error('Error creating time block:', error);
      toast.error('Failed to create time block');
    }
  };
  
  const preventPropagation = (e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };
  
  // Updated event handlers with correct types
  const handleInteractOutside = (event: DismissEvent) => {
    event.preventDefault();
  };
  
  const handleOpenAutoFocus = (event: Event) => {
    event.preventDefault();
  };
  
  const handleFocusOutside = (event: React.FocusEvent) => {
    event.preventDefault();
  };
  
  const handlePointerDownOutside = (event: React.PointerEvent) => {
    event.preventDefault();
  };
  
  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4 px-[20px]">
          {numTasks === "none" ? (
            <div className="flex space-x-4 justify-center">
              <Button 
                type="button"
                onClick={handleCreateTasks}
                className="hover-lift"
              >
                Add Tasks
              </Button>
              <Button 
                type="button"
                onClick={() => setShowTimeBlockModal(true)}
                variant="outline"
                className="hover-lift"
              >
                <Clock className="mr-2 h-4 w-4" />
                Add Time Block
              </Button>
            </div>
          ) : (
            <>
              <div className="px-[58px]">
                <Label htmlFor="numTasks">Number of Tasks</Label>
                <Select value={numTasks} onValueChange={handleNumTasksChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select number of tasks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {i + 1} {i === 0 ? "Task" : "Tasks"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Delay by Minutes</Label>
                  <Select 
                    value={delayType === 'minutes' ? selectedMinutes : ''} 
                    onValueChange={value => {
                      if (value === 'none') {
                        setDelayType(null);
                        setSelectedMinutes('');
                      } else {
                        setDelayType('minutes');
                        setSelectedMinutes(value);
                        setSelectedDate(undefined);
                      }
                    }} 
                    disabled={delayType === 'datetime'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select delay" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {[5, 10, 25, 30, 45, 60, 120, 180].map(minutes => (
                        <SelectItem key={minutes} value={minutes.toString()}>
                          {minutes >= 60 ? `${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'}` : `${minutes} minutes`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Schedule for</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={cn(
                          "w-full justify-start text-left font-normal", 
                          !selectedDate && "text-muted-foreground"
                        )}
                        disabled={delayType === 'minutes'}
                        onClick={() => {
                          if (delayType !== 'datetime') {
                            setDelayType('datetime');
                            setSelectedMinutes('');
                          }
                        }}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP p") : <span>Pick date and time</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-4 space-y-4">
                        <Calendar 
                          mode="single"
                          selected={selectedDate}
                          onSelect={date => {
                            if (date) {
                              const currentTime = selectedDate || new Date();
                              date.setHours(currentTime.getHours());
                              date.setMinutes(currentTime.getMinutes());
                              setSelectedDate(date);
                            }
                          }}
                          initialFocus
                        />
                        <div className="flex gap-2 items-center">
                          <Input 
                            type="time" 
                            value={selectedDate ? format(selectedDate, "HH:mm") : ""} 
                            onChange={e => {
                              const [hours, minutes] = e.target.value.split(':').map(Number);
                              const newDate = selectedDate || new Date();
                              newDate.setHours(hours);
                              newDate.setMinutes(minutes);
                              setSelectedDate(new Date(newDate));
                            }}
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-6">
                {tasks.map((task, taskIndex) => (
                  <div key={taskIndex} className="space-y-4 p-4 rounded-lg bg-white/50 px-[11px] py-[4px]">
                    <div className="space-y-2">
                      <Label htmlFor={`task-${taskIndex}`}>Task {taskIndex + 1} Name</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          id={`task-${taskIndex}`} 
                          value={task.name} 
                          onChange={e => handleTaskInputChange(taskIndex, e.target.value)} 
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
                              onChange={e => handleSubtaskInputChange(taskIndex, subtaskIndex, e.target.value)} 
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
            </>
          )}
        </div>
      </form>
      
      <Dialog open={showTimeBlockModal} onOpenChange={setShowTimeBlockModal}>
        <DialogContent className="sm:max-w-[425px]" onClick={preventPropagation}>
          <DialogHeader>
            <DialogTitle>Create Time Block</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="timeBlockName">Time Block Name</Label>
              <Input
                id="timeBlockName"
                value={timeBlockName}
                onChange={(e) => setTimeBlockName(e.target.value)}
                placeholder="Meeting, Break, Lunch, etc."
                onClick={preventPropagation}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !timeBlockDate && "text-muted-foreground"
                    )}
                    onClick={preventPropagation}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {timeBlockDate ? format(timeBlockDate, "PPP p") : <span>Pick date and time</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0" 
                  align="start"
                  onInteractOutside={handleInteractOutside}
                  onOpenAutoFocus={handleOpenAutoFocus}
                  onPointerDownOutside={handlePointerDownOutside}
                >
                  <div className="p-4 space-y-4" onClick={preventPropagation}>
                    <Calendar
                      mode="single"
                      selected={timeBlockDate}
                      onSelect={date => {
                        if (date) {
                          const currentTime = timeBlockDate || new Date();
                          date.setHours(currentTime.getHours());
                          date.setMinutes(currentTime.getMinutes());
                          setTimeBlockDate(date);
                        }
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                    <div className="flex gap-2 items-center">
                      <Input
                        type="time"
                        value={timeBlockDate ? format(timeBlockDate, "HH:mm") : ""}
                        onChange={e => {
                          const [hours, minutes] = e.target.value.split(':').map(Number);
                          const newDate = timeBlockDate || new Date();
                          newDate.setHours(hours);
                          newDate.setMinutes(minutes);
                          setTimeBlockDate(new Date(newDate));
                        }}
                        onClick={preventPropagation}
                        onTouchStart={preventPropagation}
                        onMouseDown={preventPropagation}
                        className="pointer-events-auto z-[60]"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timeBlockDuration">Duration</Label>
              <Select
                value={timeBlockDuration}
                onValueChange={setTimeBlockDuration}
              >
                <SelectTrigger onClick={preventPropagation}>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="20">20 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={handleTimeBlockSubmit}>Create Time Block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
