import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Page,
  Field,
  Button,
  ErrorNotice,
  Label,
  Choice,
  useOperation,
} from "./ui";
import { supabase, useApp } from "./context";
import { config } from "./config";
export function LoginScreen() {
  const app = useApp(),
    op = useOperation();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [sent, setSent] = useState(false);
  return (
    <Page title="Sign in">
      <Choice
        label="Interface language"
        value={app.language}
        options={["en", "zh", "es"]}
        onChange={(v) => app.setLanguage(v as typeof app.language)}
      />
      <ErrorNotice error={op.error || app.error} />
      <Field label="Email" value={email} onChange={setEmail} />
      <Field label="Password" value={password} onChange={setPassword} secret />
      {sent && <Label>{app.text("sent")}</Label>}
      <Button
        title="Sign in"
        disabled={op.busy}
        onPress={() =>
          void op.run(async () => {
            const r = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (r.error) throw r.error;
            setPassword("");
            await app.refresh();
            router.replace("/");
          })
        }
      />
      <Button
        title="Create account"
        disabled={op.busy || password.length < 8}
        onPress={() =>
          void op.run(async () => {
            const r = await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { emailRedirectTo: config.callback },
            });
            if (r.error) throw r.error;
            setPassword("");
            setSent(true);
            if (r.data.session) {
              await app.refresh();
              router.replace("/");
            }
          })
        }
      />
      <Button
        title="Forgot password?"
        disabled={op.busy || !email.trim()}
        onPress={() =>
          void op.run(async () => {
            const r = await supabase.auth.resetPasswordForEmail(email.trim(), {
              redirectTo: config.recovery,
            });
            if (r.error) throw r.error;
            setSent(true);
          })
        }
      />
    </Page>
  );
}
export function CallbackScreen() {
  const { flow, code } = useLocalSearchParams<{
    flow: string;
    code?: string;
  }>();
  const app = useApp(),
    op = useOperation();
  const processed = useRef<string | null>(null);
  const { run } = op;
  const { refresh } = app;
  const [ready, setReady] = useState(false),
    [password, setPassword] = useState("");
  useEffect(() => {
    if (
      typeof code !== "string" ||
      code.length > 2048 ||
      !["callback", "recovery"].includes(flow) ||
      processed.current === code
    )
      return;
    processed.current = code;
    void run(async () => {
      const r = await supabase.auth.exchangeCodeForSession(code);
      if (r.error) throw r.error;
      setReady(true);
      if (flow !== "recovery") {
        await refresh();
        router.replace("/");
      }
    });
  }, [code, flow, run, refresh]);
  return (
    <Page title={flow === "recovery" ? "reset" : "Confirm your email"}>
      <ErrorNotice error={op.error} />
      {flow === "recovery" && ready && (
        <>
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            secret
          />
          <Button
            title="Save"
            disabled={op.busy || password.length < 8}
            onPress={() =>
              void op.run(async () => {
                const r = await supabase.auth.updateUser({ password });
                if (r.error) throw r.error;
                setPassword("");
                await app.signOut();
                router.replace("/auth/login");
              })
            }
          />
        </>
      )}
      <Button title="Sign in" onPress={() => router.replace("/auth/login")} />
    </Page>
  );
}
