import { GoogleGenerativeAI } from "@google/generative-ai";
import { ExamQuestion } from "../types";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

export class GeminiService {
  private model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  async generateExamQuestion(category?: string): Promise<ExamQuestion> {
    const categories = [
      "Principles of American Democracy",
      "System of Government",
      "Rights and Responsibilities",
      "American History: Colonial Period and Independence",
      "American History: 1800s",
      "Recent American History and Other Important Historical Information",
      "Integrated Civics: Geography",
      "Integrated Civics: Symbols",
      "Integrated Civics: Holidays",
    ];
    const selectedCategory =
      category || categories[Math.floor(Math.random() * categories.length)];

    const prompt = `Generate a realistic US citizenship exam question about ${selectedCategory}. 
    IMPORTANT: Do NOT include the correct answer in the question text. Only provide the question.
    Format your response exactly like this:
    Question: [question text only]
    Correct Answer: [answer]
    Category: ${selectedCategory}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseQuestionResponse(text, selectedCategory);
    } catch (error) {
      console.error("Error generating question:", error);
      return this.getFallbackQuestion(selectedCategory);
    }
  }

  private parseQuestionResponse(
    response: string,
    category: string
  ): ExamQuestion {
    const lines = response.split("\n");
    let question = "";
    let correctAnswer = "";

    for (const line of lines) {
      if (line.startsWith("Question:")) {
        question = line.replace("Question:", "").trim();
      } else if (line.startsWith("Correct Answer:")) {
        correctAnswer = line.replace("Correct Answer:", "").trim();
      }
    }

    // If parsing failed, use fallback
    if (!question || !correctAnswer) {
      return this.getFallbackQuestion(category);
    }

    return {
      id: Date.now().toString(),
      question,
      correctAnswer,
      category,
    };
  }

  async evaluateAnswer(
    question: string,
    userAnswer: string,
    correctAnswer?: string
  ): Promise<string> {
    const prompt = `Evaluate this citizenship exam answer. 
    Question: ${question}
    User's Answer: ${userAnswer}
    ${correctAnswer ? `Correct Answer: ${correctAnswer}` : ""}
    
    Provide a brief evaluation and explanation. Do NOT reveal the correct answer if the user was wrong.
    Format your response exactly like this:
    Evaluation: [Correct/Incorrect]. Explanation: [brief explanation without giving away the answer]`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Error evaluating answer:", error);
      return "Evaluation: Unable to evaluate at this time. Please try again.";
    }
  }

  // New method for TTS using Gemini
  async generateSpeech(
    text: string,
    settings: { gender: "male" | "female"; rate: number; pitch: number }
  ): Promise<ArrayBuffer> {
    try {
      // Convert gender to voice configuration for Gemini TTS
      const voiceGender =
        settings.gender === "male" ? "en-US-Standard-A" : "	en-US-Standard-E";

      // For TTS, we need to use the appropriate API endpoint
      // Note: Gemini TTS API might be different - check the actual API documentation
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: text,
                  },
                ],
              },
            ],
            voiceConfig: {
              voiceName: voiceGender, // or any supported voice
              rate: settings.rate,
              pitch: settings.pitch,
            },
            audioConfig: {
              audioEncoding: "MP3", // or "MP3", "OGG_OPUS"
            },
            generationConfig: {
              temperature: 0.7,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      const data = await response.json();

      // The actual structure will depend on Gemini TTS API response
      // This is a placeholder - adjust based on actual API response
      if (data.audioContent) {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(data.audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      } else {
        throw new Error("No audio content in response");
      }
    } catch (error) {
      console.error("Error generating speech with Gemini TTS:", error);
      throw new Error("Failed to generate speech");
    }
  }

  private getFallbackQuestion(category: string): ExamQuestion {
    const fallbackQuestions = {
      "American Government": {
        question: "What is the supreme law of the land?",
        correctAnswer: "The Constitution",
        category: "American Government",
      },
      "American History": {
        question: "What is one reason colonists came to America?",
        correctAnswer: "Freedom",
        category: "American History",
      },
      "Integrated Civics": {
        question: "What is the capital of the United States?",
        correctAnswer: "Washington D.C.",
        category: "Integrated Civics",
      },
    };

    const question =
      fallbackQuestions[category as keyof typeof fallbackQuestions] ||
      fallbackQuestions["American Government"];

    return {
      id: Date.now().toString(),
      ...question,
    };
  }
}
