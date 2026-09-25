import * as Speech from "expo-speech";
export type VoiceState =
  "idle" | "recording" | "denied" | "blocked" | "unavailable" | "error";
type Module =
  typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;
export class NativeSpeechRecognitionProvider {
  private module: Module | null = null;
  private listeners: { remove: () => void }[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active = false;
  private generation = 0;
  constructor(
    private state: (s: VoiceState) => void,
    private result: (text: string, final: boolean) => void,
    private load: () => Promise<Module> = async () =>
      (await import("expo-speech-recognition")).ExpoSpeechRecognitionModule,
  ) {}
  async available() {
    try {
      this.module = await this.load();
      return this.module.isRecognitionAvailable();
    } catch {
      return false;
    }
  }
  async start() {
    this.cancel();
    const generation = this.generation;
    const available = await this.available();
    if (generation !== this.generation) return;
    if (!available || !this.module) {
      this.state("unavailable");
      return;
    }
    let permission = await this.module.getPermissionsAsync();
    if (generation !== this.generation) return;
    if (!permission.granted) {
      if (!permission.canAskAgain) {
        this.state("blocked");
        return;
      }
      permission = await this.module.requestPermissionsAsync();
      if (generation !== this.generation) return;
    }
    if (!permission.granted) {
      this.state(permission.canAskAgain ? "denied" : "blocked");
      return;
    }
    this.active = true;
    this.listeners = [
      this.module.addListener("result", (e) => {
        if (this.active)
          this.result(
            (e.results[0]?.transcript ?? "").slice(0, 3000),
            e.isFinal,
          );
      }),
      this.module.addListener("end", () => {
        this.active = false;
        clearTimeout(this.timer);
        this.state("idle");
      }),
      this.module.addListener("error", () => {
        this.active = false;
        clearTimeout(this.timer);
        this.state("error");
      }),
    ];
    try {
      this.module.start({
        lang: "en-US",
        interimResults: true,
        continuous: false,
        recordingOptions: { persist: false },
      });
      this.state("recording");
      this.timer = setTimeout(() => this.stop(), 45000);
    } catch {
      this.cancel();
      this.state("unavailable");
    }
  }
  stop() {
    this.module?.stop();
    clearTimeout(this.timer);
  }
  cancel() {
    this.generation++;
    this.active = false;
    clearTimeout(this.timer);
    this.listeners.forEach((l) => l.remove());
    this.listeners = [];
    this.module?.abort();
    this.state("idle");
  }
}
let playback = 0;
export async function stopSpeech() {
  playback++;
  await Speech.stop();
}
export async function speak(text: string, rate: number, voiceId = "") {
  await stopSpeech();
  const generation = playback;
  const voices = await Speech.getAvailableVoicesAsync();
  const voice =
    voices.find(
      (v) => v.identifier === voiceId && v.language.startsWith("en"),
    ) ?? voices.find((v) => v.language.startsWith("en"));
  if (generation !== playback) return false;
  return new Promise<boolean>((resolve, reject) =>
    Speech.speak(text, {
      language: "en-US",
      voice: voice?.identifier,
      rate: Math.max(0.7, Math.min(1.25, rate)),
      onDone: () => resolve(true),
      onStopped: () => resolve(false),
      onError: () => reject(new Error("voice")),
    }),
  );
}
