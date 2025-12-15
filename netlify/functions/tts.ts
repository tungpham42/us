// netlify/functions/tts.ts
import { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  // Handle CORS for local development and production
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "audio/mpeg",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const { text } = event.queryStringParameters || {};

    if (!text) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Text parameter is required" }),
      };
    }

    // Google Translate TTS Endpoint
    // Note: This is an unofficial endpoint.
    const googleTTSUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(
      text
    )}`;

    const response = await fetch(googleTTSUrl);

    if (!response.ok) {
      throw new Error(`Google TTS API responded with ${response.status}`);
    }

    // Get the audio data as an ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();

    // Convert ArrayBuffer to Buffer for Netlify response
    const buffer = Buffer.from(arrayBuffer);

    return {
      statusCode: 200,
      headers,
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("TTS Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to generate speech" }),
    };
  }
};
