
import React from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SoundType = 'tick' | 'task' | 'break';
type SoundSettings = Record<SoundType, string>;

interface SoundSettingsProps {
  soundSettings: SoundSettings;
  setSoundSettings: (settings: SoundSettings) => void;
  availableSounds: Record<SoundType, string[]>;
  isMuted: boolean;
}

export const SoundSettingsMenu: React.FC<SoundSettingsProps> = ({
  soundSettings,
  setSoundSettings,
  availableSounds,
  isMuted,
}) => {
  const getDisplayName = (soundPath: string) => {
    const fileName = soundPath.split('/').pop() || '';
    return fileName.replace('.wav', '');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`hover-lift ${isMuted ? 'opacity-50' : ''}`}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-background border shadow-lg">
        <DropdownMenuLabel>Sound Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">Tick Sound</DropdownMenuLabel>
          {availableSounds.tick.map((sound) => (
            <DropdownMenuItem
              key={sound}
              onClick={() => setSoundSettings({ ...soundSettings, tick: sound })}
              className={`px-2 py-1.5 ${isMuted ? 'opacity-50' : 'cursor-pointer hover:bg-accent'}`}
            >
              {getDisplayName(sound)}
              {soundSettings.tick === sound && <span className="ml-2">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">Task Sound</DropdownMenuLabel>
          {availableSounds.task.map((sound) => (
            <DropdownMenuItem
              key={sound}
              onClick={() => setSoundSettings({ ...soundSettings, task: sound })}
              className={`px-2 py-1.5 ${isMuted ? 'opacity-50' : 'cursor-pointer hover:bg-accent'}`}
            >
              {getDisplayName(sound)}
              {soundSettings.task === sound && <span className="ml-2">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">Break Sound</DropdownMenuLabel>
          {availableSounds.break.map((sound) => (
            <DropdownMenuItem
              key={sound}
              onClick={() => setSoundSettings({ ...soundSettings, break: sound })}
              className={`px-2 py-1.5 ${isMuted ? 'opacity-50' : 'cursor-pointer hover:bg-accent'}`}
            >
              {getDisplayName(sound)}
              {soundSettings.break === sound && <span className="ml-2">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
