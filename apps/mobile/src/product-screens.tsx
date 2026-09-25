import { useCallback, useState } from "react";
import { Redirect, router } from "expo-router";
import {
  homeSchema,
  progressSchema,
  historySchema,
  assessmentSchema,
  onboardingSchema,
} from "../../../packages/contracts/mobile";
import {
  Page,
  Label,
  Button,
  Card,
  Busy,
  ErrorNotice,
  useRemote,
  useOperation,
} from "./ui";
import { useApp } from "./context";
import { PreferencesForm } from "./preferences";
export function HomeScreen() {
  const app = useApp();
  const { api } = app;
  const r = useRemote(
    useCallback(() => api("/api/mobile?view=home", homeSchema), [api]),
  );
  return (
    <Page title="Home">
      <ErrorNotice error={r.error} retry={r.refresh} />
      {!r.data && !r.error && <Busy />}
      {r.data && (
        <>
          <Card>
            <Label>{app.text("Current focus")}</Label>
            <Label>{app.text(r.data.focus)}</Label>
            <Button
              title={
                r.data.active ? "Continue learning" : "Start learning session"
              }
              onPress={() => router.push("/(tabs)/learn")}
            />
          </Card>
          {r.data.progress.needs.map((s) => (
            <Label key={s}>{app.text(s)}</Label>
          ))}
          {r.data.progress.timeline.map((s) => (
            <Card key={s.id}>
              <Label>{app.text(s.text)}</Label>
            </Card>
          ))}
        </>
      )}
    </Page>
  );
}
export function ProgressScreen() {
  const app = useApp();
  const { api } = app;
  const r = useRemote(
    useCallback(() => api("/api/mobile?view=progress", progressSchema), [api]),
  );
  return (
    <Page title="My English">
      <ErrorNotice error={r.error} retry={r.refresh} />
      {!r.data && !r.error && <Busy />}
      {r.data?.cards.map((card) => (
        <Card key={card.key}>
          <Label>{app.text(card.label)}</Label>
          <Label>{app.text(card.stage)}</Label>
          <Label>{app.text(card.note)}</Label>
        </Card>
      ))}
      {r.data?.gaps.map((g) => (
        <Label key={g}>{app.text(g)}</Label>
      ))}
    </Page>
  );
}
export function HistoryScreen() {
  const app = useApp(),
    [page, setPage] = useState(1);
  const { api } = app;
  const r = useRemote(
    useCallback(
      () => api(`/api/mobile?view=history&page=${page}`, historySchema),
      [api, page],
    ),
  );
  return (
    <Page title="History">
      <ErrorNotice error={r.error} retry={r.refresh} />
      {!r.data && !r.error && <Busy />}
      {r.data?.map((s) => (
        <Card key={s.id}>
          <Label>{new Date(s.started).toLocaleDateString(app.language)}</Label>
          {[...s.focus, ...s.scenarios, ...s.expressions, s.note, s.next].map(
            (t, i) => (
              <Label key={i}>{app.text(t)}</Label>
            ),
          )}
        </Card>
      ))}
      <Button
        title="previousPage"
        disabled={page === 1}
        onPress={() => setPage(page - 1)}
      />
      <Button
        title="nextPage"
        disabled={!r.data || r.data.length < 30}
        onPress={() => setPage(page + 1)}
      />
    </Page>
  );
}
export function OnboardingScreen() {
  const app = useApp(),
    op = useOperation();
  if (!app.session && !app.loading) return <Redirect href="/auth/login" />;
  return (
    <Page title="Welcome">
      <ErrorNotice error={op.error} />
      <PreferencesForm
        onboarding
        busy={op.busy}
        initial={undefined}
        onSave={(p, experience) =>
          void op.run(async () => {
            const aliases = {
              conversation: "conversation",
              role_play: "conversation",
              speaking: "conversation",
              listening: "listening",
              sentence_building: "writing",
              guided_writing: "writing",
              vocabulary_context: "examples",
              grammar_explanation: "examples",
              review: "repetition",
              transfer: "conversation",
            } as const;
            const liked = [
              ...new Set(
                Object.entries(p.methods)
                  .filter(([, v]) => v > 0)
                  .map(([m]) => aliases[m as keyof typeof aliases]),
              ),
            ];
            const disliked = [
              ...new Set(
                Object.entries(p.methods)
                  .filter(([, v]) => v < 0)
                  .map(([m]) => aliases[m as keyof typeof aliases]),
              ),
            ].filter((m) => !liked.includes(m));
            const data = onboardingSchema.parse({
              nativeLanguage: p.nativeLanguage,
              interfaceLanguage: p.interfaceLanguage,
              correction: p.correction,
              pace: p.pace,
              goals: p.goals.map((g) => g.key),
              experience,
              liked,
              disliked,
            });
            await app.api("/api/assessment", assessmentSchema, {
              action: "onboarding",
              data,
            });
            await app.refresh();
            router.replace("/assessment");
          })
        }
      />
    </Page>
  );
}
