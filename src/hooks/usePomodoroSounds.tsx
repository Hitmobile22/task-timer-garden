
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
  
  // Flag to track if sounds have been initialized
  const soundsInitializedRef = useRef<boolean>(false);
  
  // Audio pool for handling overlapping sounds
  const audioPoolRefs = useRef<Record<SoundType, HTMLAudioElement[]>>({
    tick: [],
    task: [],
    break: []
  });

  // Initialize audio pools
  useEffect(() => {
    if (soundsInitializedRef.current) {
      return; // Already initialized
    }
    
    console.log("Initializing sound pools");
    
    // Create initial audio elements for the pool
    Object.keys(soundSettings).forEach((type) => {
      const soundType = type as SoundType;
      const pool = audioPoolRefs.current[soundType];
      
      // Check if we already have audio elements in this pool
      if (pool.length === 0) {
        // Initialize with audio elements per sound type
        const poolSize = soundType === 'tick' ? 5 : 3; // More for tick sounds
        
        console.log(`Creating ${poolSize} audio elements for ${soundType} sound`);
        
        for (let i = 0; i < poolSize; i++) {
          const audio = new Audio(soundSettings[soundType]);
          audio.preload = 'auto';
          
          // For tick sounds, make them slightly quieter to avoid overwhelming when overlapping
          if (soundType === 'tick') {
            audio.volume = 0.7;
          }
          
          // Try to trigger audio context initialization
          audio.load();
          
          pool.push(audio);
        }
      }
    });
    
    // Prepare audio context early by playing a silent sound
    const silentInitAudio = () => {
      if (!soundsInitializedRef.current) {
        console.log("Initializing audio context with user interaction");
        
        // Create a silent audio element for initialization
        const silentAudio = new Audio();
        silentAudio.volume = 0;
        
        // Try to play it to initialize audio context
        const playPromise = silentAudio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("Audio context successfully initialized");
            soundsInitializedRef.current = true;
            silentAudio.pause();
            silentAudio.remove();
          }).catch(error => {
            console.error("Error initializing audio context:", error);
          });
        }
        
        // Also try to play one of each type silently to initialize them
        Object.keys(audioPoolRefs.current).forEach(type => {
          const soundType = type as SoundType;
          const pool = audioPoolRefs.current[soundType];
          if (pool.length > 0) {
            const audio = pool[0];
            const originalVolume = audio.volume;
            audio.volume = 0;
            
            const initPlayPromise = audio.play();
            if (initPlayPromise !== undefined) {
              initPlayPromise.then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = originalVolume;
              }).catch(() => {
                audio.volume = originalVolume;
              });
            }
          }
        });
      }
    };
    
    // Initialize sounds with user interaction
    document.addEventListener('click', silentInitAudio, { once: true });
    document.addEventListener('keydown', silentInitAudio, { once: true });
    document.addEventListener('touchstart', silentInitAudio, { once: true });
    
    // Cleanup function
    return () => {
      document.removeEventListener('click', silentInitAudio);
      document.removeEventListener('keydown', silentInitAudio);
      document.removeEventListener('touchstart', silentInitAudio);
      
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
      
      soundsInitializedRef.current = false;
    };
  }, []);

  // Update audio sources when sound settings change
  useEffect(() => {
    console.log("Sound settings changed, updating audio sources");
    
    Object.keys(soundSettings).forEach((type) => {
      const soundType = type as SoundType;
      const soundPath = soundSettings[soundType];
      const pool = audioPoolRefs.current[soundType];
      
      if (soundPath !== 'none') {
        pool.forEach(audio => {
          if (audio.src !== soundPath) {
            console.log(`Updating ${soundType} audio source to ${soundPath}`);
            audio.src = soundPath;
            audio.load(); // Ensure new source is loaded
          }
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
      console.log("All tick sounds are playing, creating a new audio element");
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
      
      // Skip if trying to play ticks too frequently
      if (timeSinceLastTick < 950) {
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
    
    // Make sure volume is set correctly (might have been changed for initialization)
    audio.volume = type === 'tick' ? 0.7 : 1.0;
    
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
    
    // This can also help initialize the audio context
    if (!soundsInitializedRef.current) {
      soundsInitializedRef.current = true;
    }
    
    audio.play().catch(error => {
      console.error(`Error previewing ${type} sound:`, error);
    });
  }, [isMuted]);

  // Special handler for when sound is unmuted
  useEffect(() => {
    if (!isMuted) {
      console.log("Sound unmuted, initializing audio system");
      
      // Play a test sound to initialize audio system
      const testAudio = new Audio(soundSettings.task);
      testAudio.volume = 0.2; // Quieter test sound
      
      testAudio.play().then(() => {
        console.log("Audio system initialized successfully");
        soundsInitializedRef.current = true;
        
        // Immediately play a tick sound if tick is enabled
        if (soundSettings.tick !== 'none') {
          setTimeout(() => {
            playSound('tick');
          }, 100);
        }
      }).catch(error => {
        console.error("Error initializing audio system:", error);
      });
    }
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
