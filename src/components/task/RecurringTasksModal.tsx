
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Plus, Minus } from "lucide-react";
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getCurrentDayName, getTodayISOString, getTomorrowISOString } from '@/lib/utils';
import { toZonedTime } from 'date-fns-tz';

interface RecurringTasksModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (settings: RecurringTaskSettings) => void;
  listName: string;
  listId: number;
  initialSettings?: RecurringTaskSettings;
}

export interface RecurringTaskSettings {
  enabled: boolean;
  dailyTaskCount: number;
  daysOfWeek: string[];
  subtaskNames: string[];
  subtaskMode: string;
  respawnIntervalValue: number;
  respawnDaysOfWeek: string[];
}

type SubtaskMode = 'on_task_creation' | 'progressive' | 'daily' | 'every_x_days' | 'every_x_weeks' | 'days_of_week';

const SUBTASK_MODE_OPTIONS: { value: SubtaskMode; label: string }[] = [
  { value: 'on_task_creation', label: 'On Task Creation' },
  { value: 'progressive', label: 'Progressive Mode' },
  { value: 'daily', label: 'Daily' },
  { value: 'every_x_days', label: 'Every X Days' },
  { value: 'every_x_weeks', label: 'Every X Weeks' },
  { value: 'days_of_week', label: 'Days of Week' },
];

const SUBTASK_MODE_DESCRIPTIONS: Record<SubtaskMode, string> = {
  'on_task_creation': 'Subtasks are created once when the task is created and marked complete when done.',
  'progressive': 'Completing a subtask permanently removes it from the template for future tasks.',
  'daily': 'Completed subtasks respawn every day.',
  'every_x_days': 'Completed subtasks respawn after X days.',
  'every_x_weeks': 'Completed subtasks respawn after X weeks.',
  'days_of_week': 'Completed subtasks respawn on specific days of the week.',
};

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAILY_TASK_COUNT_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

const DaysOfWeekSelector = ({
  selectedDays,
  onChange,
  disabled
}) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {DAYS_OF_WEEK.map((day) => (
        <div key={day} className="flex items-center space-x-2">
          <Checkbox
            id={`day-${day}`}
            checked={selectedDays.includes(day)}
            onCheckedChange={(checked) => {
              const newDays = checked
                ? [...selectedDays, day]
                : selectedDays.filter(d => d !== day);
              onChange(newDays);
            }}
            disabled={disabled}
          />
          <Label htmlFor={`day-${day}`}>{day}</Label>
        </div>
      ))}
    </div>
  );
};

