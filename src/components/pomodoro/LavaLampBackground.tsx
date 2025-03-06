
import React, { useEffect, useRef } from 'react';
import { TASK_LIST_COLORS } from '@/constants/taskColors';
import { generateRandomColor, generateMeshGradientColors, normalizeColor } from '@/utils/taskUtils';

interface LavaLampBackgroundProps {
  taskListColor?: string;
}

export const LavaLampBackground: React.FC<LavaLampBackgroundProps> = ({ taskListColor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<WebGLRenderingContext | null>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const colorRef = useRef<string[]>([]);
  
  // Initialize the mesh gradient
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set canvas to full screen
    const resizeCanvas = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (contextRef.current) {
          contextRef.current.viewport(0, 0, canvas.width, canvas.height);
        }
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Generate harmonious colors based on task list color or select a tasteful palette
    colorRef.current = generateMeshGradientColors(taskListColor);
    
    // Initialize WebGL context
    try {
      const gl = canvas.getContext('webgl', { 
        alpha: true,
        antialias: true,
        premultipliedAlpha: true
      });
      
      if (!gl) {
        throw new Error('WebGL not supported');
      }
      
      contextRef.current = gl;
      
      // Create shader program
      const vertexShader = createShader(gl, gl.VERTEX_SHADER, `
        precision highp float;
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        
        void main() {
          gl_Position = vec4(a_position, 0, 1);
          v_texCoord = a_texCoord;
        }
      `);
      
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, `
        precision highp float;
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec3 u_color1;
        uniform vec3 u_color2;
        uniform vec3 u_color3;
        uniform vec3 u_color4;
        varying vec2 v_texCoord;
        
        // Simplex noise function
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
          m = m*m;
          m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
          vec3 g;
          g.x = a0.x * x0.x + h.x * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }
        
        // Soft blending between colors
        vec3 blend(vec3 a, vec3 b, float t) {
          return mix(a, b, smoothstep(0.0, 1.0, t));
        }
        
        void main() {
          vec2 uv = v_texCoord;
          vec2 pos = gl_FragCoord.xy / u_resolution.xy;
          float ratio = u_resolution.x / u_resolution.y;
          uv.x *= ratio;
          
          // Use slower time variables for gentler animation
          float t = u_time * 0.15;
          
          // Create smoother flowing noise
          float noise1 = snoise(vec2(uv.x * 1.2 + t * 0.1, uv.y * 1.2 - t * 0.07)) * 0.5 + 0.5;
          float noise2 = snoise(vec2(uv.x * 1.8 - t * 0.05, uv.y * 1.9 + t * 0.09)) * 0.5 + 0.5;
          float noise3 = snoise(vec2(uv.x * 2.5 + t * 0.11, uv.y * 2.0 - t * 0.13)) * 0.5 + 0.5;
          float noise4 = snoise(vec2(uv.x * 0.7 - t * 0.15, uv.y * 0.9 + t * 0.17)) * 0.5 + 0.5;
          
          // Create smoother transitions between shapes
          float shape1 = smoothstep(0.35, 0.65, noise1);
          float shape2 = smoothstep(0.35, 0.65, noise2);
          float shape3 = smoothstep(0.35, 0.65, noise3);
          float shape4 = smoothstep(0.35, 0.65, noise4);
          
          // Use gentler blending between shapes
          float mask1 = shape1 * (1.0 - shape2 * 0.5);
          float mask2 = shape2 * (1.0 - shape3 * 0.5);
          float mask3 = shape3 * (1.0 - shape4 * 0.5);
          float mask4 = shape4 * (1.0 - shape1 * 0.5);
          
          // Normalize masks
          float total = mask1 + mask2 + mask3 + mask4;
          mask1 /= total;
          mask2 /= total;
          mask3 /= total;
          mask4 /= total;
          
          // Mix colors with smoother transitions
          vec3 color = 
            u_color1 * mask1 + 
            u_color2 * mask2 + 
            u_color3 * mask3 + 
            u_color4 * mask4;
            
          // Add subtle vignette for depth
          float vignette = smoothstep(0.0, 0.7, 1.0 - length((pos - 0.5) * 1.3));
          color = mix(color, color * 0.8, 1.0 - vignette);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `);
      
      if (!vertexShader || !fragmentShader) {
        throw new Error('Could not compile shaders');
      }
      
      // Create program and link shaders
      const program = gl.createProgram();
      if (!program) {
        throw new Error('Could not create program');
      }
      
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error('Could not link program: ' + gl.getProgramInfoLog(program));
      }
      
      gl.useProgram(program);
      
      // Define geometry (a simple quad covering the entire canvas)
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  // bottom left
         1, -1,  // bottom right
        -1,  1,  // top left
         1,  1,  // top right
      ]), gl.STATIC_DRAW);
      
      const texCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 0,  // bottom left
        1, 0,  // bottom right
        0, 1,  // top left
        1, 1,  // top right
      ]), gl.STATIC_DRAW);
      
      // Get attribute locations
      const positionLocation = gl.getAttribLocation(program, 'a_position');
      const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
      
      // Get uniform locations
      const timeLocation = gl.getUniformLocation(program, 'u_time');
      const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
      const color1Location = gl.getUniformLocation(program, 'u_color1');
      const color2Location = gl.getUniformLocation(program, 'u_color2');
      const color3Location = gl.getUniformLocation(program, 'u_color3');
      const color4Location = gl.getUniformLocation(program, 'u_color4');
      
      // Parse colors from CSS colors to RGB values
      const parseColor = (color: string): number[] => {
        // Handle hex colors
        if (color.startsWith('#')) {
          return normalizeColor(color);
        }
        
        // Handle rgb(a) colors
        if (color.startsWith('rgb')) {
          const match = color.match(/\d+/g);
          if (match && match.length >= 3) {
            return [
              parseInt(match[0]) / 255,
              parseInt(match[1]) / 255,
              parseInt(match[2]) / 255
            ];
          }
        }
        
        // Handle hsl(a) colors
        if (color.startsWith('hsl')) {
          const match = color.match(/\d+/g);
          if (match && match.length >= 3) {
            const h = parseInt(match[0]) / 360;
            const s = parseInt(match[1]) / 100;
            const l = parseInt(match[2]) / 100;
            return hslToRgb(h, s, l);
          }
        }
        
        // Default fallback
        return [0.5, 0.5, 0.8];
      };
      
      // Animation function
      const render = (timestamp: number) => {
        if (!contextRef.current) return;
        const gl = contextRef.current;
        
        timeRef.current += 0.01;
        
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        gl.useProgram(program);
        
        // Set uniforms
        gl.uniform1f(timeLocation, timeRef.current);
        gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
        
        // Set colors from our array
        const colors = colorRef.current;
        if (colors.length >= 4) {
          gl.uniform3fv(color1Location, parseColor(colors[0]));
          gl.uniform3fv(color2Location, parseColor(colors[1]));
          gl.uniform3fv(color3Location, parseColor(colors[2]));
          gl.uniform3fv(color4Location, parseColor(colors[3]));
        } else {
          // Default colors if we don't have enough
          gl.uniform3fv(color1Location, [0.9, 0.9, 0.95]);
          gl.uniform3fv(color2Location, [0.8, 0.85, 0.9]);
          gl.uniform3fv(color3Location, [0.7, 0.8, 0.9]);
          gl.uniform3fv(color4Location, [0.6, 0.7, 0.85]);
        }
        
        // Set position attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        
        // Set texCoord attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
        
        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        animationRef.current = requestAnimationFrame(render);
      };
      
      // Start animation
      animationRef.current = requestAnimationFrame(render);
      
    } catch (error) {
      console.error('WebGL initialization error:', error);
      // Fallback to regular background if WebGL fails
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = taskListColor || 'linear-gradient(135deg, #E0F7FA 0%, #B2EBF2 100%)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, [taskListColor]);

  // Helper function to create and compile a shader
  const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  };
  
  // HSL to RGB conversion
  const hslToRgb = (h: number, s: number, l: number): number[] => {
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return [r, g, b];
  };

  // Create a background gradient based on the task list color
  const getBackgroundStyle = () => {
    if (!taskListColor) {
      // Use a nice default gradient
      return {
        background: 'linear-gradient(135deg, #E0F7FA 0%, #B2EBF2 100%)'
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
