
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

// Generate harmonious color palette for the mesh gradient effect
export const generateMeshGradientColors = (baseColor?: string, count = 4) => {
  // If we have a base color, extract its main hue to create a harmonious palette
  if (baseColor) {
    try {
      // Parse the base color if it's a gradient
      let mainColor = baseColor;
      if (baseColor.includes('gradient')) {
        // Extract the first color from gradient
        const colorMatch = baseColor.match(/hsla?\(([^)]+)\)|rgba?\(([^)]+)\)|#[0-9a-f]{3,8}/i);
        if (colorMatch) {
          mainColor = colorMatch[0];
        }
      }
      
      // Extract hue from HSL color
      if (mainColor.startsWith('hsl')) {
        const hslMatch = mainColor.match(/hsla?\(([^,]+),\s*([^,]+)%,\s*([^,)]+)%/i);
        if (hslMatch) {
          const baseHue = parseFloat(hslMatch[1]);
          return generateHarmoniousColors(baseHue, count);
        }
      }
      
      // Extract from hex color
      if (mainColor.startsWith('#')) {
        const rgb = hexToRgb(mainColor);
        if (rgb) {
          const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
          return generateHarmoniousColors(hsv.h * 360, count);
        }
      }
      
      // Extract from RGB color
      if (mainColor.startsWith('rgb')) {
        const rgbMatch = mainColor.match(/rgba?\(([^,]+),\s*([^,]+),\s*([^,)]+)/i);
        if (rgbMatch) {
          const r = parseInt(rgbMatch[1]) / 255;
          const g = parseInt(rgbMatch[2]) / 255;
          const b = parseInt(rgbMatch[3]) / 255;
          const hsv = rgbToHsv(r, g, b);
          return generateHarmoniousColors(hsv.h * 360, count);
        }
      }
    } catch (error) {
      console.error("Error parsing color for gradient:", error);
    }
  }
  
  // Fallback to predefined tasteful palettes
  return selectTastefulPalette(count);
};

// Generate harmonious colors based on a hue
const generateHarmoniousColors = (baseHue: number, count: number) => {
  const colors = [];
  
  // Choose a color harmony scheme (analogous, complementary, triadic, etc.)
  const harmonyType = Math.floor(Math.random() * 4);
  
  // Lower the saturation and increase the lightness for a more soothing palette
  const baseSaturation = 65 + Math.random() * 15; // 65-80%
  const baseLightness = 55 + Math.random() * 15; // 55-70%
  
  switch (harmonyType) {
    case 0: // Analogous
      // Colors that are adjacent to each other on the color wheel
      for (let i = 0; i < count; i++) {
        const hue = (baseHue + (i - Math.floor(count / 2)) * 15) % 360;
        const saturation = baseSaturation - (Math.abs(i - Math.floor(count / 2)) * 5);
        const lightness = baseLightness + (Math.abs(i - Math.floor(count / 2)) * 3);
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
      }
      break;
      
    case 1: // Complementary with transition
      // Base color and its complement with transitions between
      for (let i = 0; i < count; i++) {
        const hue = (baseHue + (i * 180 / (count - 1))) % 360;
        const saturation = baseSaturation - (Math.abs(i - Math.floor(count / 2)) * 5);
        const lightness = baseLightness + (Math.abs(i - Math.floor(count / 2)) * 3);
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
      }
      break;
      
    case 2: // Monochromatic
      // Different shades and tints of the same color
      for (let i = 0; i < count; i++) {
        const saturation = baseSaturation - (i * 10);
        const lightness = baseLightness + (i * 5);
        colors.push(`hsl(${baseHue}, ${saturation}%, ${lightness}%)`);
      }
      break;
      
    case 3: // Soft triadic
      // Three colors equally spaced around the color wheel, but with softer transitions
      const triadicOffset = 120; // 120 degrees apart
      for (let i = 0; i < count; i++) {
        const segment = Math.floor(i * 3 / count);
        const hue = (baseHue + segment * triadicOffset) % 360;
        const saturation = baseSaturation - 10;
        const lightness = baseLightness + 5;
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
      }
      break;
  }
  
  return colors;
};

// Predefined tasteful color palettes
const selectTastefulPalette = (count: number) => {
  const palettes = [
    // Soft pastels
    ['#E0F2F1', '#B2DFDB', '#80CBC4', '#4DB6AC'],
    // Ocean blues
    ['#E1F5FE', '#B3E5FC', '#81D4FA', '#4FC3F7'],
    // Lavender dream
    ['#F3E5F5', '#E1BEE7', '#CE93D8', '#BA68C8'],
    // Sunset warmth
    ['#FFF9C4', '#FFF59D', '#FFF176', '#FFEE58'],
    // Forest greens
    ['#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784'],
    // Soft reds
    ['#FFEBEE', '#FFCDD2', '#EF9A9A', '#E57373'],
    // Mint tones
    ['#E0F7FA', '#B2EBF2', '#80DEEA', '#4DD0E1'],
    // Peach tones
    ['#FFF3E0', '#FFE0B2', '#FFCC80', '#FFB74D']
  ];
  
  // Select a random palette
  const palette = palettes[Math.floor(Math.random() * palettes.length)];
  
  // Ensure we have enough colors
  if (count <= palette.length) {
    return palette.slice(0, count);
  }
  
  // If we need more colors, repeat the palette
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(palette[i % palette.length]);
  }
  return result;
};

// Helper function to convert hex to RGB
const hexToRgb = (hex: string) => {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : null;
};

// Helper function to convert RGB to HSV
const rgbToHsv = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  
  if (d === 0) {
    h = 0;
  } else if (max === r) {
    h = ((g - b) / d) % 6;
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else if (max === b) {
    h = (r - g) / d + 4;
  }
  
  h = h < 0 ? h + 6 : h;
  
  return {
    h: h / 6,
    s: max === 0 ? 0 : d / max,
    v: max
  };
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
