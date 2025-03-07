
import React, { useEffect, useRef } from 'react';

interface Blob {
  x: number;
  y: number;
  xSpeed: number;
  ySpeed: number;
  size: number;
  color: string;
}

const colors = [
  'rgba(243, 139, 243, 0.8)',  // pink
  'rgba(118, 74, 241, 0.8)',   // purple
  'rgba(79, 179, 236, 0.8)',   // blue
  'rgba(252, 107, 107, 0.8)',  // red
  'rgba(255, 159, 67, 0.8)',   // orange
];

export const LavaLampBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let blobs: Blob[] = [];
    const blobCount = 7;
    
    const resizeCanvas = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize blobs
    for (let i = 0; i < blobCount; i++) {
      blobs.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        xSpeed: (Math.random() - 0.5) * 0.7,
        ySpeed: (Math.random() - 0.5) * 0.7,
        size: 100 + Math.random() * 150,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    const drawBlob = (blob: Blob) => {
      ctx.beginPath();
      ctx.fillStyle = blob.color;
      ctx.arc(blob.x, blob.y, blob.size, 0, Math.PI * 2);
      ctx.fill();
    };

    const updateBlob = (blob: Blob) => {
      // Update position
      blob.x += blob.xSpeed;
      blob.y += blob.ySpeed;
      
      // Bounce off edges
      if (blob.x - blob.size < 0 || blob.x + blob.size > canvas.width) {
        blob.xSpeed *= -1;
      }
      if (blob.y - blob.size < 0 || blob.y + blob.size > canvas.height) {
        blob.ySpeed *= -1;
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Apply blur
      ctx.filter = 'blur(40px)';
      
      // Draw and update each blob
      blobs.forEach(blob => {
        drawBlob(blob);
        updateBlob(blob);
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full -z-10 opacity-85"
    />
  );
};
