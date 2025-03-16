
import React from 'react';
import { Button } from '@/components/ui/button';

type SoundType = 'tick' | 'task' | 'break';
type SoundSettings = Record<SoundType, string>;

interface SoundSettingsProps {
  soundSettings: SoundSettings;
  setSoundSettings: (settings: SoundSettings) => void;
  availableSounds: Record<string, string[]>;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  playSound: (type: SoundType) => void;
  onClose: () => void;
}

export const SoundSettingsMenu: React.FC<SoundSettingsProps> = ({
  soundSettings,
  setSoundSettings,
  availableSounds,
  isMuted,
  setIsMuted,
  playSound,
  onClose,
}) => {
  const getDisplayName = (soundPath: string) => {
    if (soundPath === 'none') return 'No Sound';
    const fileName = soundPath.split('/').pop() || '';
    return fileName.replace('.wav', '');
  };

  const handleSoundChange = (type: SoundType, sound: string) => {
    console.log(`Changing ${type} sound to:`, sound);
    const newSettings = { ...soundSettings, [type]: sound };
    setSoundSettings(newSettings);
    
    // Play the selected sound for preview if not muted and not set to 'none'
    if (!isMuted && sound !== 'none') {
      console.log(`Playing ${type} sound preview:`, sound);
      setTimeout(() => playSound(type), 100);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Sound Settings</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕
        </Button>
      </div>
      
      <div className="mb-4">
        <Button 
          variant={isMuted ? "outline" : "default"} 
          className="w-full justify-center"
          onClick={() => setIsMuted(!isMuted)}
        >
          {isMuted ? "Unmute Sounds" : "Mute Sounds"}
        </Button>
      </div>
      
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold mb-2">Tick Sound</h4>
          <div className="grid grid-cols-2 gap-2">
            {availableSounds.tick.map((sound) => (
              <Button
                key={sound}
                variant={soundSettings.tick === sound ? "default" : "outline"}
                className={`${isMuted ? 'opacity-50' : ''} justify-start`}
                onClick={() => handleSoundChange('tick', sound)}
              >
                {getDisplayName(sound)}
              </Button>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-semibold mb-2">Task Sound</h4>
          <div className="grid grid-cols-2 gap-2">
            {availableSounds.task.map((sound) => (
              <Button
                key={sound}
                variant={soundSettings.task === sound ? "default" : "outline"}
                className={`${isMuted ? 'opacity-50' : ''} justify-start`}
                onClick={() => handleSoundChange('task', sound)}
              >
                {getDisplayName(sound)}
              </Button>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-semibold mb-2">Break Sound</h4>
          <div className="grid grid-cols-2 gap-2">
            {availableSounds.break.map((sound) => (
              <Button
                key={sound}
                variant={soundSettings.break === sound ? "default" : "outline"}
                className={`${isMuted ? 'opacity-50' : ''} justify-start`}
                onClick={() => handleSoundChange('break', sound)}
              >
                {getDisplayName(sound)}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
