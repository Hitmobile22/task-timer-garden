import { format } from 'date-fns';
import { TASK_LIST_COLORS } from '@/constants/taskColors';

// Generates a vibrant flowing gradient for the lava lamp
export const generateRandomColor = () => {
  // Create a more subtle, lower-saturation gradient
  const hue1 = Math.random() * 360;
  const hue2 = (hue1 + 30 + Math.random() * 60) % 360; // slightly closer hues for harmony
  
  const saturation1 = 40 + Math.random() * 20; // Lower saturation (40-60%)
  const saturation2 = 40 + Math.random() * 20;
  
  const lightness1 = 60 + Math.random() * 15; // Higher lightness for softness (60-75%)
  const lightness2 = 60 + Math.random() * 15;
  
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
  // Use a softer, more readable gradient for subtask text
  return `bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400`;
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
  const baseSaturation = 40 + Math.random() * 15; // 40-55% saturation (much lower)
  const baseLightness = 65 + Math.random() * 15; // 65-80% lightness (much higher)
  
  switch (harmonyType) {
    case 0: // Analogous
      // Colors that are adjacent to each other on the color wheel (with smaller angles)
      for (let i = 0; i < count; i++) {
        const hue = (baseHue + (i - Math.floor(count / 2)) * 10) % 360; // smaller angle (10 degrees)
        const saturation = baseSaturation - (Math.abs(i - Math.floor(count / 2)) * 3);
        const lightness = baseLightness + (Math.abs(i - Math.floor(count / 2)) * 2);
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
      }
      break;
      
    case 1: // Complementary with transition
      // Base color and its complement with softer transitions between
      for (let i = 0; i < count; i++) {
        const hue = (baseHue + (i * 120 / (count - 1))) % 360; // 120 degrees instead of 180
        const saturation = baseSaturation - (Math.abs(i - Math.floor(count / 2)) * 3);
        const lightness = baseLightness + (Math.abs(i - Math.floor(count / 2)) * 2);
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
      }
      break;
      
    case 2: // Monochromatic
      // Different shades and tints of the same color
      for (let i = 0; i < count; i++) {
        const saturation = baseSaturation - (i * 5);
        const lightness = baseLightness + (i * 3);
        colors.push(`hsl(${baseHue}, ${saturation}%, ${lightness}%)`);
      }
      break;
      
    case 3: // Soft triadic
      // Three colors equally spaced around the color wheel, but with softer transitions
      const triadicOffset = 90; // 90 degrees apart (instead of 120)
      for (let i = 0; i < count; i++) {
        const segment = Math.floor(i * 3 / count);
        const hue = (baseHue + segment * triadicOffset) % 360;
        const saturation = baseSaturation - 5;
        const lightness = baseLightness + 3;
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
      }
      break;
  }
  
  return colors;
};

// Predefined tasteful color palettes - using much softer, low-saturation colors
const selectTastefulPalette = (count: number) => {
  const palettes = [
    // Soft pastels with lower saturation
    ['#F2FCE2', '#E6F4D7', '#DAF0CC', '#CFEBC1'],
    // Soft blues
    ['#E1F5FE', '#D0EDF9', '#C3E8F5', '#B3E5FC'],
    // Lavender dream
    ['#F3E5F5', '#E9DCF0', '#E1D2EB', '#D8C9E7'],
    // Soft yellows
    ['#FEF9E6', '#FEF6D9', '#FEF3CC', '#FFF9C4'],
    // Forest greens (softer)
    ['#E8F5E9', '#DDF0DE', '#D3EBD3', '#C8E6C9'],
    // Soft pinks
    ['#FFEBEE', '#FCE4E7', '#F8DDE0', '#F5D6DA'],
    // Mint tones
    ['#E0F7FA', '#D3F2F4', '#C7ECEF', '#BBE7EA'],
    // Peach tones
    ['#FFF3E0', '#FFE9D0', '#FFDFC0', '#FFD5B0']
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
