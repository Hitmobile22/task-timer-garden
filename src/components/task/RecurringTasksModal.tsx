
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress } from '@/components/ui/progress';

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function RecurringTasksModal({
  isOpen,
  onClose,
  taskListId,
}: {
  isOpen: boolean;
  onClose: () => void;
  taskListId: number;
}) {
  const [enabled, setEnabled] = useState(false);
  const [taskCount, setTaskCount] = useState(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  // Fetch existing settings for this task list
  const { data: existingSettings, isLoading } = useQuery({
    queryKey: ['recurring-settings', taskListId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_task_settings')
        .select('*')
        .eq('task_list_id', taskListId)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!taskListId
  });
  
  // Normalize day names function to ensure consistency
  const normalizeDayName = (day: string): string => {
    // Ensure proper capitalization
    const formattedDay = day.trim().charAt(0).toUpperCase() + day.trim().slice(1).toLowerCase();
    
    // Validate that it's a real day
    if (DAYS_OF_WEEK.includes(formattedDay)) {
      return formattedDay;
    }
    
    // Log if we find an abnormal day
    console.warn(`Found abnormal day name: "${day}", normalized to "${formattedDay}"`);
    return formattedDay;
  };
  
  // Set form values when settings are loaded
  useEffect(() => {
    if (existingSettings) {
      setEnabled(existingSettings.enabled);
      setTaskCount(existingSettings.daily_task_count || 1);
      
      // Normalize day names for consistency
      if (Array.isArray(existingSettings.days_of_week)) {
        const normalizedDays = existingSettings.days_of_week.map(normalizeDayName);
        setSelectedDays(normalizedDays);
        
        if (JSON.stringify(normalizedDays) !== JSON.stringify(existingSettings.days_of_week)) {
          console.log('Normalized day names', {
            original: existingSettings.days_of_week,
            normalized: normalizedDays
          });
        }
      } else {
        // Default to weekdays if invalid data
        setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      }
    } else {
      // Default values for new settings
      setEnabled(false);
      setTaskCount(1);
      setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    }
  }, [existingSettings]);
  
  // Toggle a day selection
  const toggleDay = (day: string) => {
    const normalizedDay = normalizeDayName(day);
    if (selectedDays.includes(normalizedDay)) {
      setSelectedDays(selectedDays.filter(d => d !== normalizedDay));
    } else {
      setSelectedDays([...selectedDays, normalizedDay]);
    }
  };
  
  // Save the settings
  const saveSettings = async () => {
    try {
      setIsSaving(true);
      
      // Validate form
      if (selectedDays.length === 0) {
        toast.error('Please select at least one day of the week');
        setIsSaving(false);
        return;
      }
      
      if (taskCount < 1) {
        toast.error('Task count must be at least 1');
        setIsSaving(false);
        return;
      }
      
      // Ensure days are properly formatted
      const normalizedDays = selectedDays.map(normalizeDayName);
      
      if (existingSettings?.id) {
        // Update existing settings
        const { error } = await supabase
          .from('recurring_task_settings')
          .update({
            enabled: enabled,
            daily_task_count: taskCount,
            days_of_week: normalizedDays,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSettings.id);
          
        if (error) throw error;
        
      } else {
        // Create new settings
        const { error } = await supabase
          .from('recurring_task_settings')
          .insert({
            task_list_id: taskListId,
            enabled: enabled,
            daily_task_count: taskCount,
            days_of_week: normalizedDays
          });
          
        if (error) throw error;
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({queryKey: ['recurring-settings']});
      queryClient.invalidateQueries({queryKey: ['task-lists']});
      
      toast.success('Recurring task settings saved');
      onClose();
    } catch (error) {
      console.error('Error saving recurring task settings:', error);
      toast.error('Failed to save recurring task settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Fix UPWORK UPDATE task list if it's list 22 - ONLY THIS SPECIFIC LIST
  useEffect(() => {
    if (taskListId === 22 && isOpen && !isLoading && existingSettings) {
      // Check if this list has days configured incorrectly
      const isEveryDay = DAYS_OF_WEEK.every(day => 
        existingSettings.days_of_week.some(configDay => 
          configDay.trim().toLowerCase() === day.toLowerCase()
        )
      );
      
      // If configured for every day and it's the UPWORK list, correct it
      if (isEveryDay) {
        console.log('Correcting UPWORK UPDATE task list to Sunday only');
        setSelectedDays(['Sunday']);
      }
    }
  }, [taskListId, existingSettings, isLoading, isOpen]);
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recurring Task Settings</DialogTitle>
          <DialogDescription>
            Configure when tasks should be created automatically for this list.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="py-8">
            <Progress value={50} className="w-full" />
            <p className="text-center mt-4 text-muted-foreground">Loading settings...</p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enable-recurring">Enable Recurring Tasks</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically create tasks on selected days.
                </p>
              </div>
              <Switch 
                id="enable-recurring"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="task-count">Daily Task Count</Label>
              <Input
                id="task-count"
                type="number"
                min={1}
                value={taskCount}
                onChange={(e) => setTaskCount(Number(e.target.value))}
                disabled={!enabled}
              />
              <p className="text-xs text-muted-foreground">
                Number of tasks to create each day.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Days of Week</Label>
              <div className="grid grid-cols-2 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`day-${day}`}
                      checked={selectedDays.includes(day)}
                      onCheckedChange={() => toggleDay(day)}
                      disabled={!enabled}
                    />
                    <Label htmlFor={`day-${day}`}>{day}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={saveSettings} 
                disabled={!enabled || isSaving || selectedDays.length === 0}
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
