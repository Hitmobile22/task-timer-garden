
import React, { useEffect, useRef } from 'react';
import { TASK_LIST_COLORS } from '@/constants/taskColors';
import { generateRandomColor } from '@/utils/taskUtils';

interface Blob {
  x: number;
  y: number;
  z: number;
  xSpeed: number;
  ySpeed: number;
  zSpeed: number;
  size: number;
  color: string;
}

interface LavaLampBackgroundProps {
  taskListColor?: string;
}

export const LavaLampBackground: React.FC<LavaLampBackgroundProps> = ({ taskListColor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create colors from the TASK_LIST_COLORS or generate random ones
    const getColorsFromGradient = (gradient: string) => {
      // Extract colors from linear-gradient
      const colorMatches = gradient.match(/hsla?\([^)]+\)|rgba?\([^)]+\)|#[0-9a-f]+/gi);
      if (colorMatches && colorMatches.length >= 1) {
        return colorMatches;
      }
      
      // Default colors if no matches
      return [
        'rgba(147, 39, 143, 0.8)',
        'rgba(234, 172, 232, 0.8)',
      ];
    };

    // Get colors based on taskListColor or use random colors
    const baseColors = taskListColor 
      ? getColorsFromGradient(taskListColor)
      : Object.values(TASK_LIST_COLORS).slice(0, 5);
      
    // Color palette with opacity for the blobs
    const colors = baseColors.map(color => {
      // If it's already rgba, modify the opacity
      if (color.startsWith('rgba')) {
        return color.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgba($1,$2,$3,0.7)');
      }
      // If it's hsla, modify the opacity
      else if (color.startsWith('hsla')) {
        return color.replace(/hsla\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'hsla($1,$2,$3,0.7)');
      }
      // If it's rgb, convert to rgba
      else if (color.startsWith('rgb')) {
        return color.replace(/rgb\(([^)]+)\)/, 'rgba($1,0.7)');
      }
      // If it's hsl, convert to hsla
      else if (color.startsWith('hsl')) {
        return color.replace(/hsl\(([^)]+)\)/, 'hsla($1,0.7)');
      }
      // If it's hex, convert to rgba (simple conversion)
      else {
        return 'rgba(147, 39, 143, 0.7)'; // fallback color
      }
    });

    // Add some vibrant colors if we have few colors
    if (colors.length < 4) {
      colors.push(
        'rgba(118, 74, 241, 0.7)',
        'rgba(79, 179, 236, 0.7)',
        'rgba(252, 107, 107, 0.7)'
      );
    }

    let blobs: Blob[] = [];
    const blobCount = 12; // More blobs for a denser effect
    
    const resizeCanvas = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize blobs with 3D positions
    for (let i = 0; i < blobCount; i++) {
      blobs.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 200 - 100, // z position for 3D effect
        xSpeed: (Math.random() - 0.5) * 1.2, // Faster movement
        ySpeed: (Math.random() - 0.5) * 1.2,
        zSpeed: (Math.random() - 0.5) * 0.8,
        size: 80 + Math.random() * 120,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    const drawBlob = (blob: Blob) => {
      // Scale based on z-position to create depth
      const scale = (blob.z + 100) / 200; // normalize to 0-1 range
      const scaledSize = blob.size * (0.5 + scale * 0.7);
      
      // Adjust opacity based on z-position
      const opacity = 0.5 + scale * 0.5;
      
      ctx.beginPath();
      
      // Use blob's color but adjust opacity
      const colorBase = blob.color.startsWith('rgba') 
        ? blob.color.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `rgba($1,$2,$3,${opacity})`)
        : blob.color;
      
      ctx.fillStyle = colorBase;
      
      // Draw an oval to create more organic shapes
      ctx.ellipse(
        blob.x, 
        blob.y, 
        scaledSize * (0.8 + Math.random() * 0.4), 
        scaledSize * (0.8 + Math.random() * 0.4), 
        Math.random() * Math.PI, 
        0, 
        Math.PI * 2
      );
      
      ctx.fill();
    };

    const updateBlob = (blob: Blob) => {
      // Update position
      blob.x += blob.xSpeed;
      blob.y += blob.ySpeed;
      blob.z += blob.zSpeed;
      
      // Bounce off edges
      if (blob.x - blob.size < 0 || blob.x + blob.size > canvas.width) {
        blob.xSpeed *= -1;
      }
      if (blob.y - blob.size < 0 || blob.y + blob.size > canvas.height) {
        blob.ySpeed *= -1;
      }
      
      // Bounce in z-direction too
      if (blob.z < -100 || blob.z > 100) {
        blob.zSpeed *= -1;
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Apply blur for a softer effect
      ctx.filter = 'blur(30px)';
      
      // Sort blobs by z-index for proper rendering
      blobs.sort((a, b) => a.z - b.z);
      
      // Draw and update each blob
      blobs.forEach(blob => {
        drawBlob(blob);
        updateBlob(blob);
      });
      
      // Add subtle glow/bloom effect
      ctx.filter = 'blur(5px)';
      ctx.globalCompositeOperation = 'lighter';
      blobs.forEach(blob => {
        drawBlob(blob);
      });
      
      // Reset composite operation
      ctx.globalCompositeOperation = 'source-over';
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [taskListColor]);

  // Create a background gradient based on the task list color
  const getBackgroundStyle = () => {
    if (!taskListColor) {
      // Use a nice default gradient
      return {
        background: 'linear-gradient(135deg, #001f3f 0%, #004080 100%)'
      };
    }
    
    // Use task list color as background
    return {
      background: taskListColor
    };
  };

  return (
    <>
      <div 
        className="fixed top-0 left-0 w-full h-full -z-20"
        style={getBackgroundStyle()}
      />
      <canvas 
        ref={canvasRef} 
        className="fixed top-0 left-0 w-full h-full -z-10"
      />
    </>
  );
};
