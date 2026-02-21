import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeSymptoms(symptoms: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: symptoms,
    config: {
      systemInstruction: `You are a specialized Medical Machine Learning Engine with expertise in differential diagnosis. 
      Analyze structured patient data (Pain Type, Severity, Location, Duration).
      
      Your analysis MUST follow this rigorous structure:
      1. **Differential Diagnosis**: List top 3 potential conditions with a brief explanation of why they match.
      2. **Risk Stratification**: Categorize as Low, Medium, or High risk with specific clinical reasoning.
      3. **Specialist Recommendation**: Identify the exact type of medical professional needed.
      4. **Clinical Red Flags**: List symptoms that would require immediate ER attention.
      5. **Next Diagnostic Steps**: Suggest tests or questions the doctor might ask.
      
      Tone: Clinical, precise, and objective. 
      DISCLAIMER: You are an AI, not a doctor. This is for informational purposes only.`,
    }
  });
  return response.text;
}

export async function askAIHelp(query: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: query,
    config: {
      systemInstruction: "You are Health Mate AI, a friendly and empathetic medical companion. Answer health-related questions, explain medical terms, and provide general wellness advice. Be conversational but professional.",
    }
  });
  return response.text;
}

export async function analyzeReport(base64Image: string, mimeType: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image.split(',')[1],
            mimeType: mimeType,
          },
        },
        {
          text: "Analyze this medical report (MRI, X-ray, or prescription). Extract key findings, explain them in simple terms, and suggest next steps.",
        },
      ],
    },
  });
  return response.text;
}
