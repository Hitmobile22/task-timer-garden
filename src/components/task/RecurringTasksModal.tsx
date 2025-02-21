
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

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

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const RecurringTasksModal = ({
  open,
  onClose,
  onSubmit,
  listName,
  listId,
  initialSettings,
}: RecurringTasksModalProps) => {
  const [settings, setSettings] = useState<RecurringTaskSettings>(
    initialSettings || {
      enabled: false,
      dailyTaskCount: 1,
      daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    }
  );

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('recurring_task_settings')
          .select('*')
          .eq('task_list_id', listId)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setSettings({
            enabled: data.enabled,
            dailyTaskCount: data.daily_task_count,
            daysOfWeek: data.days_of_week,
          });
        }
      } catch (error) {
        console.error('Error loading recurring task settings:', error);
        toast.error('Failed to load recurring task settings');
      }
    };

    if (open && listId) {
      loadSettings();
    }
  }, [open, listId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('recurring_task_settings')
        .upsert({
          task_list_id: listId,
          enabled: settings.enabled,
          daily_task_count: settings.dailyTaskCount,
          days_of_week: settings.daysOfWeek,
        });

      if (error) throw error;

      onSubmit(settings);
      onClose();
      toast.success('Recurring task settings saved');

      // Trigger immediate check for new tasks if enabled
      if (settings.enabled) {
        const { error: checkError } = await supabase.functions.invoke('check-recurring-tasks');
        if (checkError) throw checkError;
      }
    } catch (error) {
      console.error('Error saving recurring task settings:', error);
      toast.error('Failed to save recurring task settings');
    }
  };

  const toggleDay = (day: string) => {
    setSettings(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Recurring Tasks for {listName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="recurring-enabled">Enable Recurring Tasks</Label>
            <Switch
              id="recurring-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, enabled: checked }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="daily-count">Daily Task Count</Label>
            <Input
              id="daily-count"
              type="number"
              min="1"
              max="10"
              value={settings.dailyTaskCount}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  dailyTaskCount: parseInt(e.target.value) || 1,
                }))
              }
              disabled={!settings.enabled}
            />
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
                    disabled={!settings.enabled}
                  />
                  <Label htmlFor={`day-${day}`}>{day}</Label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
