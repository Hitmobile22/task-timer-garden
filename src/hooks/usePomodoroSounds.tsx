
import { useState, useEffect, useCallback } from 'react';

type SoundType = 'tick' | 'task' | 'break';
type SoundSettings = Record<SoundType, string>;

export const usePomodoroSounds = (isVisible: boolean) => {
  const [isMuted, setIsMuted] = useState(true);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>({
    tick: '/sounds/Tick/Tick1.wav',
    task: '/sounds/Task/Task1.wav',
    break: '/sounds/Break/Break1.wav'
  });
  const [availableSounds, setAvailableSounds] = useState<Record<SoundType, string[]>>({
    tick: [
      '/sounds/Tick/Tick1.wav',
      '/sounds/Tick/Tick2.wav',
      '/sounds/Tick/Tick3.wav'
    ],
    task: [
      '/sounds/Task/Task1.wav'
    ],
    break: [
      '/sounds/Break/Break1.wav',
      '/sounds/Break/Break2.wav'
    ]
  });

  const playSound = useCallback((type: SoundType) => {
    if (!isMuted && isVisible) {
      const audio = new Audio(soundSettings[type]);
      audio.play().catch(error => console.error('Error playing sound:', error));
    }
  }, [isMuted, isVisible, soundSettings]);

  return {
    isMuted,
    setIsMuted,
    soundSettings,
    setSoundSettings,
    availableSounds,
    playSound
  };
};
