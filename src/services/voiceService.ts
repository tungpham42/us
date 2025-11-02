export class VoiceService {
  private synth = window.speechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded: boolean = false;
  private isSpeaking: boolean = false;

  constructor() {
    this.loadVoices();

    // Some browsers load voices asynchronously
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => {
        console.log("Voices changed, reloading...");
        this.loadVoices();
      };
    }

    // Initial voice loading with timeout
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

    console.log(
      `Loaded ${loadedVoices.length} voices:`,
      loadedVoices.map((v) => ({
        name: v.name,
        lang: v.lang,
        local: v.localService,
        default: v.default,
      }))
    );
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

  // Add browser support detection methods
  isSpeechSupported(): boolean {
    return "speechSynthesis" in window;
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
    return new Promise(async (resolve, reject) => {
      if (!this.isSpeechSupported()) {
        reject(new Error("Speech synthesis not supported"));
        return;
      }

      // Ensure voices are loaded
      await this.ensureVoicesLoaded();

      if (this.voices.length === 0) {
        reject(new Error("No voices available"));
        return;
      }

      // Stop any current speech
      if (this.isSpeaking) {
        this.stop();
        // Add a small delay to ensure clean state
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      this.currentUtterance = new SpeechSynthesisUtterance(text);
      this.isSpeaking = true;

      // Get the best matching voice for the selected gender
      const voice = this.findBestVoice(settings.gender);
      if (voice) {
        this.currentUtterance.voice = voice;
        console.log(
          `Using voice: "${voice.name}" for gender: ${settings.gender}`
        );
      } else {
        console.warn("No preferred voice found, using default");
      }

      this.currentUtterance.rate = settings.rate;
      this.currentUtterance.pitch = settings.pitch;
      this.currentUtterance.volume = 1;

      this.currentUtterance.onend = () => {
        console.log("Speech finished");
        this.isSpeaking = false;
        this.currentUtterance = null;
        resolve();
      };

      this.currentUtterance.onerror = (event) => {
        console.error("Speech error:", event);
        this.isSpeaking = false;
        this.currentUtterance = null;

        // Don't reject for cancellation errors - they're usually intentional
        if (event.error === "canceled") {
          console.log("Speech was intentionally canceled");
          resolve(); // Resolve instead of reject for cancellations
        } else {
          reject(new Error(`Speech synthesis failed: ${event.error}`));
        }
      };

      try {
        this.synth.speak(this.currentUtterance);
        console.log("Speech started with settings:", settings);
      } catch (error) {
        console.error("Error starting speech:", error);
        this.isSpeaking = false;
        this.currentUtterance = null;
        reject(error);
      }
    });
  }

  private findBestVoice(
    gender: "male" | "female"
  ): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) {
      return null;
    }

    // Common voice names by gender across different browsers/OS
    const voicePreferences = {
      female: [
        // Windows
        "Microsoft Zira",
        "Zira",
        // macOS
        "Samantha",
        "Karen",
        "Victoria",
        "Tessa",
        "Veena",
        // Chrome OS
        "Google UK English Female",
        "Google US English Female",
        // Android
        "English female",
        "Female",
        // Fallbacks
        "woman",
        "female",
      ],
      male: [
        // Windows
        "Microsoft David",
        "David",
        "Microsoft Mark",
        "Mark",
        // macOS
        "Alex",
        "Daniel",
        "Thomas",
        "Lee",
        "Kyoko",
        // Chrome OS
        "Google UK English Male",
        "Google US English Male",
        // Android
        "English male",
        "Male",
        // Fallbacks
        "man",
        "male",
      ],
    };

    const preferredNames = voicePreferences[gender];

    // Try exact matches first
    for (const name of preferredNames) {
      const exactMatch = this.voices.find(
        (voice) => voice.name.toLowerCase() === name.toLowerCase()
      );
      if (exactMatch) {
        return exactMatch;
      }
    }

    // Try partial matches
    for (const name of preferredNames) {
      const partialMatch = this.voices.find((voice) =>
        voice.name.toLowerCase().includes(name.toLowerCase())
      );
      if (partialMatch) {
        return partialMatch;
      }
    }

    // If no gender match found, use a different strategy
    // For male voices, try to avoid obviously female voices
    if (gender === "male") {
      const nonFemaleVoices = this.voices.filter((voice) => {
        const voiceName = voice.name.toLowerCase();
        return (
          !voiceName.includes("female") &&
          !voiceName.includes("woman") &&
          !voiceName.includes("zira") &&
          !voiceName.includes("samantha") &&
          !voiceName.includes("karen") &&
          !voiceName.includes("victoria") &&
          !voiceName.includes("tessa") &&
          !voiceName.includes("veena")
        );
      });

      if (nonFemaleVoices.length > 0) {
        // Prefer English voices
        const englishVoices = nonFemaleVoices.filter((voice) =>
          voice.lang.startsWith("en-")
        );
        return englishVoices.length > 0 ? englishVoices[0] : nonFemaleVoices[0];
      }
    }

    // Final fallback - use default voice or first available
    const defaultVoice =
      this.voices.find((voice) => voice.default) || this.voices[0];
    console.warn(`No ${gender} voice found, using: ${defaultVoice?.name}`);
    return defaultVoice;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  getVoiceInfo(): { name: string; lang: string; gender: string }[] {
    return this.voices.map((voice) => ({
      name: voice.name,
      lang: voice.lang,
      gender: this.detectVoiceGender(voice.name),
    }));
  }

  private detectVoiceGender(voiceName: string): string {
    const name = voiceName.toLowerCase();
    if (
      name.includes("female") ||
      name.includes("woman") ||
      name.includes("zira") ||
      name.includes("samantha")
    ) {
      return "female";
    }
    if (
      name.includes("male") ||
      name.includes("man") ||
      name.includes("david") ||
      name.includes("alex")
    ) {
      return "male";
    }
    return "unknown";
  }

  stop() {
    if (this.synth.speaking || this.isSpeaking) {
      this.synth.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
      console.log("Speech stopped");
    }
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  async startListening(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.isRecognitionSupported()) {
        resolve("");
        return;
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log("Speech recognition result:", transcript);
        resolve(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        resolve("");
      };

      recognition.onend = () => {
        console.log("Speech recognition ended");
      };

      try {
        recognition.start();
        console.log("Speech recognition started");
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        resolve("");
      }
    });
  }
}
