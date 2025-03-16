
import { useState, useEffect, useCallback, useRef } from 'react';

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
      'none',
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
  
  // Use a ref to store audio elements for better performance
  const audioRefs = useRef<Record<SoundType, HTMLAudioElement | null>>({
    tick: null,
    task: null,
    break: null
  });

  // Initialize audio elements
  useEffect(() => {
    // Create audio elements for each sound type
    Object.keys(soundSettings).forEach((type) => {
      const soundType = type as SoundType;
      if (!audioRefs.current[soundType]) {
        const audio = new Audio(soundSettings[soundType]);
        audio.preload = 'auto';
        audioRefs.current[soundType] = audio;
      }
    });

    // Cleanup function
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
      audioRefs.current = {
        tick: null,
        task: null,
        break: null
      };
    };
  }, []);

  // Update audio sources when sound settings change
  useEffect(() => {
    Object.keys(soundSettings).forEach((type) => {
      const soundType = type as SoundType;
      const soundPath = soundSettings[soundType];
      
      if (soundPath !== 'none' && audioRefs.current[soundType]) {
        audioRefs.current[soundType]!.src = soundPath;
      }
    });
  }, [soundSettings]);

  const playSound = useCallback((type: SoundType) => {
    if (isMuted || !isVisible) return;
    
    if (type === 'tick' && soundSettings[type] === 'none') {
      return; // Don't play tick sound if 'none' is selected
    }
    
    const audio = audioRefs.current[type];
    if (!audio) {
      // If audio element doesn't exist yet, create a new one
      console.log(`Creating new audio for ${type}: ${soundSettings[type]}`);
      const newAudio = new Audio(soundSettings[type]);
      newAudio.play().catch(error => console.error(`Error playing ${type} sound:`, error));
    } else {
      // Use the existing audio element
      // For tick sounds, we want to restart them immediately for each tick
      if (type === 'tick') {
        audio.currentTime = 0;
      }
      
      // Play the sound
      console.log(`Playing ${type} sound: ${soundSettings[type]}`);
      audio.play().catch(error => console.error(`Error playing ${type} sound:`, error));
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
