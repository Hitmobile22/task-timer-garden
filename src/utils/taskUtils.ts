
import { format } from 'date-fns';
import { TASK_LIST_COLORS } from '@/constants/taskColors';

// Generates a vibrant flowing gradient for the lava lamp
export const generateRandomColor = () => {
  // Create a more vibrant and varied random gradient
  const hue1 = Math.random() * 360;
  const hue2 = (hue1 + 40 + Math.random() * 80) % 360; // offset by 40-120 degrees
  
  const saturation1 = 70 + Math.random() * 20;
  const saturation2 = 70 + Math.random() * 20;
  
  const lightness1 = 45 + Math.random() * 15;
  const lightness2 = 45 + Math.random() * 15;
  
  return `linear-gradient(135deg, hsla(${hue1}, ${saturation1}%, ${lightness1}%, 1) 0%, hsla(${hue2}, ${saturation2}%, ${lightness2}%, 1) 100%)`;
};

export const getTaskListColor = (listId: number, taskLists: any[]) => {
  const list = taskLists?.find(l => l.id === listId);
  return list?.color || TASK_LIST_COLORS['Default'] || generateRandomColor();
};

export const formatDate = (date: string) => {
  return format(new Date(date), 'MMM d, h:mm a');
};

// Get a vibrant color for subtask text
export const getSubtaskColor = () => {
  // Use a bright, readable gradient for subtask text
  const hue = Math.random() * 360;
  return `bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500`;
};

// Generate colors for mesh gradient effect
export const generateMeshGradientColors = (count = 4) => {
  const colors = [];
  
  // Define color palettes for more harmonious combinations
  const palettes = [
    // Purples and pinks
    ['#8B5CF6', '#D946EF', '#EC4899', '#F472B6'],
    // Blues and teals
    ['#0EA5E9', '#06B6D4', '#14B8A6', '#10B981'],
    // Oranges and reds
    ['#F97316', '#F59E0B', '#EF4444', '#F43F5E'],
    // Cool blues
    ['#1E40AF', '#3B82F6', '#60A5FA', '#93C5FD'],
    // Green and blues
    ['#059669', '#10B981', '#0EA5E9', '#3B82F6']
  ];
  
  // Select a random palette or generate fully random colors
  if (Math.random() > 0.3) {
    const palette = palettes[Math.floor(Math.random() * palettes.length)];
    for (let i = 0; i < count; i++) {
      colors.push(palette[i % palette.length]);
    }
  } else {
    for (let i = 0; i < count; i++) {
      const hue = Math.random() * 360;
      const saturation = 70 + Math.random() * 20;
      const lightness = 50 + Math.random() * 20;
      colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
  }
  
  return colors;
};

// Convert hex to RGB for WebGL
export const normalizeColor = (hexCode: string) => {
  if (hexCode.startsWith('#')) {
    hexCode = hexCode.substring(1);
  }
  
  // Handle shorthand hex (#RGB)
  if (hexCode.length === 3) {
    hexCode = hexCode.split('').map(c => c + c).join('');
  }
  
  const r = parseInt(hexCode.substring(0, 2), 16) / 255;
  const g = parseInt(hexCode.substring(2, 4), 16) / 255;
  const b = parseInt(hexCode.substring(4, 6), 16) / 255;
  
  return [r, g, b];
};
