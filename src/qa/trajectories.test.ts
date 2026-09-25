import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { personas, simulate, trajectoryMetrics } from "./trajectories";

describe("longitudinal adaptive quality", () => {
  for (const persona of personas) it(`${persona.name}: 20-session deterministic production-domain trajectory`, () => {
    for(const seed of [11,29,47]) {
    const run = simulate(persona, seed);
    expect(run.steps).toHaveLength(160);
    expect(run.steps.every(step => step.decision.reasons.length > 0 && step.decision.difficulty >= 0 && step.decision.difficulty <= 5 && step.decision.exposure >= 1 && step.decision.exposure <= 5)).toBe(true);
    expect(run.snapshot.abilities.every(a => a.estimate_level >= 0 && a.estimate_level <= 6)).toBe(true);
    const m=trajectoryMetrics(run);
    expect(m.listeningRate).toBeGreaterThan(0.08);
    expect(m.speakingRate).toBeGreaterThan(0.2);
    expect(m.maxMethodRun).toBeLessThanOrEqual(4);
    expect(m.reviewRate).toBeLessThan(0.5);
    expect(m.maxFocusedRun).toBeLessThanOrEqual(2);
    expect(m.scenarioFamilies).toBeGreaterThanOrEqual(5);
    expect(run.steps.filter(s=>s.decision.purpose==="transfer").length).toBeGreaterThan(0);
    if(persona.name==="zero_beginner") {expect(run.steps[0].decision.exposure).toBeLessThanOrEqual(2);expect(m.maxDifficulty).toBeLessThanOrEqual(3);}
    if(persona.name==="advanced") {expect(m.maxDifficulty).toBeGreaterThanOrEqual(3);expect(m.assessmentCorrections).toBeGreaterThan(0);}
    if(persona.fatigue) for(let i=1;i<run.steps.length;i++) if(run.steps[i].state==="tired") expect(run.steps[i].abilities).toEqual(run.steps[i-1].abilities);
    if(persona.reject) {const rejected=run.steps.findIndex(s=>s.feedback==="reject_method");if(rejected>=0) expect(run.steps.slice(rejected+1).some(s=>s.decision.method===persona.reject)).toBe(false);}
    }
  });
  it("browser-native transcripts never establish acoustic speaking ability",()=>{const run=simulate(personas[9],11,20,true);expect(run.snapshot.abilities.find(a=>a.dimension==="spoken_expression")).toEqual(run.initial.find(a=>a.dimension==="spoken_expression"));expect(run.steps.filter(s=>s.task.modality==="spoken_production").every(s=>s.evidence.voice_uncertainty)).toBe(true);});
  it("reproduces identical trajectories and writes only opt-in local QA reports", () => {
    expect(simulate(personas[0], 11, 2)).toEqual(simulate(personas[0], 11, 2));
    if (process.env.ADAPTIVE_QA_REPORT === "1" && process.env.NODE_ENV !== "production" && !process.env.NETLIFY && !process.env.VERCEL) {
      const runs = personas.flatMap(persona => [11, 29, 47].map(seed => simulate(persona, seed)));
      mkdirSync("tmp/adaptive-qa", { recursive: true });
      writeFileSync("tmp/adaptive-qa/report.json", JSON.stringify({ generatedFrom: "synthetic local trajectories only", metrics: runs.map(trajectoryMetrics), runs }, null, 2));
      writeFileSync("tmp/adaptive-qa/summary.md", "# Synthetic adaptive QA\n\n42 trajectories, 20 sessions × 8 activities each. Not clinical validation or microphone verification.\n\n| Persona | Listening | Speaking | Review | Max method run | Scenario families |\n|---|---:|---:|---:|---:|---:|\n"+runs.filter(r=>r.seed===11).map(r=>{const m=trajectoryMetrics(r);return "| "+[m.persona,m.listeningRate,m.speakingRate,m.reviewRate,m.maxMethodRun,m.scenarioFamilies].join(" | ")+" |";}).join("\n"));
    }
  });
});
