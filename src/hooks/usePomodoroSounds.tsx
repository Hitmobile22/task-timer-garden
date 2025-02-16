
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
    tick: [],
    task: [],
    break: []
  });

  useEffect(() => {
    const loadSounds = async () => {
      try {
        const fetchSoundsFromFolder = async (folder: string) => {
          const response = await fetch(`/sounds/${folder}`);
          const text = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          const files = Array.from(doc.querySelectorAll('a'))
            .map(a => a.href)
            .filter(href => href.endsWith('.wav'))
            .map(href => `/sounds/${folder}/${href.split('/').pop()}`);
          return files;
        };

        const [tickSounds, taskSounds, breakSounds] = await Promise.all([
          fetchSoundsFromFolder('Tick'),
          fetchSoundsFromFolder('Task'),
          fetchSoundsFromFolder('Break')
        ]);

        setAvailableSounds({
          tick: tickSounds,
          task: taskSounds,
          break: breakSounds
        });
      } catch (error) {
        console.error('Error loading sounds:', error);
      }
    };

    loadSounds();
  }, []);

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
