import React, { useEffect, useRef } from 'react';

interface GradientBackgroundProps {
  taskListColor?: string;
}

export const GradientBackground: React.FC<GradientBackgroundProps> = ({ taskListColor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create a gradient from taskListColor or use default
    const getGradientColors = () => {
      if (taskListColor) {
        // Extract colors from linear-gradient
        const matches = taskListColor.match(/rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-f]+/gi);
        if (matches && matches.length >= 1) {
          return matches;
        }
      }
      
      // Default gradient if no task list color or unable to parse
      return [
        'rgba(41, 41, 97, 0.8)',
        'rgba(107, 107, 178, 0.6)'
      ];
    };

    const colors = getGradientColors();
    
    // Animated dots configuration
    const dots = [];
    const dotCount = 30;
    
    for (let i = 0; i < dotCount; i++) {
      dots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 3 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 0.1 + Math.random() * 0.4,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        speedRadius: (Math.random() - 0.5) * 0.02
      });
    }

    const drawBackground = () => {
      // Create background gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(1, colors[colors.length - 1]);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const drawDots = () => {
      // Move and draw dots
      ctx.globalCompositeOperation = 'lighter';
      
      dots.forEach(dot => {
        // Update position
        dot.x += dot.speedX;
        dot.y += dot.speedY;
        dot.radius += dot.speedRadius;
        
        // Bounce off edges
        if (dot.x < 0 || dot.x > canvas.width) dot.speedX *= -1;
        if (dot.y < 0 || dot.y > canvas.height) dot.speedY *= -1;
        
        // Keep radius in range
        if (dot.radius < 4 || dot.radius > 15) dot.speedRadius *= -1;
        
        // Draw dot
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = dot.color.replace(/[^,]+(?=\))/, dot.opacity);
        ctx.fill();
      });
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground();
      drawDots();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [taskListColor]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full -z-10"
    />
  );
};
