
import React, { useEffect, useRef } from 'react';
import { getTaskListColor } from '@/utils/taskUtils';
import { DEFAULT_LIST_COLOR } from '@/constants/taskColors';

interface Blob {
  x: number;
  y: number;
  speedX: number;
  speedY: number;
  size: number;
  opacity: number;
  color: string;
}

interface LavaLampBackgroundProps {
  activeTaskId: number | undefined;
  taskLists: any[] | undefined;
  activeTasks: any[] | undefined;
}

const lightenColor = (hex: string, percent: number) => {
  // If it's a gradient string, extract the first color
  if (hex.includes('linear-gradient')) {
    const colorMatch = hex.match(/#[a-fA-F0-9]{6}/g);
    if (colorMatch && colorMatch.length > 0) {
      hex = colorMatch[0];
    } else {
      return `rgba(255, 255, 255, ${percent / 255})`;
    }
  }

  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, r + percent);
  g = Math.min(255, g + percent);
  b = Math.min(255, b + percent);
  return `rgba(${r}, ${g}, ${b}, 0.4)`; // Lightened and slightly transparent
};

const extractGradientColors = (gradient: string): string[] => {
  const colors = gradient.match(/#[a-fA-F0-9]{6}/g);
  if (colors && colors.length >= 2) {
    return colors;
  }
  
  // If gradient doesn't have hex colors, try extracting rgba format
  const rgbaColors = gradient.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,?\s*\d*\.?\d*\s*\)/g);
  if (rgbaColors && rgbaColors.length >= 2) {
    return rgbaColors;
  }
  
  // If no colors found, return default colors
  return ['#007F5F', '#2B9348'];
};

export const LavaLampBackground: React.FC<LavaLampBackgroundProps> = ({ 
  activeTaskId, 
  taskLists, 
  activeTasks 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blobs = useRef<Blob[]>([]);
  const animationRef = useRef<number>();
  
  // Get the gradient colors for the active task's list
  const gradientColors = React.useMemo(() => {
    if (!activeTaskId || !taskLists || !activeTasks) {
      console.log("Missing data for background", { activeTaskId, taskLists: !!taskLists, activeTasks: !!activeTasks });
      return ['#acfffc', '#fbf0c1']; // Default fallback
    }
    
    const activeTask = activeTasks.find(t => t.id === activeTaskId);
    if (!activeTask) {
      console.log("No active task found with id:", activeTaskId);
      return ['#acfffc', '#fbf0c1']; // Default fallback
    }
    
    // Get the color from the task list
    const taskListColor = getTaskListColor(activeTask.task_list_id, taskLists);
    console.log("Task list color:", taskListColor, "for list ID:", activeTask.task_list_id);
    
    // Extract colors from the gradient
    const colors = extractGradientColors(taskListColor || DEFAULT_LIST_COLOR);
    console.log("Extracted colors:", colors);
    return colors;
  }, [activeTaskId, taskLists, activeTasks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      blobs.current = generateBlobs();
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground(ctx);
      drawBlobs(ctx);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationRef.current as number);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [gradientColors]);

  const generateBlobs = () => {
    return Array.from({ length: 8 }).map(() => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      speedX: (Math.random() - 0.5) * 6.0,
      speedY: (Math.random() - 0.5) * 6.0,
      size: 10 + Math.random() * 20,
      opacity: 0.5,
      color: lightenColor(gradientColors[Math.floor(Math.random() * gradientColors.length)], 60),
    }));
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, ctx.canvas.height);
    gradient.addColorStop(0, gradientColors[0]);
    gradient.addColorStop(1, gradientColors[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  };

  const drawBlobs = (ctx: CanvasRenderingContext2D) => {
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = 'blur(20px)';
    blobs.current.forEach(blob => {
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, blob.size, 0, Math.PI * 2);
      ctx.fillStyle = blob.color;
      ctx.globalAlpha = blob.opacity;
      ctx.fill();
      blob.x += blob.speedX;
      blob.y += blob.speedY;
      if (blob.x - blob.size < 0 || blob.x + blob.size > ctx.canvas.width) blob.speedX *= -1;
      if (blob.y - blob.size < 0 || blob.y + blob.size > ctx.canvas.height) blob.speedY *= -1;
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full -z-10 opacity-85" />;
};
