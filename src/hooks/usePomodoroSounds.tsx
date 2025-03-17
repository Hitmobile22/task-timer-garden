
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
  
  // Use a ref to track the last time a tick sound was played
  const lastTickTimeRef = useRef<number>(0);
  
  // Audio pool for handling overlapping sounds
  const audioPoolRefs = useRef<Record<SoundType, HTMLAudioElement[]>>({
    tick: [],
    task: [],
    break: []
  });

  // Initialize audio pools
  useEffect(() => {
    // Create initial audio elements for the pool (2 per sound type)
    Object.keys(soundSettings).forEach((type) => {
      const soundType = type as SoundType;
      const pool = audioPoolRefs.current[soundType];
      
      // Initialize with 2 audio elements per sound type
      if (pool.length === 0) {
        for (let i = 0; i < 3; i++) {
          const audio = new Audio(soundSettings[soundType]);
          audio.preload = 'auto';
          // For tick sounds, make them slightly quieter to avoid overwhelming when overlapping
          if (soundType === 'tick') {
            audio.volume = 0.7;
          }
          pool.push(audio);
        }
      }
    });

    // Cleanup function
    return () => {
      Object.values(audioPoolRefs.current).forEach(pool => {
        pool.forEach(audio => {
          audio.pause();
          audio.src = '';
        });
      });
      
      audioPoolRefs.current = {
        tick: [],
        task: [],
        break: []
      };
    };
  }, []);

  // Update audio sources when sound settings change
  useEffect(() => {
    Object.keys(soundSettings).forEach((type) => {
      const soundType = type as SoundType;
      const soundPath = soundSettings[soundType];
      const pool = audioPoolRefs.current[soundType];
      
      if (soundPath !== 'none') {
        pool.forEach(audio => {
          audio.src = soundPath;
          audio.load(); // Ensure new source is loaded
        });
      }
    });
  }, [soundSettings]);

  // Function to get the next available audio element from the pool
  const getNextAudio = useCallback((type: SoundType): HTMLAudioElement | null => {
    if (soundSettings[type] === 'none') {
      return null;
    }
    
    const pool = audioPoolRefs.current[type];
    
    // First, try to find an audio element that's not playing
    for (const audio of pool) {
      if (audio.paused || audio.ended) {
        return audio;
      }
    }
    
    // If all are playing, create a new one and add it to the pool
    if (type === 'tick') {
      // For tick sounds, we want to allow overlapping, so create a new one if needed
      const newAudio = new Audio(soundSettings[type]);
      newAudio.preload = 'auto';
      newAudio.volume = 0.7; // Slightly quieter
      pool.push(newAudio);
      return newAudio;
    }
    
    // For non-tick sounds, just return the first one (will stop it and replay)
    return pool[0];
  }, [soundSettings]);

  const playSound = useCallback((type: SoundType) => {
    if (isMuted || !isVisible) return;
    
    if (type === 'tick' && soundSettings[type] === 'none') {
      return; // Don't play tick sound if 'none' is selected
    }
    
    // For tick sounds, ensure we're not playing too many too quickly
    if (type === 'tick') {
      const now = Date.now();
      const timeSinceLastTick = now - lastTickTimeRef.current;
      
      // Skip if trying to play ticks too frequently (but leave room for longer tick sounds)
      if (timeSinceLastTick < 950) {
        console.log(`Skipping tick sound, too soon (${timeSinceLastTick}ms since last tick)`);
        return;
      }
      
      lastTickTimeRef.current = now;
    }
    
    const audio = getNextAudio(type);
    if (!audio) return;
    
    // Reset audio position and play
    audio.currentTime = 0;
    
    // Play the sound with error handling
    console.log(`Playing ${type} sound: ${soundSettings[type]}`);
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.error(`Error playing ${type} sound:`, error);
        // If playback failed, try to recover by recreating the audio element
        if (type === 'tick') {
          const index = audioPoolRefs.current[type].indexOf(audio);
          if (index !== -1) {
            const newAudio = new Audio(soundSettings[type]);
            newAudio.preload = 'auto';
            newAudio.volume = 0.7;
            audioPoolRefs.current[type][index] = newAudio;
          }
        }
      });
    }
  }, [isMuted, isVisible, soundSettings, getNextAudio]);

  const previewSound = useCallback((type: SoundType, soundPath: string) => {
    if (isMuted || soundPath === 'none') return;
    
    // Create a temporary audio element for preview
    const audio = new Audio(soundPath);
    audio.volume = type === 'tick' ? 0.7 : 1.0;
    
    console.log(`Previewing ${type} sound: ${soundPath}`);
    audio.play().catch(error => {
      console.error(`Error previewing ${type} sound:`, error);
    });
  }, [isMuted]);

  return {
    isMuted,
    setIsMuted,
    soundSettings,
    setSoundSettings,
    availableSounds,
    playSound,
    previewSound
  };
};
