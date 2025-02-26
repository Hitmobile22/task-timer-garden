
import React from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SoundSettingsMenu } from './SoundSettings';
import { toast } from 'sonner';

interface TimerControlsProps {
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  isBreak: boolean;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  handleReset: () => void;
  playSound: (type: 'tick' | 'task' | 'break') => void;
  soundSettings: Record<'tick' | 'task' | 'break', string>;
  setSoundSettings: (settings: Record<'tick' | 'task' | 'break', string>) => void;
  availableSounds: Record<'tick' | 'task' | 'break', string[]>;
}

export const TimerControls: React.FC<TimerControlsProps> = ({
  isRunning,
  setIsRunning,
  isBreak,
  isMuted,
  setIsMuted,
  handleReset,
  playSound,
  soundSettings,
  setSoundSettings,
  availableSounds,
}) => {
  return (
    <div className="timer-controls">
      <Button
        onClick={() => {
          setIsRunning(!isRunning);
          if (!isRunning) {
            toast.info(isBreak ? "Break started" : "Work session started");
            playSound(isBreak ? 'break' : 'task');
          }
        }}
        className="hover-lift w-[44px] h-[44px] p-0"
        variant="outline"
      >
        {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button
        onClick={handleReset}
        variant="outline"
        className="hover-lift w-[44px] h-[44px] p-0"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => setIsMuted(!isMuted)}
        variant="outline"
        className="hover-lift w-[44px] h-[44px] p-0"
      >
        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>
      <SoundSettingsMenu
        soundSettings={soundSettings}
        setSoundSettings={setSoundSettings}
        availableSounds={availableSounds}
        isMuted={isMuted}
      />
    </div>
  );
};
