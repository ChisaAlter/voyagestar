import { describe, expect, it } from "vitest";
import {
  mergePatchedToolOutput,
  parseVoyagestarToolOutput,
} from "./parseToolOutput";
import {
  clearToolRenderers,
  getToolRendererVersion,
  registerToolRenderer,
  resolveToolRenderer,
} from "./registry";
import type { ToolRenderProps } from "./types";

function Dummy(_: ToolRenderProps) {
  return null;
}

describe("parseVoyagestarToolOutput", () => {
  it("parses voyagestar_ui envelope", () => {
    const raw = JSON.stringify({
      voyagestar_ui: { renderer: "demo_card", version: 1 },
      data: { count: 2 },
      text: "hi",
    });
    const parsed = parseVoyagestarToolOutput(raw);
    expect(parsed.isJson).toBe(true);
    expect(parsed.voyagestarUi).toEqual({ renderer: "demo_card", version: 1 });
    expect(parsed.data).toEqual({ count: 2 });
    expect(parsed.text).toBe("hi");
  });

  it("keeps plain text", () => {
    const parsed = parseVoyagestarToolOutput("hello");
    expect(parsed.isJson).toBe(false);
    expect(parsed.text).toBe("hello");
  });
});

describe("mergePatchedToolOutput", () => {
  it("merges data into existing envelope", () => {
    const prev = JSON.stringify({
      voyagestar_ui: { renderer: "demo_card" },
      data: { count: 1 },
      text: "x",
    });
    const next = mergePatchedToolOutput(prev, { count: 3 });
    expect(JSON.parse(next)).toEqual({
      voyagestar_ui: { renderer: "demo_card" },
      data: { count: 3 },
      text: "x",
    });
  });
});

describe("resolveToolRenderer", () => {
  it("matches by voyagestar_ui.renderer then tool name", () => {
    clearToolRenderers();
    registerToolRenderer({
      id: "demo_card",
      pluginId: "demo-ui-card",
      tools: ["demo_ui_card"],
      component: Dummy,
    });
    const byHint = resolveToolRenderer({
      toolName: "other",
      pluginId: "demo-ui-card",
      parsed: parseVoyagestarToolOutput(
        JSON.stringify({ voyagestar_ui: { renderer: "demo_card" }, data: {} }),
      ),
    });
    expect(byHint?.id).toBe("demo_card");
    const byTool = resolveToolRenderer({
      toolName: "demo_ui_card",
      parsed: parseVoyagestarToolOutput("plain"),
    });
    expect(byTool?.id).toBe("demo_card");
    clearToolRenderers();
  });

  it("bumps version on register so subscribers can refresh", () => {
    clearToolRenderers();
    const before = getToolRendererVersion();
    registerToolRenderer({
      id: "x",
      pluginId: "p",
      component: Dummy,
    });
    expect(getToolRendererVersion()).toBeGreaterThan(before);
    clearToolRenderers();
  });
});
