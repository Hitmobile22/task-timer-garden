
import React, { useRef, useEffect } from 'react';
import { Subtask } from '@/types/task.types';

interface SubtaskDisplayProps {
  currentSubtask: Subtask | null;
  onComplete: (subtaskId: number) => void;
}

export const SubtaskDisplay: React.FC<SubtaskDisplayProps> = ({
  currentSubtask,
  onComplete
}) => {
  const subtaskTextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (subtaskTextRef.current) {
      const textElement = subtaskTextRef.current;
      textElement.scrollLeft = 0;

      if (textElement.scrollWidth > textElement.clientWidth) {
        const scrollDuration = 8000;
        const scrollStep = textElement.scrollWidth / (scrollDuration / 20);
        let scrollPosition = 0;

        const scrollAnimation = setInterval(() => {
          scrollPosition += scrollStep;
          if (scrollPosition >= textElement.scrollWidth - textElement.clientWidth) {
            clearInterval(scrollAnimation);
            setTimeout(() => {
              textElement.scrollLeft = 0;
            }, 2000);
          } else {
            textElement.scrollLeft = scrollPosition;
          }
        }, 20);

        return () => clearInterval(scrollAnimation);
      }
    }
  }, [currentSubtask]);

  const getSubtaskColor = () => {
    const colors = [
      "text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500",
      "text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-500",
      "text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-500",
      "text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-500",
      "text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 to-pink-600"
    ];

    const index = currentSubtask ? currentSubtask.id % colors.length : 0;
    return colors[index];
  };

  if (!currentSubtask) return null;

  return (
    <div className="absolute top-4 right-4 animate-fadeIn max-w-[300px] sm:max-w-xs mx-auto">
      <div
        ref={subtaskTextRef}
        className={`font-medium text-right whitespace-nowrap overflow-hidden cursor-pointer ${getSubtaskColor()} hover:opacity-80 transition-opacity`}
        onClick={() => onComplete(Number(currentSubtask.id))}
        title="Click to mark as completed"
      >
        {currentSubtask["Task Name"]}
      </div>
    </div>
  );
};
