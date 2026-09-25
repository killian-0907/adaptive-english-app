import { expect, it } from "vitest";
import { aggregateQuality, qualityEventSchema } from "./quality";
it("rejects content and unbounded telemetry rather than collecting it", () => {
  expect(qualityEventSchema.safeParse({kind:"feedback",value:"too_difficult",transcript:"private"}).success).toBe(false);
  expect(qualityEventSchema.safeParse({kind:"feedback",value:"arbitrary text"}).success).toBe(false);
});
it("uses separate denominators and reports unavailable abandonment honestly", () => {
  const report=aggregateQuality([{kind:"feedback",value:"reject_method"},{kind:"feedback",value:"tired"},{kind:"session_completed"},{kind:"feedback",value:"private text"}]);
  expect(report).toMatchObject({activities:0,completionRate:null,methodRejectionRate:0.5,transferSuccessRate:null,completedSessions:1,sessionAbandonment:null});
  expect(report).not.toHaveProperty("score");
});
