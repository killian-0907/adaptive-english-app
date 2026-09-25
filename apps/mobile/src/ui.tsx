import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useApp } from "./context";
import { ApiError } from "./api";
export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.text}>{children}</Text>;
}
export function Page({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { text } = useApp();
  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "left", "right", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.page}
        >
          <Text accessibilityRole="header" style={styles.heading}>
            {text(title)}
          </Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Button({
  title,
  onPress,
  disabled = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { text } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text(title)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        danger && styles.danger,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={styles.buttonText}>{text(title)}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  secret = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secret?: boolean;
  multiline?: boolean;
}) {
  const { text } = useApp();
  return (
    <View>
      <Label>{text(label)}</Label>
      <TextInput
        accessibilityLabel={text(label)}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secret}
        multiline={multiline}
        maxLength={multiline ? 3000 : 254}
        autoCapitalize={secret || label === "Email" ? "none" : "sentences"}
        autoCorrect={!secret && label !== "Email"}
        keyboardType={label === "Email" ? "email-address" : "default"}
        style={[
          styles.input,
          multiline && { minHeight: 110, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (s: string) => void;
}) {
  const { text } = useApp();
  return (
    <View style={styles.card}>
      <Label>{text(label)}</Label>
      <View style={styles.options}>
        {options.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === option }}
            accessibilityLabel={text(option)}
            onPress={() => onChange(option)}
            style={[styles.choice, value === option && styles.selected]}
          >
            <Text style={styles.text}>{text(option)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
export function Busy() {
  const { text } = useApp();
  return (
    <View accessibilityRole="progressbar">
      <ActivityIndicator />
      <Label>{text("loading")}</Label>
    </View>
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: string;
  retry?: () => void;
}) {
  const { text } = useApp();
  return error ? (
    <View accessibilityRole="alert">
      <Label>{text(error === "server" ? "network" : error)}</Label>
      {error === "auth" ? (
        <Button title="Sign in" onPress={() => router.push("/auth/login")} />
      ) : (
        retry && <Button title="retry" onPress={retry} />
      )}
    </View>
  ) : null;
}
export function useOperation() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const locked = useRef(false);
  const run = useCallback(async (job: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await job();
    } catch (e) {
      setError(e instanceof ApiError ? e.code : "network");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, error, run, setError };
}
export function useRemote<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setError("");
    try {
      setData(await load());
    } catch (e) {
      setError(e instanceof ApiError ? e.code : "network");
    }
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  return { data, error, refresh, setData };
}
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f3f7f4" },
  page: { padding: 20, gap: 16, paddingBottom: 40 },
  heading: { fontSize: 28, fontWeight: "700", color: "#173d35" },
  text: { fontSize: 17, lineHeight: 25, color: "#173d35", flexShrink: 1 },
  card: { backgroundColor: "white", padding: 16, borderRadius: 16, gap: 10 },
  button: {
    minHeight: 48,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#246858",
    alignItems: "center",
    justifyContent: "center",
  },
  danger: { backgroundColor: "#9a3333" },
  buttonText: { fontSize: 17, fontWeight: "600", color: "white" },
  input: {
    fontSize: 17,
    color: "#173d35",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#809b90",
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
  },
  options: { gap: 8 },
  choice: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#b6c7bf",
    padding: 12,
    borderRadius: 10,
  },
  selected: {
    borderWidth: 2,
    borderColor: "#246858",
    backgroundColor: "#e4f2e9",
  },
});
