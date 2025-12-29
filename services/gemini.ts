import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.REACT_API_KEY;
  console.log("API Key Status:", apiKey ? "LOADED" : "MISSING");
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateVintageCaption = async (
  base64Image: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    // Remove the data URL prefix to get just the base64 string
    const base64Data = base64Image.split(",")[1];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png", // Assuming PNG from canvas
              data: base64Data,
            },
          },
          {
            text: "You are a retro photobooth AI from the 90s. Look at this photo and generate a short, cool, vintage-style caption or 'vibe check' (max 10 words). It can be slightly sassy, poetic, or nostalgic. Format: plain text.",
          },
        ],
      },
    });

    return response.text || "Vibe check passed.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error developing caption...";
  }
};
