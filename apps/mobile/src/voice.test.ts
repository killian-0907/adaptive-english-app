import { NativeSpeechRecognitionProvider, speak, stopSpeech } from "./voice";
import * as Speech from "expo-speech";
const mockListeners = new Map<
  string,
  (event: { results: { transcript: string }[]; isFinal: boolean }) => void
>();
const mockModule = {
  isRecognitionAvailable: jest.fn(() => true),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  addListener: jest.fn(
    (
      name: string,
      fn: (e: { results: { transcript: string }[]; isFinal: boolean }) => void,
    ) => {
      mockListeners.set(name, fn);
      return { remove: () => mockListeners.delete(name) };
    },
  ),
};
jest.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: mockModule,
}));
jest.mock("expo-speech", () => ({
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: async () => [
    { identifier: "english", language: "en-US" },
  ],
  speak: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  mockModule.isRecognitionAvailable.mockReturnValue(true);
  mockModule.getPermissionsAsync.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
});
test("permission refusal offers typed fallback without starting recognition", async () => {
  mockModule.getPermissionsAsync.mockResolvedValue({
    granted: false,
    canAskAgain: false,
  });
  const state = jest.fn(),
    result = jest.fn();
  await new NativeSpeechRecognitionProvider(
    state,
    result,
    async () => mockModule as never,
  ).start();
  expect(state).toHaveBeenLastCalledWith("blocked");
  expect(mockModule.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(mockModule.start).not.toHaveBeenCalled();
  expect(result).not.toHaveBeenCalled();
});
test("unavailable native module offers fallback", async () => {
  mockModule.isRecognitionAvailable.mockReturnValue(false);
  const state = jest.fn();
  await new NativeSpeechRecognitionProvider(
    state,
    jest.fn(),
    async () => mockModule as never,
  ).start();
  expect(state).toHaveBeenLastCalledWith("unavailable");
});
test("first permission request can enable recognition; background cancellation rejects late results", async () => {
  mockModule.getPermissionsAsync.mockResolvedValue({
    granted: false,
    canAskAgain: true,
  });
  mockModule.requestPermissionsAsync.mockResolvedValue({ granted: true });
  const result = jest.fn(),
    p = new NativeSpeechRecognitionProvider(
      jest.fn(),
      result,
      async () => mockModule as never,
    );
  await p.start();
  expect(mockModule.start).toHaveBeenCalledWith(
    expect.objectContaining({ recordingOptions: { persist: false } }),
  );
  const listener = mockListeners.get("result")!;
  listener({ results: [{ transcript: "Hello" }], isFinal: true });
  expect(result).toHaveBeenLastCalledWith("Hello", true);
  p.cancel();
  listener({ results: [{ transcript: "late" }], isFinal: true });
  expect(result).toHaveBeenCalledTimes(1);
  expect(mockModule.abort).toHaveBeenCalled();
  expect(mockListeners.size).toBe(0);
});
test("stopped TTS is not completed listening", async () => {
  jest.mocked(Speech.speak).mockImplementation((_text, options) => {
    options?.onStopped?.();
  });
  await expect(speak("Hello", 1)).resolves.toBe(false);
  await stopSpeech();
  expect(Speech.stop).toHaveBeenCalled();
});
