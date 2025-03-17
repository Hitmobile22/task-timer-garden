
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Settings, Shuffle, Maximize2, Minimize2 } from "lucide-react";
import { SoundSettingsMenu } from './SoundSettings';

interface TimerControlsProps {
  isRunning: boolean;
  setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
  isBreak: boolean;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  handleReset: () => void;
  playSound: (type: 'tick' | 'break' | 'task') => void;
  previewSound?: (type: 'tick' | 'break' | 'task', soundPath: string) => void;
  soundSettings: Record<'tick' | 'break' | 'task', string>;
  setSoundSettings: React.Dispatch<React.SetStateAction<Record<'tick' | 'break' | 'task', string>>>;
  availableSounds: Record<string, string[]>;
  onShuffleTasks?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export const TimerControls: React.FC<TimerControlsProps> = ({
  isRunning,
  setIsRunning,
  isBreak,
  isMuted,
  setIsMuted,
  handleReset,
  playSound,
  previewSound,
  soundSettings,
  setSoundSettings,
  availableSounds,
  onShuffleTasks,
  onToggleFullscreen,
  isFullscreen
}) => {
  const [showSoundSettings, setShowSoundSettings] = useState(false);

  // Test sound when unmuting
  useEffect(() => {
    if (!isMuted) {
      const soundType = isBreak ? 'break' : 'task';
      playSound(soundType);
    }
  }, [isMuted, isBreak, playSound]);

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
        onClick={() => {
          setIsMuted(!isMuted);
          console.log("Mute toggled:", !isMuted);
        }}
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
      
      {onToggleFullscreen && (
        <Button
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full"
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
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
              previewSound={previewSound}
              onClose={() => setShowSoundSettings(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
