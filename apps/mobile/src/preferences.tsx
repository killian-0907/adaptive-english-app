import { useState } from "react";
import { z } from "zod";
import {
  settingsSchema,
  goalKeys,
  languageKeys,
  methods,
} from "../../../packages/contracts/mobile";
import { methodLabels, goalLabels } from "../../../src/domain/product/settings";
import { Button, Card, Choice, Label } from "./ui";
import { useApp } from "./context";
export type Preferences = z.infer<typeof settingsSchema>;
export const defaults: Preferences = {
  nativeLanguage: "en",
  interfaceLanguage: "en",
  goals: [{ key: "daily_communication", priority: 3 }],
  methods: Object.fromEntries(
    methods.map((m) => [m, 0]),
  ) as Preferences["methods"],
  correction: "after_turn",
  pace: "balanced",
};
export function PreferencesForm({
  initial = defaults,
  onSave,
  busy,
  onboarding = false,
}: {
  initial?: Preferences;
  onSave: (
    p: Preferences,
    experience: "none" | "some_school" | "regular_use",
  ) => void;
  busy: boolean;
  onboarding?: boolean;
}) {
  const app = useApp();
  const [value, setValue] = useState(initial),
    [experience, setExperience] = useState<
      "none" | "some_school" | "regular_use"
    >("none");
  return (
    <>
      <Choice
        label="Interface language"
        value={value.interfaceLanguage}
        options={languageKeys}
        onChange={(v) => {
          setValue({
            ...value,
            interfaceLanguage: v as Preferences["interfaceLanguage"],
          });
          app.setLanguage(v as Preferences["interfaceLanguage"]);
        }}
      />
      <Choice
        label="Support language"
        value={value.nativeLanguage}
        options={languageKeys}
        onChange={(v) =>
          setValue({
            ...value,
            nativeLanguage: v as Preferences["nativeLanguage"],
          })
        }
      />
      {onboarding && (
        <Choice
          label="Experience"
          value={experience}
          options={["none", "some_school", "regular_use"]}
          onChange={(v) => setExperience(v as typeof experience)}
        />
      )}
      <Card>
        <Label>{app.text("Learning goals")}</Label>
        {goalKeys.map((key) => {
          const selected = value.goals.find((g) => g.key === key);
          return (
            <Button
              key={key}
              title={`${app.text(goalLabels[key])}${selected ? ` ✓ (${selected.priority})` : ""}`}
              onPress={() =>
                setValue({
                  ...value,
                  goals: selected
                    ? value.goals.length === 1
                      ? value.goals
                      : value.goals.filter((g) => g.key !== key)
                    : [...value.goals, { key, priority: 3 }],
                })
              }
            />
          );
        })}
      </Card>
      <Card>
        <Label>{app.text("Learning preferences")}</Label>
        <Label>{app.text("preferenceHelp")}</Label>
        {methods.map((method) => (
          <Button
            key={method}
            title={`${app.text(methodLabels[method])}: ${value.methods[method]}`}
            onPress={() =>
              setValue({
                ...value,
                methods: {
                  ...value.methods,
                  [method]:
                    value.methods[method] === 2
                      ? -2
                      : value.methods[method] + 1,
                },
              })
            }
          />
        ))}
      </Card>
      <Choice
        label="Correction style"
        value={value.correction}
        options={
          onboarding
            ? ["immediate", "gentle", "after_turn"]
            : ["immediate", "gentle", "after_turn", "minimal"]
        }
        onChange={(v) =>
          setValue({ ...value, correction: v as Preferences["correction"] })
        }
      />
      <Choice
        label="Pace"
        value={value.pace}
        options={["gentle", "balanced", "brisk"]}
        onChange={(v) => setValue({ ...value, pace: v as Preferences["pace"] })}
      />
      <Button
        title="Save"
        disabled={busy}
        onPress={() => onSave(settingsSchema.parse(value), experience)}
      />
    </>
  );
}
