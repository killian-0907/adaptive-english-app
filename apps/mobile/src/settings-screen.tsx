import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import * as Speech from "expo-speech";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { z } from "zod";
import {
  settingsSchema,
  membershipSchema,
  feedbackCategories,
  betaFeedbackSchema,
} from "../../../packages/contracts/mobile";
import { useApp } from "./context";
import {
  Page,
  Card,
  Label,
  Button,
  Choice,
  Field,
  ErrorNotice,
  Busy,
  useRemote,
  useOperation,
} from "./ui";
import { PreferencesForm } from "./preferences";
import { voiceSettings, saveVoiceSettings } from "./voice-settings";
export function SettingsScreen() {
  const app = useApp(),
    op = useOperation();
  const { api } = app;
  const r = useRemote(
    useCallback(
      async () => ({
        preferences: await api("/api/settings", settingsSchema),
        membership: await api("/api/mobile?view=membership", membershipSchema),
      }),
      [api],
    ),
  );
  const [voices, setVoices] = useState<Speech.Voice[]>([]),
    [voice, setVoice] = useState({ voice: "", rate: 1 }),
    [category, setCategory] = useState<string>("other"),
    [feedback, setFeedback] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    void voiceSettings().then(setVoice);
    void Speech.getAvailableVoicesAsync()
      .then((v) => setVoices(v.filter((v) => v.language.startsWith("en"))))
      .catch(() => {});
  }, []);
  const saveVoice = (next: typeof voice) =>
    void op.run(async () => {
      await saveVoiceSettings(next);
      setVoice(next);
    });
  const exportData = () =>
    void op.run(async () => {
      if (!(await Sharing.isAvailableAsync())) throw new Error("share");
      const data = await app.api(
        "/api/account",
        z.record(z.string(), z.unknown()),
        { action: "export" },
      );
      const file = new File(
        Paths.cache,
        `adaptive-english-export-${Date.now()}.json`,
      );
      try {
        file.create();
        file.write(JSON.stringify(data, null, 2));
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/json",
          UTI: "public.json",
        });
        setNotice("exported");
      } finally {
        if (file.exists) file.delete();
      }
    });
  const remove = () =>
    Alert.alert(app.text("Delete account"), app.text("deleteConfirm"), [
      { text: app.text("Cancel"), style: "cancel" },
      {
        text: app.text("Delete account"),
        style: "destructive",
        onPress: () =>
          void op.run(async () => {
            await app.api(
              "/api/account",
              z.object({ deleted: z.literal(true) }),
              { confirmation: "DELETE" },
            );
            await app.signOut();
          }),
      },
    ]);
  return (
    <Page title="Settings">
      <ErrorNotice error={r.error || op.error} retry={r.refresh} />
      {notice && <Label>{app.text(notice)}</Label>}
      {!r.data && !r.error && <Busy />}
      <Card>
        <Label>{app.text("Account")}</Label>
        <Label>{app.session?.user.email}</Label>
        <Button
          title="Sign out"
          disabled={op.busy}
          onPress={() => void op.run(app.signOut)}
        />
      </Card>
      {r.data && (
        <>
          <PreferencesForm
            initial={r.data.preferences}
            busy={op.busy}
            onSave={(p) =>
              void op.run(async () => {
                await app.api("/api/settings", settingsSchema, p);
                app.setLanguage(p.interfaceLanguage);
                setNotice("saved");
                await app.refresh();
              })
            }
          />
          <Card>
            <Label>
              {app.text("Membership")}:{" "}
              {app.text(r.data.membership.current.name)}
            </Label>
            <Label>{app.text("purchases")}</Label>
            {r.data.membership.current.future.map((f) => (
              <Label key={f.label}>
                {app.text(f.label)}:{" "}
                {app.text(f.eligible ? "Included" : "Unavailable")}
              </Label>
            ))}
            {r.data.membership.plans.map((p) => (
              <Card key={p.name}>
                <Label>{app.text(p.name)}</Label>
                {p.features.map((f) => (
                  <Label key={f.label}>{app.text(f.label)}</Label>
                ))}
              </Card>
            ))}
          </Card>
        </>
      )}
      <Card>
        <Label>{app.text("Voice settings")}</Label>
        {voices.map((v) => (
          <Button
            key={v.identifier}
            title={`${voice.voice === v.identifier ? "✓ " : ""}${v.name} (${v.language})`}
            disabled={op.busy}
            onPress={() => saveVoice({ ...voice, voice: v.identifier })}
          />
        ))}
        <Choice
          label="Speech rate"
          value={String(voice.rate)}
          options={["0.7", "0.85", "1", "1.15", "1.25"]}
          onChange={(rate) => saveVoice({ ...voice, rate: Number(rate) })}
        />
      </Card>
      <Card>
        <Label>{app.text("Privacy and data")}</Label>
        <Label>{app.text("privacy")}</Label>
        <Label>{app.text("dataPrivacy")}</Label>
        <Button
          title="Export my data"
          disabled={op.busy}
          onPress={exportData}
        />
        <Button title="Delete account" disabled={op.busy} onPress={remove} />
      </Card>
      <Card>
        <Choice
          label="Feedback"
          value={category}
          options={feedbackCategories}
          onChange={setCategory}
        />
        <Field
          label="Your feedback"
          value={feedback}
          onChange={(text) => setFeedback(text.slice(0, 1000))}
          multiline
        />
        <Button
          title="Send feedback"
          disabled={op.busy || !feedback.trim()}
          onPress={() =>
            void op.run(async () => {
              await app.api(
                "/api/feedback",
                z.object({ saved: z.literal(true) }),
                betaFeedbackSchema.parse({
                  category,
                  text: feedback,
                  route: "/settings",
                }),
              );
              setFeedback("");
              setNotice("saved");
            })
          }
        />
      </Card>
      <Label>{app.text("beta")} · 0.1.0 (1) · API 1</Label>
    </Page>
  );
}