export const RecurringTasksModal = ({
  open,
  onClose,
  onSubmit,
  listName,
  listId,
}: RecurringTasksModalProps) => {
  const [settings, setSettings] = useState<RecurringTaskSettings>({
    enabled: false,
    dailyTaskCount: 1,
    daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    subtaskNames: [],
    subtaskMode: 'on_task_creation',
    respawnIntervalValue: 1,
    respawnDaysOfWeek: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentSettingId, setCurrentSettingId] = useState<number | null>(null);
  const [settingsChanged, setSettingsChanged] = useState(false);
  const [isCheckingTasks, setIsCheckingTasks] = useState(false);

  const checkTodayLog = async (settingId: number) => {
    if (!settingId) return null;
    
    try {
      const today = getTodayISOString();
      const tomorrow = getTomorrowISOString();
      
      const { data, error } = await supabase
        .from('recurring_task_generation_logs')
        .select('*')
        .eq('task_list_id', listId)
        .eq('setting_id', settingId)
        .gte('generation_date', today)
        .lt('generation_date', tomorrow)
        .maybeSingle();
        
      if (error) {
        console.error(`Error checking generation log for list ${listId}:`, error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error in checkTodayLog:', error);
      return null;
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      if (!open || !listId) return;
      
      setIsLoading(true);
      try {
        console.log(`Loading recurring task settings for list ID ${listId}`);
        // Always get the most recent setting for this task list
        const { data: allSettings, error } = await supabase
          .from('recurring_task_settings')
          .select('*')
          .eq('task_list_id', listId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error loading recurring task settings:', error);
          throw error;
        }

        const mostRecentSetting = allSettings && allSettings.length > 0 ? allSettings[0] : null;

        if (mostRecentSetting) {
          console.log('Loaded recurring task settings:', mostRecentSetting);
          setCurrentSettingId(mostRecentSetting.id);
          setSettings({
            enabled: mostRecentSetting.enabled ?? false,
            dailyTaskCount: mostRecentSetting.daily_task_count ?? 1,
            daysOfWeek: mostRecentSetting.days_of_week ?? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            subtaskNames: mostRecentSetting.subtask_names ?? [],
            subtaskMode: mostRecentSetting.subtask_mode ?? 'on_task_creation',
            respawnIntervalValue: mostRecentSetting.respawn_interval_value ?? 1,
            respawnDaysOfWeek: mostRecentSetting.respawn_days_of_week ?? [],
          });
        } else {
          // Reset to defaults if no settings found
          console.log('No settings found, using defaults');
          setCurrentSettingId(null);
          setSettings({
            enabled: false,
            dailyTaskCount: 1,
            daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            subtaskNames: [],
            subtaskMode: 'on_task_creation',
            respawnIntervalValue: 1,
            respawnDaysOfWeek: [],
          });
        }
        
        setSettingsChanged(false);
      } catch (error) {
        console.error('Error loading recurring task settings:', error);
        toast.error('Failed to load recurring task settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [open, listId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSaving) {
      console.log('Already saving settings, please wait...');
      return;
    }
    
    if (!settingsChanged) {
      console.log('Settings not changed, closing modal');
      onClose();
      return;
    }
    
    setIsSaving(true);
    
    try {
      console.log(`Saving recurring task settings for list ID ${listId}:`, settings);
      
      // Validate that at least one day is selected
      if (settings.enabled && (!settings.daysOfWeek || settings.daysOfWeek.length === 0)) {
        toast.error('Please select at least one day of the week');
        setIsSaving(false);
        return;
      }
      
      // CRITICAL: First, disable all existing enabled settings for this task list
      // This prevents the disconnect between UI (showing most recent) and backend (using any enabled setting)
      const { error: disableError } = await supabase
        .from('recurring_task_settings')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('task_list_id', listId)
        .eq('enabled', true);

      if (disableError) {
        console.error('Error disabling old settings:', disableError);
        throw disableError;
      }
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Now create the new settings record
      // This ensures we have a clear history and the most recent settings are always used
      const { data, error } = await supabase
        .from('recurring_task_settings')
        .insert({
          task_list_id: listId,
          enabled: settings.enabled,
          daily_task_count: settings.dailyTaskCount,
          days_of_week: settings.daysOfWeek,
          subtask_names: settings.subtaskNames.filter(name => name.trim() !== ''),
          subtask_mode: settings.subtaskMode,
          respawn_interval_value: settings.respawnIntervalValue,
          respawn_days_of_week: settings.respawnDaysOfWeek,
          user_id: user?.id,
        })
        .select();

      if (error) {
        console.error('Error saving recurring task settings:', error);
        throw error;
      }

      if (data && data.length > 0) {
        setCurrentSettingId(data[0].id);
        console.log('Successfully saved new settings record:', data[0]);
      }

      onSubmit(settings);
      toast.success('Recurring task settings saved');

      // Only check for new tasks if enabled and settings changed and it's the selected day
      if (settings.enabled) {
        try {
          setIsCheckingTasks(true);
          // Get the current day
          const currentDay = getCurrentDayName();
          console.log(`Current day is ${currentDay}, selected days are ${settings.daysOfWeek.join(', ')}`);
          
          // Check if current day is in the selected days
          const isDaySelected = settings.daysOfWeek.includes(currentDay);
          console.log(`Is today (${currentDay}) selected for task generation? ${isDaySelected}`);
          
          // First check how many active tasks we already have
          const { data: activeTasks, error: countError } = await supabase
            .from('Tasks')
            .select('id')
            .eq('task_list_id', listId)
            .in('Progress', ['Not started', 'In progress']);
            
          if (countError) {
            console.error('Error counting active tasks:', countError);
          } else {
            const activeTaskCount = activeTasks?.length || 0;
            console.log(`List already has ${activeTaskCount} active tasks out of goal ${settings.dailyTaskCount}`);
            
            // Only check if the current day is in the selected days
            // Use forceCheck=true only when the day is actually selected
            if (isDaySelected) {
              console.log('Running check for recurring tasks after saving settings');
              
              // Check if there's already a generation log for today
              const newSettingId = data?.[0]?.id || currentSettingId;
              const today = getTodayISOString();
              const tomorrow = getTomorrowISOString();
              
              const { data: existingLog, error: logError } = await supabase
                .from('recurring_task_generation_logs')
                .select('*')
                .eq('task_list_id', listId)
                .eq('setting_id', newSettingId)
                .gte('generation_date', today)
                .lt('generation_date', tomorrow)
                .maybeSingle();
                
              if (logError) {
                console.error('Error checking for existing generation log:', logError);
              }
                
              // If there's already a log, and tasks generated >= daily count, no need to check
              if (existingLog && existingLog.tasks_generated >= settings.dailyTaskCount) {
                console.log(`Already generated ${existingLog.tasks_generated} tasks today (target: ${settings.dailyTaskCount}), skipping check`);
              } else {
                // Force check for the specific list only if current day is in selected days
                const { error: checkError } = await supabase.functions.invoke('check-recurring-tasks', {
                  body: { 
                    forceCheck: true,
                    specificListId: listId,
                    currentDay: currentDay
                  }
                });
                
                if (checkError) {
                  console.error('Error checking recurring tasks:', checkError);
                  throw checkError;
                }
              }
            } else {
              console.log(`Current day (${currentDay}) is not in selected days, skipping task check`);
            }
          }
        } catch (checkError) {
          console.error('Error checking recurring tasks:', checkError);
          toast.error('Failed to check for recurring tasks');
        } finally {
          setIsCheckingTasks(false);
        }
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving recurring task settings:', error);
      toast.error('Failed to save recurring task settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSettings = (updatedSettings: Partial<RecurringTaskSettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updatedSettings };
      setSettingsChanged(true);
      return newSettings;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Recurring Tasks for {listName}</DialogTitle>
          <DialogDescription>
            Configure automatic task creation for this list. Tasks will be created at 9 AM on the selected days
            if you don't already have enough active tasks.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-6 text-center">Loading settings...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="recurring-enabled">Enable Recurring Tasks</Label>
              <Switch
                id="recurring-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) =>
                  updateSettings({ enabled: checked })
                }
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-count">Daily Task Count</Label>
              <Select
                value={settings.dailyTaskCount.toString()}
                onValueChange={(value) =>
                  updateSettings({
                    dailyTaskCount: parseInt(value) || 1,
                  })
                }
                disabled={!settings.enabled || isSaving}
              >
                <SelectTrigger id="daily-count" className="w-full">
                  <SelectValue placeholder="Select daily task count" />
                </SelectTrigger>
                <SelectContent>
                  {DAILY_TASK_COUNT_OPTIONS.map((count) => (
                    <SelectItem key={count} value={count.toString()}>
                      {count}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The system will maintain this number of active tasks (Not Started or In Progress) for the selected days.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Days of Week</Label>
              <DaysOfWeekSelector
                selectedDays={settings.daysOfWeek}
                onChange={(days) => updateSettings({ daysOfWeek: days })}
                disabled={!settings.enabled || isSaving}
              />
              {settings.enabled && settings.daysOfWeek.length === 0 && (
                <p className="text-xs text-red-500">
                  Please select at least one day
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                New tasks will only be created if you have fewer active tasks than your daily target.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Subtasks</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => updateSettings({ subtaskNames: [...settings.subtaskNames, ''] })}
                  disabled={!settings.enabled || isSaving}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {settings.subtaskNames.length > 0 && (
                <div className="space-y-2 border-l-2 border-primary/20 pl-3">
                  {settings.subtaskNames.map((subtaskName, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={subtaskName}
                        onChange={(e) => {
                          const newSubtaskNames = [...settings.subtaskNames];
                          newSubtaskNames[index] = e.target.value;
                          updateSettings({ subtaskNames: newSubtaskNames });
                        }}
                        placeholder={`Subtask ${index + 1}`}
                        disabled={!settings.enabled || isSaving}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newSubtaskNames = settings.subtaskNames.filter((_, i) => i !== index);
                          updateSettings({ subtaskNames: newSubtaskNames });
                        }}
                        disabled={!settings.enabled || isSaving}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                These subtasks will be automatically added to each recurring task created.
              </p>
              
              {settings.subtaskNames.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-primary/10 mt-3">
                  <div className="space-y-2">
                    <Label>Subtask Mode</Label>
                    <Select
                      value={settings.subtaskMode}
                      onValueChange={(value) => updateSettings({ subtaskMode: value })}
                      disabled={!settings.enabled || isSaving}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBTASK_MODE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {SUBTASK_MODE_DESCRIPTIONS[settings.subtaskMode as SubtaskMode]}
                    </p>
                  </div>
                  
                  {(settings.subtaskMode === 'every_x_days' || settings.subtaskMode === 'every_x_weeks') && (
                    <div className="flex items-center gap-2">
                      <Label>Every</Label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={settings.respawnIntervalValue}
                        onChange={(e) => updateSettings({ respawnIntervalValue: parseInt(e.target.value) || 1 })}
                        className="w-20"
                        disabled={!settings.enabled || isSaving}
                      />
                      <span className="text-sm text-muted-foreground">
                        {settings.subtaskMode === 'every_x_days' ? 'days' : 'weeks'}
                      </span>
                    </div>
                  )}
                  
                  {settings.subtaskMode === 'days_of_week' && (
                    <div className="space-y-2">
                      <Label>Respawn Days</Label>
                      <DaysOfWeekSelector
                        selectedDays={settings.respawnDaysOfWeek}
                        onChange={(days) => updateSettings({ respawnDaysOfWeek: days })}
                        disabled={!settings.enabled || isSaving}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSaving || isCheckingTasks}>
                {isSaving 
                  ? 'Saving...' 
                  : isCheckingTasks 
                    ? 'Creating Tasks...' 
                    : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
