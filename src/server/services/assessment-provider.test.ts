import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { OpenAIAssessmentProvider } from "./assessment-provider";
import { getItem } from "@/domain/assessment/items";
import { ProxyAgent } from "undici";
beforeEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it("fails honestly when no API credential is configured",async()=>{vi.stubEnv("OPENAI_API_KEY","");await expect(new OpenAIAssessmentProvider().speak("Hello")).rejects.toThrow("temporarily unavailable");});
it("sends real speech requests server side and returns audio",async()=>{vi.stubEnv("OPENAI_API_KEY","test-only");const fetcher=vi.fn().mockResolvedValue(new Response(new Uint8Array([1,2])));vi.stubGlobal("fetch",fetcher);expect((await new OpenAIAssessmentProvider().speak("Hello")).byteLength).toBe(2);expect(fetcher.mock.calls[0][0]).toBe("https://api.openai.com/v1/audio/speech");});
it("does not accept malformed evaluator output",async()=>{vi.stubEnv("OPENAI_API_KEY","test-only");vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({output:[{content:[{type:"output_text",text:'{"communicative_success":99}'}]}]})));await expect(new OpenAIAssessmentProvider().evaluate(getItem("written-2"),"Hi")).rejects.toThrow();});
it("does not expose provider error bodies",async()=>{vi.stubEnv("OPENAI_API_KEY","test-only");vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("sensitive upstream body",{status:401})));await expect(new OpenAIAssessmentProvider().speak("Hi")).rejects.toThrow("could not complete");});
it("uploads real multipart audio and validates verbose transcription",async()=>{vi.stubEnv("OPENAI_API_KEY","test-only");const fetcher=vi.fn().mockResolvedValue(Response.json({text:"Hello",duration:1,segments:[{start:0,end:1,text:"Hello",avg_logprob:-0.2,no_speech_prob:0.1}]}));vi.stubGlobal("fetch",fetcher);const result=await new OpenAIAssessmentProvider().transcribe(new File([new Uint8Array(200)],"response.webm",{type:"audio/webm"}));expect(result.text).toBe("Hello");expect(fetcher.mock.calls[0][0]).toBe("https://api.openai.com/v1/audio/transcriptions");const body=fetcher.mock.calls[0][1].body as FormData;expect(body.get("model")).toBe("whisper-1");expect(body.get("response_format")).toBe("verbose_json");expect(body.get("file")).toBeInstanceOf(File);});
it("uses a scoped proxy only when explicitly configured",async()=>{
  vi.stubEnv("OPENAI_API_KEY","test-only");vi.stubEnv("OPENAI_HTTPS_PROXY","http://127.0.0.1:7897");
  const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(new Response(new Uint8Array([1]))));vi.stubGlobal("fetch",fetcher);
  const provider=new OpenAIAssessmentProvider();await provider.speak("Hello");await provider.speak("Hello again");
  expect(fetcher.mock.calls[0][1].dispatcher).toBeInstanceOf(ProxyAgent);
  expect(fetcher.mock.calls[1][1].dispatcher).toBe(fetcher.mock.calls[0][1].dispatcher);
  vi.stubEnv("OPENAI_HTTPS_PROXY","");await provider.speak("Direct");expect(fetcher.mock.calls[2][1].dispatcher).toBeUndefined();
});
it("sanitizes connection failures instead of exposing transport details",async()=>{
  vi.stubEnv("OPENAI_API_KEY","test-only");vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("sensitive proxy or credential detail")));
  await expect(new OpenAIAssessmentProvider().speak("Hello")).rejects.toThrow("could not be reached");
});
