
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
}

export const SoundSettingsMenu: React.FC<SoundSettingsProps> = ({
  soundSettings,
  setSoundSettings,
  availableSounds,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="hover-lift"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Sound Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">Tick Sound</DropdownMenuLabel>
          {availableSounds.tick.map((sound, index) => (
            <DropdownMenuItem
              key={sound}
              onClick={() => setSoundSettings({ ...soundSettings, tick: sound })}
            >
              Tick Sound {index + 1}
              {soundSettings.tick === sound && " ✓"}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">Task Sound</DropdownMenuLabel>
          {availableSounds.task.map((sound, index) => (
            <DropdownMenuItem
              key={sound}
              onClick={() => setSoundSettings({ ...soundSettings, task: sound })}
            >
              Task Sound {index + 1}
              {soundSettings.task === sound && " ✓"}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">Break Sound</DropdownMenuLabel>
          {availableSounds.break.map((sound, index) => (
            <DropdownMenuItem
              key={sound}
              onClick={() => setSoundSettings({ ...soundSettings, break: sound })}
            >
              Break Sound {index + 1}
              {soundSettings.break === sound && " ✓"}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
