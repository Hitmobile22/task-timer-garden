
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function fetchSubtasksFromAI(taskName: string): Promise<string[]> {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen2.5-coder:3b",
        prompt: `Provide a JSON response with exactly four subtasks to fully accomplish the task in 25 minutes: '${taskName}'. Format it like this: { "subtasks": ["Subtask 1", "Subtask 2", "Subtask 3", "Subtask 4] your response should be practical, knowledgable and demonstrate understanding of the context of the task}`,
        stream: false,
      }),
    });

    const data = await response.json();

    // Extract JSON response correctly even if extra text is included
    const jsonMatch = data.response.match(/\{.*\}/s);
    if (jsonMatch) {
      const parsedData = JSON.parse(jsonMatch[0]);
      return parsedData.subtasks || [];
    }

    return [];
  } catch (error) {
    console.error("Error fetching AI-generated subtasks:", error);
    return [];
  }
}
