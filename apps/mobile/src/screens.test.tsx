import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import {
  HomeScreen,
  ProgressScreen,
  HistoryScreen,
  OnboardingScreen,
} from "./product-screens";
import { PracticeScreen } from "./practice-screen";
import { SettingsScreen } from "./settings-screen";
import { LoginScreen } from "./auth-screen";
import Entry from "../app/index";
import { t as mockTranslate } from "./i18n";
const mockApi = jest.fn();
const mockRefresh = jest.fn();
const mockCancelVoice = jest.fn();
let mockFocused = true;
let mockEntry = "home";
let mockSession: unknown = {
  user: { id: "test-user", email: "learner@example.test" },
};
jest.mock("./context", () => ({
  useApp: () => ({
    api: mockApi,
    refresh: mockRefresh,
    session: mockSession,
    boot: { entry: mockEntry },
    loading: false,
    error: "",
    language: "en",
    text: (key: string) => mockTranslate("en", key),
    setLanguage: jest.fn(),
    signOut: jest.fn(),
  }),
  supabase: {
    auth: {
      signInWithPassword: jest.fn(async () => ({ error: null })),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
  },
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require("react-native");
    return <Text>{href}</Text>;
  },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => void) => {
    const React = require("react");
    React.useEffect(
      () => (mockFocused ? callback() : undefined),
      [callback, mockFocused],
    );
  },
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: require("react-native").View,
}));
jest.mock("./voice", () => ({
  NativeSpeechRecognitionProvider: class {
    cancel() {
      mockCancelVoice();
    }
    start() {
      return Promise.resolve();
    }
    stop() {}
  },
  stopSpeech: jest.fn(async () => {}),
  speak: jest.fn(async () => true),
}));
jest.mock("./voice-settings", () => ({
  voiceSettings: async () => ({ voice: "", rate: 1 }),
  saveVoiceSettings: jest.fn(),
}));
jest.mock("./drafts", () => ({
  readDraft: async () => "kept draft",
  writeDraft: jest.fn(),
}));
jest.mock("expo-speech", () => ({ getAvailableVoicesAsync: async () => [] }));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: async () => true,
  shareAsync: jest.fn(),
}));
jest.mock("expo-file-system", () => ({
  File: jest.fn(),
  Paths: { cache: "cache" },
}));
const preferences = {
  nativeLanguage: "en",
  interfaceLanguage: "en",
  goals: [{ key: "work", priority: 3 }],
  methods: {
    conversation: 0,
    role_play: 0,
    speaking: 0,
    listening: 0,
    sentence_building: 0,
    guided_writing: 0,
    vocabulary_context: 0,
    grammar_explanation: 0,
    review: 0,
    transfer: 0,
  },
  correction: "gentle",
  pace: "balanced",
};
beforeEach(() => {
  mockFocused = true;
  mockCancelVoice.mockClear();
  mockApi.mockReset();
  mockRefresh.mockReset();
  mockSession = { user: { id: "test-user", email: "learner@example.test" } };
  mockEntry = "home";
});
test("leaving a mounted practice tab cancels recording and playback", async () => {
  mockApi.mockResolvedValue({
    kind: "activity",
    activityId: "00000000-0000-4000-8000-000000000001",
    prompt: "Practice",
  });
  const r = render(<PracticeScreen />);
  await waitFor(() => expect(r.getByDisplayValue("kept draft")).toBeTruthy());
  mockCancelVoice.mockClear();
  mockFocused = false;
  r.rerender(<PracticeScreen />);
  expect(mockCancelVoice).toHaveBeenCalledTimes(1);
});
test("startup routes signed-out, onboarding, assessment and assessed sessions", () => {
  for (const entry of ["home", "onboarding", "assessment"]) {
    mockEntry = entry;
    const r = render(<Entry />);
    expect(
      r.getByText(entry === "home" ? "/(tabs)/home" : `/${entry}`),
    ).toBeTruthy();
    r.unmount();
  }
  mockSession = null;
  expect(render(<Entry />).getByText("/auth/login")).toBeTruthy();
});
test("login exposes native credential and recovery controls", () => {
  const r = render(<LoginScreen />);
  expect(r.getByLabelText("Email")).toBeTruthy();
  expect(r.getByLabelText("Password")).toBeTruthy();
  expect(r.getByRole("button", { name: "Forgot password?" })).toBeTruthy();
});
test("Home renders authoritative focus and resume", async () => {
  mockApi.mockResolvedValue({
    focus: "work",
    active: true,
    progress: { needs: ["reading"], timeline: [] },
  });
  const r = render(<HomeScreen />);
  await waitFor(() =>
    expect(r.getByRole("button", { name: "Continue learning" })).toBeTruthy(),
  );
});
test("My English preserves dimension-specific uncertainty", async () => {
  mockApi.mockResolvedValue({
    cards: [
      {
        key: "reading",
        label: "Reading",
        stage: "Developing",
        note: "Not enough evidence",
      },
    ],
    gaps: [],
  });
  const r = render(<ProgressScreen />);
  await waitFor(() => expect(r.getByText("Not enough evidence")).toBeTruthy());
});
test("History requests one page at a time", async () => {
  mockApi.mockResolvedValue(
    Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      started: "2026-09-26",
      focus: [],
      scenarios: [],
      expressions: [],
      note: "Practice",
      next: "Review",
    })),
  );
  const r = render(<HistoryScreen />);
  await waitFor(() =>
    expect(r.getByRole("button", { name: "Next page" })).not.toBeDisabled(),
  );
  fireEvent.press(r.getByRole("button", { name: "Next page" }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenLastCalledWith(
      "/api/mobile?view=history&page=2",
      expect.anything(),
    ),
  );
});
test("onboarding submits the shared server contract without device-only preferences", async () => {
  mockApi.mockResolvedValue({});
  const r = render(<OnboardingScreen />);
  fireEvent.press(r.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mockApi).toHaveBeenCalled());
  const body = mockApi.mock.calls[0][2];
  expect(body.action).toBe("onboarding");
  expect(body.data).not.toHaveProperty("methods");
  expect(body.data.goals).toEqual(["daily_communication"]);
});
test.each([false, true])(
  "practice preserves drafts and submits authoritative activity identity (assessment=%s)",
  async (assessment) => {
    const id = "00000000-0000-4000-8000-000000000001",
      support = {
        hints: 0,
        replays: 0,
        retries: 0,
        translation: false,
        transcript: false,
      };
    mockApi.mockResolvedValue(
      assessment
        ? {
            onboarding: false,
            complete: false,
            activityId: id,
            savedSupport: support,
            item: {
              instruction: "Try",
              prompt: "Write a greeting",
              options: [],
              spoken: false,
            },
          }
        : {
            kind: "activity",
            activityId: id,
            prompt: "Write a greeting",
            spoken: false,
          },
    );
    const r = render(<PracticeScreen assessment={assessment} />);
    await waitFor(() => expect(r.getByDisplayValue("kept draft")).toBeTruthy());
    fireEvent.press(r.getByRole("button", { name: "Submit response" }));
    await waitFor(() =>
      expect(mockApi.mock.calls.some((c) => c[2]?.action === "answer")).toBe(
        true,
      ),
    );
    const body = mockApi.mock.calls.find((c) => c[2]?.action === "answer")![2];
    expect(assessment ? body.data.activityId : body.activityId).toBe(id);
  },
);
test("Settings renders membership without checkout or purchase links", async () => {
  mockApi.mockImplementation(async (path: string) =>
    path.includes("membership")
      ? { current: { name: "Free", future: [] }, plans: [] }
      : preferences,
  );
  const r = render(<SettingsScreen />);
  await waitFor(() =>
    expect(
      r.getByText("Purchases are unavailable in the native beta."),
    ).toBeTruthy(),
  );
  expect(r.queryByText(/Buy Premium|Checkout|Subscribe now/)).toBeNull();
  expect(r.getByRole("button", { name: "Delete account" })).toBeTruthy();
  expect(r.getByRole("button", { name: "Export my data" })).toBeTruthy();
});
