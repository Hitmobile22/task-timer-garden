
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';
import { getCurrentDayName } from '@/lib/utils';

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
}

interface DatabaseRecurringTaskSettings {
  id: number;
  task_list_id: number;
  enabled: boolean;
  daily_task_count: number;
  days_of_week: string[];
  created_at: string;
  updated_at: string;
}

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
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentSettingId, setCurrentSettingId] = useState<number | null>(null);
  const [settingsChanged, setSettingsChanged] = useState(false);

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
            enabled: mostRecentSetting.enabled,
            dailyTaskCount: mostRecentSetting.daily_task_count,
            daysOfWeek: mostRecentSetting.days_of_week,
          });
        } else {
          // Reset to defaults if no settings found
          console.log('No settings found, using defaults');
          setCurrentSettingId(null);
          setSettings({
            enabled: false,
            dailyTaskCount: 1,
            daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
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
      
      // Always create a new settings record for this list
      // This ensures we have a clear history and the most recent settings are always used
      const { data, error } = await supabase
        .from('recurring_task_settings')
        .insert({
          task_list_id: listId,
          enabled: settings.enabled,
          daily_task_count: settings.dailyTaskCount,
          days_of_week: settings.daysOfWeek,
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
      onClose();
      toast.success('Recurring task settings saved');

      // Only check for new tasks if enabled and settings changed
      if (settings.enabled) {
        try {
          // Get the current day
          const currentDay = getCurrentDayName();
          
          // Only check if the current day is in the selected days
          if (settings.daysOfWeek.includes(currentDay)) {
            console.log('Running check for recurring tasks after saving settings');
            const { error: checkError } = await supabase.functions.invoke('check-recurring-tasks', {
              body: { 
                forceCheck: true,
                specificListId: listId
              }
            });
            
            if (checkError) {
              console.error('Error checking recurring tasks:', checkError);
              throw checkError;
            }
          } else {
            console.log(`Current day (${currentDay}) is not in selected days, skipping task check`);
          }
        } catch (checkError) {
          console.error('Error checking recurring tasks:', checkError);
          toast.error('Failed to check for recurring tasks');
        }
      }
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

  const toggleDay = (day: string) => {
    updateSettings({
      daysOfWeek: settings.daysOfWeek.includes(day)
        ? settings.daysOfWeek.filter(d => d !== day)
        : [...settings.daysOfWeek, day],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Recurring Tasks for {listName}</DialogTitle>
          <DialogDescription>
            Configure automatic task creation for this list. Tasks will be created at 9 AM daily.
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
                Tasks will be generated daily at 9 AM on selected days.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Days of Week</Label>
              <div className="grid grid-cols-2 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day}`}
                      checked={settings.daysOfWeek.includes(day)}
                      onCheckedChange={() => toggleDay(day)}
                      disabled={!settings.enabled || isSaving}
                    />
                    <Label htmlFor={`day-${day}`}>{day}</Label>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
