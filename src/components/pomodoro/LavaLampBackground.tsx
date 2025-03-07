import React, { useEffect, useRef } from 'react';

interface Blob {
  x: number;
  y: number;
  speedX: number;
  speedY: number;
  size: number;
  opacity: number;
  color: string;
}

const getTaskListGradient = (activeTaskId, taskLists, activeTasks) => {
  if (!taskLists || !activeTasks) return ['#acfffc', '#fbf0c1']; // Default green fallback
  const activeTask = activeTasks.find(t => t.id === activeTaskId);
  if (!activeTask || activeTask.task_list_id === 1) return ['#007F5F', '#2B9348'];
  const taskList = taskLists.find(l => l.id === activeTask.task_list_id);
  if (!taskList || !taskList.color) return ['#007F5F', '#2B9348'];

  if (/^#[a-fA-F0-9]{6}$/.test(taskList.color)) {
    // If it's a single color, create a gradient variation
    return [taskList.color, lightenColor(taskList.color, 50)];
  }

  const colors = taskList.color.match(/#[a-fA-F0-9]{6}/g);
  return colors && colors.length >= 2 ? colors : ['#007F5F', '#2B9348'];
};

const lightenColor = (hex, percent) => {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, r + percent);
  g = Math.min(255, g + percent);
  b = Math.min(255, b + percent);
  return `rgba(${r}, ${g}, ${b}, 0.4)`; // Lightened and slightly transparent
};

export const LavaLampBackground = ({ activeTaskId, taskLists, activeTasks }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blobs = useRef<Blob[]>([]);
  const animationRef = useRef<number>();
  const gradientColors = getTaskListGradient(activeTaskId, taskLists, activeTasks);

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
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [activeTaskId, taskLists, activeTasks]);

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

  const drawBackground = (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, ctx.canvas.height);
    gradient.addColorStop(0, gradientColors[0]);
    gradient.addColorStop(1, gradientColors[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  };

  const drawBlobs = (ctx) => {
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
      if (blob.y - blob.size < 0 || blob.y + ctx.canvas.height) blob.speedY *= -1;
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full -z-10 opacity-85" />;
};