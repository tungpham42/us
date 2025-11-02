export interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  type: "text" | "audio";
  isQuestion?: boolean;
  metadata?: {
    correctAnswer?: string;
    category?: string;
  };
}

export interface ExamQuestion {
  id: string;
  question: string;
  category: string;
  correctAnswer: string;
}

export interface VoiceSettings {
  enabled: boolean;
  gender: "male" | "female";
  rate: number;
  pitch: number;
}

export interface LipSyncData {
  mouthOpen: number;
  mouthWidth: number;
}

export interface VoiceSelectorProps {
  selectedVoice: "male" | "female";
  onVoiceChange: (voiceName: "male" | "female") => void;
  onTestVoice: (voiceName: string) => Promise<void>;
}
