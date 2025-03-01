
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Settings, Shuffle } from "lucide-react";
import { SoundSettingsMenu } from './SoundSettings';

interface TimerControlsProps {
  isRunning: boolean;
  setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
  isBreak: boolean;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  handleReset: () => void;
  playSound: (type: 'tick' | 'break' | 'task') => void;
  soundSettings: Record<'tick' | 'break' | 'task', string>;
  setSoundSettings: React.Dispatch<React.SetStateAction<Record<'tick' | 'break' | 'task', string>>>;
  availableSounds: Record<string, string[]>;
  onShuffleTasks?: () => void;
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
  onShuffleTasks
}) => {
  const [showSoundSettings, setShowSoundSettings] = useState(false);

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="w-12 h-12 rounded-full"
        onClick={() => setIsRunning(!isRunning)}
      >
        {isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="w-12 h-12 rounded-full"
        onClick={handleReset}
      >
        <RotateCcw className="h-5 w-5" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="w-12 h-12 rounded-full"
        onClick={() => setIsMuted(!isMuted)}
      >
        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="w-12 h-12 rounded-full"
        onClick={() => setShowSoundSettings(!showSoundSettings)}
      >
        <Settings className="h-5 w-5" />
      </Button>
      
      {onShuffleTasks && (
        <Button
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full"
          onClick={onShuffleTasks}
        >
          <Shuffle className="h-5 w-5" />
        </Button>
      )}

      {showSoundSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowSoundSettings(false)}>
          <div className="bg-background p-4 rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()}>
            <SoundSettingsMenu
              isMuted={isMuted}
              setIsMuted={setIsMuted}
              soundSettings={soundSettings}
              setSoundSettings={setSoundSettings}
              availableSounds={availableSounds}
              playSound={playSound}
              onClose={() => setShowSoundSettings(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
