
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Settings, Shuffle } from "lucide-react";
import { SoundSettings } from './SoundSettings';

interface TimerControlsProps {
  isRunning: boolean;
  setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
  isBreak: boolean;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  handleReset: () => void;
  playSound: (type: 'tick' | 'break' | 'task') => void;
  soundSettings: Record<string, string>;
  setSoundSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
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
        <SoundSettings
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          soundSettings={soundSettings}
          setSoundSettings={setSoundSettings}
          availableSounds={availableSounds}
          playSound={playSound}
          onClose={() => setShowSoundSettings(false)}
        />
      )}
    </div>
  );
};
