import { GoogleGenAI } from "@google/genai";

function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

export async function suggestTaskBreakdown(taskTitle: string, taskDescription: string) {
  const ai = getAI();
  if (!ai) return [];
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Break down this task into subtasks: Title: ${taskTitle}, Description: ${taskDescription}. Return a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Error:", error);
    return [];
  }
}

export async function prioritizeTasks(tasks: any[]) {
  const ai = getAI();
  if (!ai) return tasks.map(t => t.id);
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Given these tasks: ${JSON.stringify(tasks)}, suggest an optimal order of completion based on priorities and due dates. Return a JSON array of task IDs in order.`,
      config: {
        responseMimeType: "application/json",
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Error:", error);
    return tasks.map(t => t.id);
  }
}
