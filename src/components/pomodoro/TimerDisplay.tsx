
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";

interface TimerDisplayProps {
  timeLeft: number | null;
  isBreak: boolean;
  currentTask: any;
  formatTime: (seconds: number) => string;
  getNextTask: () => any;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  timeLeft,
  isBreak,
  currentTask,
  formatTime,
  getNextTask
}) => {
  const progress = timeLeft === null ? 0 : isBreak
    ? ((5 * 60 - timeLeft) / (5 * 60)) * 100
    : ((25 * 60 - timeLeft) / (25 * 60)) * 100;

  // Get project details to display project name instead of just ID
  const { data: projectData } = useQuery({
    queryKey: ['project', currentTask?.project_id],
    queryFn: async () => {
      if (!currentTask?.project_id) return null;
      
      const { data, error } = await supabase
        .from('Projects')
        .select('*')
        .eq('id', currentTask.project_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentTask?.project_id,
  });

  const getProjectName = () => {
    if (!currentTask?.project_id) return null;
    return projectData?.["Project Name"] || `Project ${currentTask.project_id}`;
  };

  const getTimerColor = () => {
    if (isBreak) {
      return 'linear-gradient(184.1deg, rgba(249,255,182,1) 44.7%, rgba(226,255,172,1) 67.2%)';
    }

    const progress = timeLeft === null ? 0 : ((25 * 60 - timeLeft) / (25 * 60)) * 100;
    const colors = {
      start: {
        hue: 150,
        saturation: 85,
        lightness: 45
      },
      end: {
        hue: 200,
        saturation: 70,
        lightness: 70
      }
    };

    const currentHue = colors.start.hue + (progress * (colors.end.hue - colors.start.hue) / 100);
    const currentSaturation = colors.start.saturation + (progress * (colors.end.saturation - colors.start.saturation) / 100);
    const currentLightness = colors.start.lightness + (progress * (colors.end.lightness - colors.start.lightness) / 100);

    return `linear-gradient(109.6deg, hsl(${currentHue}, ${currentSaturation}%, ${currentLightness}%) 11.2%, hsl(${currentHue + 10}, ${currentSaturation - 10}%, ${currentLightness + 5}%) 91.1%)`;
  };

  return (
    <>
      <div className="space-y-2 w-full">
        {isBreak ? (
          <h2 className="text-2xl font-semibold text-primary truncate">
            Break Time
          </h2>
        ) : (
          <h2 className="text-2xl font-semibold text-primary truncate">
            {currentTask?.["Task Name"] || (currentTask?.IsTimeBlock === 'Yes' ? 'Time Block' : 'Work Session')}
          </h2>
        )}
        
        {currentTask && !isBreak && (
          <p className="text-primary/80">
            {currentTask?.IsTimeBlock === 'Yes' ? 'Time Block' : 'Work Session'}
            {currentTask.project_id && (
              <span className="ml-1 text-xs bg-primary/10 px-1 py-0.5 rounded">
                {getProjectName()}
              </span>
            )}
          </p>
        )}
        {isBreak && getNextTask() && (
          <p className="text-primary/80">
            Next up: {getNextTask()?.["Task Name"]}
          </p>
        )}
      </div>

      <div
        className="relative p-6 md:p-8 rounded-xl transition-all duration-300 shadow-lg mx-auto w-full"
        style={{
          background: getTimerColor(),
        }}
      >
        <span className="text-4xl md:text-5xl font-mono font-bold text-primary text-center block">
          {timeLeft !== null ? formatTime(timeLeft) : '25:00'}
        </span>
      </div>

      <Progress
        value={progress}
        className="h-2 w-full"
      />
    </>
  );
};
