// Story wiring tests (vitest + jsdom): the host's run events, prompt prefill and send, the target finders, the live lines. The engine itself is tested by
// the vendored story.test.jsx; this file tests THIS lab's glue.
import { describe, expect, test, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHost, buildSteps, firstSentence } from "./storyWiring.js";
import { STEPS, VIDEO_ONLY, scriptKeys } from "./storyScript.js";
import { parity, parseCaptions } from "../../server/src/story/captions.js";

const disposables = [];
const makeHost = () => {
  const host = createHost({ mode: () => "mock" });
  disposables.push(() => host.dispose());
  return host;
};
afterEach(() => { while (disposables.length) disposables.pop()(); document.body.innerHTML = ""; });

describe("storyWiring host", () => {
  test("waitForRun with a null marker (the first run-done step, before any prompt was presented) still settles", async () => {
    const host = makeHost();
    const p = host.waitForRun(null, 5000);
    window.dispatchEvent(new CustomEvent("ma:run-end", { detail: { ok: true } }));
    await expect(p).resolves.toEqual({ ok: true });
  });

  test("run events: waitForRun settles when ma:run-end lands, and a result already on the page counts", async () => {
    const host = makeHost();
    const m = host.mark();
    const p = host.waitForRun(m, 5000);
    window.dispatchEvent(new CustomEvent("ma:run-end", { detail: { ok: true } }));
    await expect(p).resolves.toEqual({ ok: true });
    const m2 = host.mark();
    window.dispatchEvent(new CustomEvent("ma:run-end", { detail: { ok: true } }));   // a run ended before the wait began
    await expect(host.waitForRun(m2, 5000)).resolves.toEqual({ ok: true });
  });

  test("a failed run resolves {ok:false}", async () => {
    const host = makeHost();
    const m = host.mark();
    const p = host.waitForRun(m, 5000);
    window.dispatchEvent(new CustomEvent("ma:run-end", { detail: { ok: false } }));
    expect((await p).ok).toBe(false);
  });

  test("ma:reset tells a waiting step instead of leaving it hung", async () => {
    const host = makeHost();
    const m = host.mark();
    const p = host.waitForRun(m, 50000);
    window.dispatchEvent(new CustomEvent("ma:reset"));
    const r = await p;
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/reset/i);
  });

  test("runInFlight and onRun report a run while it is in the air", () => {
    const host = makeHost();
    const seen = [];
    const off = host.onRun(() => seen.push(host.runInFlight()));
    window.dispatchEvent(new CustomEvent("ma:run-start"));
    window.dispatchEvent(new CustomEvent("ma:run-end", { detail: { ok: true } }));
    off();
    expect(seen).toEqual([true, false]);
    expect(host.runInFlight()).toBe(false);
  });

  test("prefill fills the composer with the step's question and fires input", () => {
    document.body.innerHTML = '<input data-testid="composer-input" />';
    const host = makeHost();
    const input = document.querySelector('[data-testid="composer-input"]');
    let saw = "";
    input.addEventListener("input", () => { saw = input.value; });
    host.prefill({ prompt: { text: "book me a seat to Denver on the next flight" } });
    expect(input.value).toBe("book me a seat to Denver on the next flight");
    expect(saw).toBe("book me a seat to Denver on the next flight");
  });

  test("send clicks the step's own press button with a script-made event (isTrusted false)", () => {
    document.body.innerHTML = '<button data-testid="wtt-opt-MA2"></button>';
    const host = makeHost();
    const btn = document.querySelector('[data-testid="wtt-opt-MA2"]');
    let untrusted = null;
    btn.addEventListener("click", (e) => { untrusted = e.isTrusted; });
    host.send({ prompt: { press: '[data-testid="wtt-opt-MA2"]' } });
    expect(untrusted).toBe(false);
  });

  test("send on a disabled or missing button throws (Play stops instead of stalling)", () => {
    document.body.innerHTML = '<button data-testid="composer-send" disabled></button>';
    const host = makeHost();
    expect(() => host.send({})).toThrow(/not available/);
    document.body.innerHTML = "";
    expect(() => host.send({ prompt: { press: "#nothing" } })).toThrow(/not available/);
  });
});

describe("storyWiring steps", () => {
  test("buildSteps turns the script into engine steps with live targets", () => {
    document.body.innerHTML = '<span data-testid="evidence-count">MA1 · 4 hops</span><li data-testid="turn"><div data-testid="turn-reply">Booked. Seat 14A.</div></li>';
    const host = makeHost();
    const steps = buildSteps({ captions: { steps: {}, slides: {} }, host });
    const hops = steps.find((s) => s.key === "hops");
    expect(hops.target).toBe('[data-testid="evidence-count"]');   // a plain selector passes straight through to the engine
    expect(hops.lines()).toEqual(["4 hops, all on the record"]);
    const ma1 = steps.find((s) => s.key === "ma1");
    expect(typeof ma1.lines).toBe("undefined");   // ma1 has no live lines of its own: the wording carries the facts
    expect(ma1.prompt.press).toBe('[data-testid="wtt-opt-MA1"]');
  });

  test("a bubble whose target is missing is skipped by the engine (the selector matches nothing)", () => {
    const host = makeHost();
    const steps = buildSteps({ captions: { steps: {}, slides: {} }, host });
    const ma1 = steps.find((s) => s.key === "ma1");
    expect(host.query(ma1.target)).toBeNull();
  });

  test("the script and the lab's captions.md agree (parity, re-checked on the web side)", () => {
    const raw = readFileSync(`${process.cwd().replace(/\/web$/, "")}/video/captions.md`, "utf8");
    const captions = parseCaptions(raw);
    expect(parity(captions, scriptKeys(), { allowUnused: VIDEO_ONLY })).toEqual([]);
  });

  test("firstSentence cuts at the first full stop and never mid-word", () => {
    expect(firstSentence("Booked. Seat 14A. Enjoy")).toBe("Booked.");
    expect(firstSentence("The Denverboundsagent replied")).toBe("The Denverboundsagent replied");
    expect(firstSentence("a very long line that goes on and on and needs to be cut somewhere before the limit is ever hit, truly much longer than one hundred and fifty words could ever be in this tiny bubble, so it must cut")).toMatch(/\.\.\.$/);
  });
});
