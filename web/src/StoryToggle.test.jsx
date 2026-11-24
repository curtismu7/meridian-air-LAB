// The Demo | Story toggle in the top bar: Demo is the default, the page is unchanged with Story off, Story lazy-loads and shows the bar,
// and Exit goes back to Demo.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { forgetWorkspace } from "./workspace";
import { mockApi } from "./testFixtures";

beforeEach(() => { window.location.hash = ""; window.sessionStorage.clear(); window.localStorage.clear(); forgetWorkspace(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const boot = async () => {
  vi.stubGlobal("fetch", mockApi());
  const u = userEvent.setup();
  render(<App />);
  await u.click(screen.getByTestId("nav-agent"));
  await screen.findByTestId("uc-MA1");
  return u;
};

test("Demo is the default: the page shows no Story bar and no toggle pressed", async () => {
  await boot();
  expect(screen.queryByTestId("story-bar")).toBeNull();
  expect(screen.getByTestId("story-toggle-demo").getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByTestId("story-toggle-story").getAttribute("aria-pressed")).toBe("false");
});

test("turning Story on shows the Story bar; Exit goes back to Demo and remembers it", async () => {
  const u = await boot();
  await u.click(screen.getByTestId("story-toggle-story"));
  await waitFor(() => expect(screen.getByTestId("story-toggle-story").getAttribute("aria-pressed")).toBe("true"));
  await screen.findByTestId("story-bar");
  await screen.findByTestId("story-msg");
  await u.click(screen.getByTestId("story-exit"));
  await waitFor(() => expect(screen.queryByTestId("story-bar")).toBeNull());
  expect(screen.getByTestId("story-toggle-demo").getAttribute("aria-pressed")).toBe("true");
  expect(window.localStorage.getItem("ma.story.view")).toBe("demo");
});

test("the choice persists: a reload with Story remembered shows the bar again, and ?story=1 turns it on", async () => {
  await boot();
  fireEvent.click(screen.getByTestId("story-toggle-story"));
  await screen.findByTestId("story-bar");
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", mockApi());
  render(<App />);
  await screen.findByTestId("story-bar");
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/?story=1");
  try {
    vi.stubGlobal("fetch", mockApi());
    render(<App />);
    await screen.findByTestId("story-bar");
  } finally { window.history.replaceState(null, "", "/"); }
});

test("Demo mode is unchanged with Story off: the same header controls render around the toggle", async () => {
  await boot();
  expect(screen.getByTestId("qc-open")).toBeTruthy();
  expect(screen.getByTestId("mode-select")).toBeTruthy();
  expect(screen.queryByTestId("story-simulated")).toBeNull();
});
