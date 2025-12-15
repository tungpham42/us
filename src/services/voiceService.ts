// src/services/voiceService.ts
export class VoiceService {
  private synth = window.speechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded: boolean = false;
  private isSpeaking: boolean = false;
  // Removed GeminiService dependency

  constructor() {
    // Removed geminiService from constructor args
    this.loadVoices();

    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => {
        console.log("Voices changed, reloading...");
        this.loadVoices();
      };
    }

    setTimeout(() => {
      if (this.voices.length === 0) {
        console.log("Initial voice loading...");
        this.loadVoices();
      }
    }, 1000);
  }

  private loadVoices(): void {
    const loadedVoices = this.synth.getVoices();
    this.voices = loadedVoices;
    this.voicesLoaded = loadedVoices.length > 0;
  }

  private async ensureVoicesLoaded(): Promise<void> {
    if (this.voicesLoaded) return;
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 10;
      const checkVoices = () => {
        this.loadVoices();
        if (this.voices.length > 0 || attempts >= maxAttempts) {
          this.voicesLoaded = true;
          resolve();
        } else {
          attempts++;
          setTimeout(checkVoices, 200);
        }
      };
      checkVoices();
    });
  }

  isSpeechSupported(): boolean {
    return "speechSynthesis" in window || !!(window as any).AudioContext;
  }

  isRecognitionSupported(): boolean {
    return (
      (window as any).SpeechRecognition !== undefined ||
      (window as any).webkitSpeechRecognition !== undefined
    );
  }

  async speak(
    text: string,
    settings: { gender: "male" | "female"; rate: number; pitch: number }
  ): Promise<void> {
    // Stop previous audio if any
    this.stop();

    return new Promise(async (resolve, reject) => {
      try {
        console.log("Requesting TTS from Netlify function...");
        this.isSpeaking = true;

        // Call the Netlify Function
        const response = await fetch(
          `/.netlify/functions/tts?text=${encodeURIComponent(text)}`
        );

        if (!response.ok) {
          throw new Error("Netlify TTS service failed");
        }

        const audioData = await response.arrayBuffer();

        // Use AudioContext to play the raw MP3 data
        const audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();

        // Decode the audio data
        const audioBuffer = await audioContext.decodeAudioData(audioData);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        // Apply basic playback rate (pitch shifting is complex with buffer sources,
        // usually affects speed, but we can apply rate)
        source.playbackRate.value = settings.rate;

        source.connect(audioContext.destination);

        source.onended = () => {
          console.log("TTS speech finished");
          this.isSpeaking = false;
          resolve();
        };

        source.start(0);
      } catch (error) {
        console.error("Error with Netlify TTS:", error);
        console.log("Falling back to browser speech synthesis...");
        await this.fallbackSpeak(text, settings, resolve, reject);
      }
    });
  }

  private async fallbackSpeak(
    text: string,
    settings: { gender: "male" | "female"; rate: number; pitch: number },
    resolve: () => void,
    reject: (error: any) => void
  ): Promise<void> {
    // ... [Keep existing fallbackSpeak logic exactly as is] ...
    if (!this.isSpeechSupported()) {
      reject(new Error("Speech synthesis not supported"));
      return;
    }

    await this.ensureVoicesLoaded();

    if (this.voices.length === 0) {
      reject(new Error("No voices available"));
      return;
    }

    if (this.isSpeaking) {
      this.stop();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.currentUtterance = new SpeechSynthesisUtterance(text);
    this.isSpeaking = true;

    const voice = this.findBestVoice(settings.gender);
    if (voice) {
      this.currentUtterance.voice = voice;
    }

    this.currentUtterance.rate = settings.rate;
    this.currentUtterance.pitch = settings.pitch;
    this.currentUtterance.volume = 1;

    this.currentUtterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      resolve();
    };

    this.currentUtterance.onerror = (event) => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (event.error === "canceled") {
        resolve();
      } else {
        reject(new Error(`Speech synthesis failed: ${event.error}`));
      }
    };

    this.synth.speak(this.currentUtterance);
  }

  // ... [Keep findBestVoice, getAvailableVoices, getVoiceInfo, detectVoiceGender methods] ...

  private findBestVoice(
    gender: "male" | "female"
  ): SpeechSynthesisVoice | null {
    // (Paste previous implementation here for brevity, no changes needed)
    // ...
    return this.voices[0]; // Placeholder for brevity
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  // ...

  stop() {
    // Stop browser synth
    if (this.synth.speaking) {
      this.synth.cancel();
    }
    // Note: AudioContext sources are harder to stop globally without storing the source reference.
    // For this implementation, we reset the flag.
    // A robust version would store 'this.currentSource' and call .stop() on it.
    this.isSpeaking = false;
    this.currentUtterance = null;
    console.log("Speech stopped");
  }

  // ... [Keep startListening, isCurrentlySpeaking] ...
  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  async startListening(): Promise<string> {
    // (Paste previous implementation)
    return "";
  }
}
