import React from "react";
import { Text, Pressable } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { AppProvider, useApp } from "./context";
const mockApi = jest.fn();
let mockEvent: (event: string, value: unknown) => void;
const mockAuth = {
  getSession: jest.fn(),
  onAuthStateChange: jest.fn((fn: typeof mockEvent) => {
    mockEvent = fn;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }),
  startAutoRefresh: jest.fn(),
  stopAutoRefresh: jest.fn(),
  signOut: jest.fn(async () => {
    mockEvent("SIGNED_OUT", null);
    return { error: null };
  }),
};
jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    get auth() {
      return mockAuth;
    },
  }),
  processLock: jest.fn(),
}));
jest.mock("./api", () => ({
  createApi:
    () =>
    (...args: unknown[]) =>
      mockApi(...args),
  ApiError: class extends Error {
    code = "auth";
  },
}));
jest.mock("./config", () => ({
  configured: true,
  config: {
    api: "https://example.test",
    supabase: "https://example.test",
    key: "public",
  },
}));
jest.mock("./secure-storage", () => ({ storage: {} }));
jest.mock("./drafts", () => ({ clearDrafts: jest.fn(async () => {}) }));
jest.mock("./voice", () => ({ stopSpeech: jest.fn(async () => {}) }));
function Probe() {
  const app = useApp();
  return (
    <>
      <Text>{app.session?.user.id ?? "signed-out"}</Text>
      <Text>{app.boot?.userId ?? "no-bootstrap"}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="logout"
        onPress={() => void app.signOut()}
      >
        <Text>logout</Text>
      </Pressable>
    </>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.getSession.mockResolvedValue({
    data: { session: { user: { id: "restored-user" } } },
    error: null,
  });
});
test("secure session restoration loads the authoritative bootstrap", async () => {
  mockApi.mockResolvedValue({
    userId: "restored-user",
    entry: "home",
    language: "en",
  });
  const r = render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  await waitFor(() => expect(r.getAllByText("restored-user")).toHaveLength(2));
  expect(mockAuth.startAutoRefresh).toHaveBeenCalled();
  r.unmount();
  expect(mockAuth.stopAutoRefresh).toHaveBeenCalled();
});
test("a late bootstrap cannot restore the logged-out learner", async () => {
  let finish!: (value: unknown) => void;
  mockApi.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const r = render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  await waitFor(() => expect(mockApi).toHaveBeenCalled());
  fireEvent.press(r.getByRole("button", { name: "logout" }));
  await waitFor(() => expect(r.getByText("signed-out")).toBeTruthy());
  finish({ userId: "restored-user", entry: "home", language: "en" });
  await waitFor(() => expect(r.getByText("no-bootstrap")).toBeTruthy());
  expect(r.queryByText("restored-user")).toBeNull();
});
