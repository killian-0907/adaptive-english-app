import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import * as Crypto from "expo-crypto";
import { z } from "zod";
import {
  assessmentSchema,
  learningSchema,
  commandSchema,
  responseSchema,
  supportSchema,
  type LearningDTO,
  type AssessmentDTO,
} from "../../../packages/contracts/mobile";
import { useApp } from "./context";
import {
  Button,
  Page,
  Label,
  Card,
  Field,
  Busy,
  ErrorNotice,
  useOperation,
  useRemote,
} from "./ui";
import {
  NativeSpeechRecognitionProvider,
  speak,
  stopSpeech,
  type VoiceState,
} from "./voice";
import { voiceSettings } from "./voice-settings";
import { readDraft, writeDraft } from "./drafts";
type View = LearningDTO | AssessmentDTO;
export function PracticeScreen({
  assessment = false,
}: {
  assessment?: boolean;
}) {
  const app = useApp(),
    op = useOperation();
  const { api } = app;
  const { setError } = op;
  const endpoint = assessment ? "/api/assessment" : "/api/learning";
  const load = useCallback(
    async (): Promise<View> =>
      assessment
        ? api(endpoint, assessmentSchema)
        : api(endpoint, learningSchema),
    [assessment, api, endpoint],
  );
  const remote = useRemote(load),
    view = remote.data;
  const { refresh } = remote;
  const lesson = view && "kind" in view ? view : null,
    exam = view && "onboarding" in view ? view : null;
  const activeExam = exam && !exam.onboarding && !exam.complete ? exam : null;
  const activity = lesson?.activityId ?? activeExam?.activityId;
  const savedVoice = lesson?.savedVoice ?? activeExam?.savedVoice;
  const savedVoiceId = savedVoice?.id,
    savedVoiceText = savedVoice?.transcript;
  const [draft, setDraft] = useState(""),
    [loaded, setLoaded] = useState<string>(),
    [voiceId, setVoiceId] = useState<string | null>(null),
    [candidate, setCandidate] = useState(""),
    [final, setFinal] = useState(false),
    [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const attempt = useRef<{ activity: string; text: string; id: string } | null>(
      null,
    ),
    provider = useRef<NativeSpeechRecognitionProvider | null>(null);
  const uid = app.session?.user.id;
  const focusGeneration = useRef(0);
  useEffect(() => {
    if (!uid || !activity) return;
    let current = true;
    readDraft(uid, activity)
      .then((text) => {
        if (current) {
          setCandidate("");
          setVoiceId(
            savedVoiceId && savedVoiceText === text ? savedVoiceId : null,
          );
          attempt.current = null;
          setDraft(text);
          setLoaded(activity);
        }
      })
      .catch(() => setError("network"));
    return () => {
      current = false;
    };
  }, [uid, activity, setError, savedVoiceId, savedVoiceText]);
  useFocusEffect(
    useCallback(() => {
      focusGeneration.current++;
      const p = new NativeSpeechRecognitionProvider(
        setVoiceState,
        (text, done) => {
          setCandidate(text);
          setFinal(done);
        },
      );
      provider.current = p;
      const listener = AppState.addEventListener("change", (state) => {
        if (state !== "active") {
          focusGeneration.current++;
          p.cancel();
          void stopSpeech();
        } else void refresh();
      });
      return () => {
        focusGeneration.current++;
        p.cancel();
        void stopSpeech();
        listener.remove();
      };
    }, [refresh, activity]),
  );
  const change = (text: string) => {
    setDraft(text);
    setVoiceId(null);
    if (uid && activity)
      void writeDraft(uid, activity, text).catch(() => op.setError("network"));
  };
  const send = async (body: unknown) => {
    remote.setData(
      assessment
        ? await app.api(endpoint, assessmentSchema, body)
        : await app.api(endpoint, learningSchema, body),
    );
  };
  const feedback = (kind: string) =>
    void op.run(() =>
      send(
        commandSchema.parse({ action: "feedback", activityId: activity, kind }),
      ),
    );
  const play = () =>
    void op.run(async () => {
      const text = lesson?.speechText ?? activeExam?.item?.speechText;
      if (!text) return;
      const generation = focusGeneration.current;
      const preferences = await voiceSettings();
      if (generation !== focusGeneration.current) return;
      if (
        !(await speak(
          text,
          preferences.rate * (lesson?.speed ?? 1),
          preferences.voice,
        ))
      )
        return;
      if (assessment) {
        const saved = await app.api(endpoint, supportSchema, {
          action: "support",
          activityId: activity,
          kind: "replays",
        });
        if (activeExam) remote.setData({ ...activeExam, savedSupport: saved });
      } else
        await send({ action: "support", activityId: activity, kind: "replay" });
    });
  const submit = (skip = false, fatigue = false) =>
    void op.run(async () => {
      if (!activity) return;
      if (assessment)
        await send({
          action: "answer",
          data: responseSchema.parse({
            activityId: activity,
            text: draft,
            voiceId,
            skip,
            fatigue,
            support: activeExam?.savedSupport,
          }),
        });
      else
        await send(
          commandSchema.parse({
            action: "answer",
            activityId: activity,
            text: draft,
            voiceId,
            skip,
            elapsedMs: null,
          }),
        );
      if (uid) await writeDraft(uid, activity, "");
      setDraft("");
      setVoiceId(null);
    });
  if (!app.session && !app.loading) return <Redirect href="/auth/login" />;
  if (exam?.onboarding || lesson?.kind === "assessment_required")
    return <Redirect href={exam?.onboarding ? "/onboarding" : "/assessment"} />;
  return (
    <Page title={assessment ? "Assessment" : "Learn"}>
      <ErrorNotice error={remote.error || op.error} retry={remote.refresh} />
      {!view && !remote.error && <Busy />}
      {lesson?.kind === "start" && (
        <Button
          title="Start learning session"
          disabled={op.busy}
          onPress={() => void op.run(() => send({ action: "start" }))}
        />
      )}
      {(lesson?.kind === "summary" ||
        (exam && !exam.onboarding && exam.complete)) && (
        <>
          <Card>
            {lesson?.summary &&
              [
                ...lesson.summary.practiced,
                ...lesson.summary.worked,
                ...lesson.summary.needsPractice,
                ...lesson.summary.expressions,
                lesson.summary.next,
              ].map((text, i) => <Label key={i}>{app.text(text)}</Label>)}
            {exam && !exam.onboarding && exam.result && (
              <Label>{app.text("Assessment complete")}</Label>
            )}
          </Card>
          <Button
            title="Continue learning"
            onPress={() =>
              void op.run(async () => {
                await app.refresh();
                if (assessment) router.replace("/(tabs)/home");
                else await send({ action: "start" });
              })
            }
          />
        </>
      )}
      {activity && (
        <>
          <Card>
            <Label>
              {app.text(
                lesson?.objective ?? activeExam?.item?.instruction ?? "",
              )}
            </Label>
            <Label>{lesson?.prompt ?? activeExam?.item?.prompt}</Label>
            {lesson?.correction && <Label>{app.text(lesson.correction)}</Label>}
            {lesson?.nativeHelp && <Label>{lesson.nativeHelp}</Label>}
            {lesson?.frame && <Label>{lesson.frame}</Label>}
            {lesson?.supportText && (
              <Label>{app.text(lesson.supportText)}</Label>
            )}
          </Card>
          {(lesson?.speechText || activeExam?.item?.speechText) && (
            <>
              <Button title="Listen" disabled={op.busy} onPress={play} />
              <Button title="Stop" onPress={() => void stopSpeech()} />
              <Button
                title="Read instead"
                disabled={op.busy}
                onPress={() =>
                  void op.run(async () => {
                    if (assessment) {
                      const r = await app.api(
                        endpoint,
                        z.object({ text: z.string() }),
                        { action: "transcript", activityId: activity },
                      );
                      if (activeExam)
                        remote.setData({
                          ...activeExam,
                          item: { ...activeExam.item!, instruction: r.text },
                          savedSupport: {
                            ...activeExam.savedSupport!,
                            transcript: true,
                          },
                        });
                    } else
                      await send({
                        action: "support",
                        activityId: activity,
                        kind: "transcript",
                      });
                  })
                }
              />
            </>
          )}
          {lesson?.transcript && <Label>{lesson.transcript}</Label>}
          {loaded !== activity ? (
            <Busy />
          ) : (
            <>
              {(lesson?.options ?? activeExam?.item?.options ?? []).map(
                (option) => (
                  <Button
                    key={option}
                    title={`${draft === option ? "✓ " : ""}${option}`}
                    onPress={() => change(option)}
                  />
                ),
              )}
              <Field
                label="Your response"
                value={draft}
                onChange={change}
                multiline
              />
              {(lesson?.spoken || activeExam?.item?.spoken) &&
                (lesson?.voiceAllowed ?? activeExam?.voiceAllowed ?? true) && (
                  <Card>
                    <Label>{app.text("privacy")}</Label>
                    <Label>{app.text(voiceState)}</Label>
                    <Button
                      title="record"
                      disabled={op.busy || voiceState === "recording"}
                      onPress={() => {
                        setCandidate("");
                        setFinal(false);
                        void provider.current
                          ?.start()
                          .catch(() => setVoiceState("error"));
                      }}
                    />
                    <Button
                      title="Stop"
                      onPress={() => provider.current?.stop()}
                    />
                    {voiceState === "blocked" && (
                      <Button
                        title="deviceSettings"
                        onPress={() => void Linking.openSettings()}
                      />
                    )}
                    <Label>{candidate}</Label>
                    <Button
                      title="confirmVoice"
                      disabled={!final || !candidate || op.busy}
                      onPress={() =>
                        void op.run(async () => {
                          if (
                            !attempt.current ||
                            attempt.current.text !== candidate ||
                            attempt.current.activity !== activity
                          )
                            attempt.current = {
                              activity,
                              text: candidate,
                              id: Crypto.randomUUID(),
                            };
                          const r = await app.api(
                            endpoint,
                            z.object({
                              voiceId: z.uuid(),
                              transcript: z.string(),
                            }),
                            commandSchema.parse({
                              action: "native_voice",
                              activityId: activity,
                              attemptId: attempt.current.id,
                              text: candidate,
                            }),
                          );
                          setDraft(r.transcript);
                          setVoiceId(r.voiceId);
                          if (uid)
                            await writeDraft(uid, activity, r.transcript);
                        })
                      }
                    />
                  </Card>
                )}
              <Button
                title="Check response"
                disabled={op.busy || !draft.trim()}
                onPress={() => submit()}
              />
              <Button
                title="Skip"
                disabled={op.busy}
                onPress={() => submit(true)}
              />
            </>
          )}
          <Button
            title="Hint"
            disabled={op.busy}
            onPress={() =>
              void op.run(async () => {
                if (assessment) {
                  const saved = await app.api(endpoint, supportSchema, {
                    action: "support",
                    activityId: activity,
                    kind: "hints",
                  });
                  if (activeExam)
                    remote.setData({
                      ...activeExam,
                      savedSupport: saved,
                      item: {
                        ...activeExam.item!,
                        instruction: activeExam.item!.hint,
                      },
                    });
                } else
                  await send({
                    action: "support",
                    activityId: activity,
                    kind: "next",
                  });
              })
            }
          />
          {assessment && (
            <Button
              title="Finish for now"
              disabled={op.busy}
              onPress={() => submit(true, true)}
            />
          )}
          {!assessment && (
            <>
              <Button
                title="This method doesn’t work for me"
                disabled={op.busy}
                onPress={() => feedback("reject_method")}
              />
              <Button
                title="Too difficult"
                disabled={op.busy}
                onPress={() => feedback("too_difficult")}
              />
              <Button
                title="Too easy"
                disabled={op.busy}
                onPress={() => feedback("bored")}
              />
              <Button
                title="More speaking"
                disabled={op.busy}
                onPress={() => feedback("more_speaking")}
              />
              <Button
                title="I am tired"
                disabled={op.busy}
                onPress={() => feedback("tired")}
              />
              <Button
                title="Back to normal"
                disabled={op.busy}
                onPress={() => feedback("normal")}
              />
              <Button
                title="End session"
                disabled={op.busy}
                onPress={() =>
                  void op.run(async () => {
                    await stopSpeech();
                    provider.current?.cancel();
                    await send({ action: "end", sessionId: lesson?.sessionId });
                  })
                }
              />
            </>
          )}
        </>
      )}
    </Page>
  );
}
