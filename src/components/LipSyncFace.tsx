import React, { useRef, useEffect, useState } from "react";
import { LipSyncData } from "../types";

interface LipSyncFaceProps {
  isSpeaking: boolean;
  text?: string;
}

export const LipSyncFace: React.FC<LipSyncFaceProps> = ({
  isSpeaking,
  text,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lipSyncData, setLipSyncData] = useState<LipSyncData>({
    mouthOpen: 0,
    mouthWidth: 0.3,
  });
  const [expression, setExpression] = useState<
    "neutral" | "speaking" | "thinking"
  >("neutral");

  useEffect(() => {
    if (!isSpeaking) {
      setLipSyncData({ mouthOpen: 0, mouthWidth: 0.3 });
      setExpression("neutral");
      return;
    }

    setExpression("speaking");
    const interval = setInterval(() => {
      // More natural lip movement simulation
      const mouthOpen = Math.random() * 0.6 + 0.1;
      const mouthWidth = Math.random() * 0.3 + 0.4;
      setLipSyncData({ mouthOpen, mouthWidth });
    }, 120);

    return () => clearInterval(interval);
  }, [isSpeaking]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(
      0,
      0,
      canvas.width,
      canvas.height
    );
    gradient.addColorStop(0, "#667eea");
    gradient.addColorStop(1, "#764ba2");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw face with gradient
    const faceGradient = ctx.createRadialGradient(150, 150, 50, 150, 150, 100);
    faceGradient.addColorStop(0, "#FFE0B2");
    faceGradient.addColorStop(1, "#F8C471");

    ctx.fillStyle = faceGradient;
    ctx.beginPath();
    ctx.arc(150, 150, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#E67E22";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw expressive eyes based on state
    ctx.fillStyle = expression === "thinking" ? "#8E44AD" : "#2C3E50";

    // Left eye with blink effect
    ctx.beginPath();
    const leftEyeOpen = expression === "thinking" ? 0.7 : 1;
    ctx.ellipse(120, 120, 15, 15 * leftEyeOpen, 0, 0, Math.PI * 2);
    ctx.fill();

    // Right eye with blink effect
    ctx.beginPath();
    const rightEyeOpen = expression === "thinking" ? 0.7 : 1;
    ctx.ellipse(180, 120, 15, 15 * rightEyeOpen, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw mouth with lip sync and expression
    const mouthGradient = ctx.createLinearGradient(
      150 - 40 * lipSyncData.mouthWidth,
      180 - 20 * lipSyncData.mouthOpen,
      150 + 40 * lipSyncData.mouthWidth,
      180 + 20 * lipSyncData.mouthOpen
    );
    mouthGradient.addColorStop(0, "#D81B60");
    mouthGradient.addColorStop(1, "#AD1457");

    ctx.fillStyle = mouthGradient;
    ctx.beginPath();

    if (expression === "speaking") {
      // Animated speaking mouth
      ctx.ellipse(
        150,
        180,
        40 * lipSyncData.mouthWidth,
        20 * lipSyncData.mouthOpen,
        0,
        0,
        Math.PI * 2
      );
    } else {
      // Neutral mouth
      ctx.ellipse(150, 180, 30, 8, 0, 0, Math.PI * 2);
    }

    ctx.fill();

    // Add some facial features
    ctx.fillStyle = "#E67E22";
    ctx.beginPath();
    ctx.arc(150, 100, 8, 0, Math.PI * 2);
    ctx.fill();
  }, [lipSyncData, expression]);

  return (
    <div style={{ textAlign: "center", margin: "20px 0" }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          style={{
            border: "3px solid #fff",
            borderRadius: "50%",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            backgroundImage:
              "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          }}
          className={isSpeaking ? "pulse-animation" : ""}
        />
        {isSpeaking && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              background: "#ff4757",
              color: "white",
              borderRadius: "12px",
              padding: "4px 8px",
              fontSize: "12px",
              fontWeight: "bold",
              animation: "pulse 1.5s infinite",
            }}
          >
            🔊 Speaking
          </div>
        )}
      </div>
      {text && (
        <div
          style={{
            marginTop: "20px",
            padding: "16px",
            backgroundImage:
              "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "20px",
            color: "white",
            fontWeight: "500",
            boxShadow: "0 6px 20px rgba(102, 126, 234, 0.3)",
            border: "2px solid rgba(255,255,255,0.2)",
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};
