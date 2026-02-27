import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isProgressPulse, isPulseLocked } from '@/utils/taskUtils';
import { useMemo } from 'react';

export interface PulseItem {
  id: number;
  pulse_task_id: number;
  item_name: string;
  item_type: 'subtask' | 'task';
  is_completed: boolean;
  user_id: string;
  created_at: string;
}

export const useProgressPulse = (todayTasks?: any[]) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Find active (unlocked) pulse time block from today's tasks
  const activePulse = useMemo(() => {
    if (!todayTasks) return null;
    return todayTasks.find(t => isProgressPulse(t) && !isPulseLocked(t)) || null;
  }, [todayTasks]);

  // Find any pulse (locked or unlocked) from today's tasks
  const anyPulse = useMemo(() => {
    if (!todayTasks) return null;
    return todayTasks.find(t => isProgressPulse(t)) || null;
  }, [todayTasks]);

  const pulseTaskId = anyPulse?.id;

  // Fetch pulse items
  const { data: pulseItems = [] } = useQuery({
    queryKey: ['pulse-items', pulseTaskId],
    queryFn: async () => {
      if (!pulseTaskId) return [];
      const { data, error } = await supabase
        .from('progress_pulse_items')
        .select('*')
        .eq('pulse_task_id', pulseTaskId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as PulseItem[];
    },
    enabled: !!pulseTaskId,
  });

  // Compute progress
  const totalItems = pulseItems.length;
  const completedItems = pulseItems.filter(i => i.is_completed).length;
  const progress = totalItems > 0 ? completedItems / totalItems : 0;

  // Interpolate colors based on progress
  const getProgressStyles = () => {
    if (progress >= 1 && totalItems > 0) {
      // 100% - glowing purple
      return {
        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        animation: 'glow-purple 2s ease-in-out infinite',
      };
    }

    // Interpolate hue: green (142) -> orange (25)
    const hue = 142 - progress * (142 - 25);
    // Interpolate animation duration: 3s -> 1s
    const duration = Math.max(1, 3 - progress * 2);

    return {
      background: `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${hue - 10}, 80%, 45%))`,
      animation: `pulse-progress ${duration}s ease-in-out infinite`,
    };
  };

  // Add item to pulse
  const addItemToPulse = useMutation({
    mutationFn: async ({ itemName, itemType }: { itemName: string; itemType: 'subtask' | 'task' }) => {
      if (!activePulse || !user?.id) throw new Error('No active pulse');
      
      // Check if already added
      const existing = pulseItems.find(i => i.item_name === itemName && i.item_type === itemType);
      if (existing) throw new Error('Already added to pulse');

      const { error } = await supabase
        .from('progress_pulse_items')
        .insert({
          pulse_task_id: activePulse.id,
          item_name: itemName,
          item_type: itemType,
          user_id: user.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-items'] });
    },
  });

  // Remove item from pulse
  const removeItemFromPulse = useMutation({
    mutationFn: async (itemId: number) => {
      const { error } = await supabase
        .from('progress_pulse_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-items'] });
    },
  });

  // Lock the pulse
  const lockPulse = useMutation({
    mutationFn: async () => {
      if (!activePulse) throw new Error('No active pulse');
      
      const details = typeof activePulse.details === 'string'
        ? JSON.parse(activePulse.details)
        : { ...activePulse.details };
      
      details.isLocked = true;

      const { error } = await supabase
        .from('Tasks')
        .update({ details })
        .eq('id', activePulse.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
    },
  });

  // Unlock the pulse
  const unlockPulse = useMutation({
    mutationFn: async () => {
      if (!anyPulse) throw new Error('No pulse to unlock');
      
      const details = typeof anyPulse.details === 'string'
        ? JSON.parse(anyPulse.details)
        : { ...anyPulse.details };
      
      details.isLocked = false;

      const { error } = await supabase
        .from('Tasks')
        .update({ details })
        .eq('id', anyPulse.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
    },
  });

  // Mark matching pulse items as completed (call after completing a task/subtask)
  const checkAndUpdatePulseCompletion = async (itemName: string) => {
    if (!pulseTaskId || !user?.id) return;

    const { error } = await supabase
      .from('progress_pulse_items')
      .update({ is_completed: true })
      .eq('pulse_task_id', pulseTaskId)
      .eq('item_name', itemName)
      .eq('is_completed', false);

    if (error) {
      console.error('Error updating pulse item:', error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['pulse-items'] });
    }
  };

  return {
    activePulse,
    anyPulse,
    pulseItems,
    progress,
    totalItems,
    completedItems,
    getProgressStyles,
    addItemToPulse,
    removeItemFromPulse,
    lockPulse,
    unlockPulse,
    checkAndUpdatePulseCompletion,
    hasActivePulse: !!activePulse,
    hasAnyPulse: !!anyPulse,
    isPulseLocked: anyPulse ? isPulseLocked(anyPulse) : false,
  };
};
