import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyDesktopChrome,
  CHROME_END_PAD_ATTR,
  chromeEndPadValue,
  emitDesktopWindowAction,
  installDesktopExternalLinks,
  installDesktopWindowDrag,
  isDesktopShell,
  isOpenableExternalUrl,
  resolveDesktopChromeStyle,
  shouldArmDesktopDrag,
  titleRowEndPadding,
  WINDOW_CONTROLS_INSET,
  WINDOW_CONTROLS_SPACER_ATTR,
  windowControlsEndSpacerPx,
  DESKTOP_DRAG_REGION_CLASS,
  DOCK_WINDOW_CONTROLS_PAD_PX,
} from "./desktopChrome";

const OPEN_URL_PREFIX = "wails:event:emit:desktop:open-url:";
const EXTERNAL_LINKS_FLAG = "__VOYAGESTAR_EXTERNAL_LINKS_INSTALLED__";

function stubWailsBridge(): ReturnType<typeof vi.fn> {
  const invoke = vi.fn();
  Object.defineProperty(window, "_wails", {
    configurable: true,
    value: { invoke },
  });
  return invoke;
}

describe("desktopChrome", () => {
  afterEach(() => {
    applyDesktopChrome(null);
    delete document.documentElement.dataset.voyagestarDragReady;
    delete (window as Record<string, unknown>)[EXTERNAL_LINKS_FLAG];
    vi.unstubAllGlobals();
  });

  it("is inactive when the Wails bridge is missing", () => {
    expect(isDesktopShell({} as Window)).toBe(false);
  });

  it("is active when Wails invoke is present", () => {
    expect(
      isDesktopShell({ _wails: { invoke: () => undefined } } as Window),
    ).toBe(true);
  });

  it("uses traffic-light chrome on macOS user agents", () => {
    expect(
      resolveDesktopChromeStyle(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      ),
    ).toBe("mac");
  });

  it("uses caption-button chrome on Windows and Linux", () => {
    expect(
      resolveDesktopChromeStyle(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      ),
    ).toBe("windows");
    expect(
      resolveDesktopChromeStyle(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      ),
    ).toBe("windows");
  });

  it("reserves a trailing inset for the title row and right-edge overlays", () => {
    expect(WINDOW_CONTROLS_INSET.mac).toBeGreaterThan(0);
    expect(WINDOW_CONTROLS_INSET.windows).toBeGreaterThan(
      WINDOW_CONTROLS_INSET.mac,
    );
    expect(titleRowEndPadding(32)).toContain("--window-controls-inset-end");
    expect(titleRowEndPadding(32)).toContain("32px");
    expect(CHROME_END_PAD_ATTR).toBe("data-voyagestar-chrome-end-pad");
    expect(WINDOW_CONTROLS_SPACER_ATTR).toBe(
      "data-voyagestar-window-controls-spacer",
    );
    expect(chromeEndPadValue(12)).toContain("--window-controls-inset-end");
    expect(chromeEndPadValue(12)).toContain("12px");
    expect(windowControlsEndSpacerPx("mac", true)).toBe(
      WINDOW_CONTROLS_INSET.mac,
    );
    expect(windowControlsEndSpacerPx("windows", true)).toBe(
      WINDOW_CONTROLS_INSET.windows,
    );
    expect(windowControlsEndSpacerPx("mac", true, 12)).toBe(
      WINDOW_CONTROLS_INSET.mac - 12,
    );
    expect(
      windowControlsEndSpacerPx("mac", true, DOCK_WINDOW_CONTROLS_PAD_PX),
    ).toBe(WINDOW_CONTROLS_INSET.mac - DOCK_WINDOW_CONTROLS_PAD_PX);
    expect(windowControlsEndSpacerPx("windows", true, 12)).toBe(
      WINDOW_CONTROLS_INSET.windows - 12,
    );
    expect(windowControlsEndSpacerPx("mac", false)).toBe(0);
    expect(windowControlsEndSpacerPx(null, true)).toBe(0);
  });

  it("pads right-edge overlays away from frameless window controls", () => {
    const css = readFileSync(
      resolve(__dirname, "../styles/layout.css"),
      "utf8",
    );
    expect(css).toContain("[data-voyagestar-chrome-end-pad]");
    expect(css).not.toContain("[data-dock-panel]");
    expect(css).toContain(".voyagestar-drawer-right");
    expect(css).toMatch(/padding-inline-end:\s*max\(/);
  });

  it("exports a stable class for Wails title-bar dragging", () => {
    expect(DESKTOP_DRAG_REGION_CLASS).toBe("voyagestar-desktop-drag");
  });

  it("writes the inset token on <html> and can clear it", () => {
    applyDesktopChrome("mac");
    expect(document.documentElement.dataset.voyagestarDesktopChrome).toBe(
      "mac",
    );
    expect(
      document.documentElement.style.getPropertyValue(
        "--window-controls-inset-end",
      ),
    ).toBe(`${WINDOW_CONTROLS_INSET.mac}px`);

    applyDesktopChrome(null);
    expect(
      document.documentElement.dataset.voyagestarDesktopChrome,
    ).toBeUndefined();
    expect(
      document.documentElement.style.getPropertyValue(
        "--window-controls-inset-end",
      ),
    ).toBe("");
  });

  it("emits Wails window actions through the existing event bridge", () => {
    const invoke = vi.fn();
    const emitted = emitDesktopWindowAction("minimise", {
      _wails: { invoke },
    } as Window);
    expect(emitted).toBe(true);
    expect(invoke).toHaveBeenCalledWith("wails:event:emit:desktop:minimise");
  });

  it("arms drag on --wails-draggable regions and the top chrome strip", () => {
    const region = document.createElement("div");
    region.style.setProperty("--wails-draggable", "drag");
    document.body.appendChild(region);
    const button = document.createElement("button");
    region.appendChild(button);
    const chrome = document.createElement("div");
    document.body.appendChild(chrome);

    expect(shouldArmDesktopDrag(mouseOn(region, 80))).toBe(true);
    expect(shouldArmDesktopDrag(mouseOn(button, 10))).toBe(false);
    expect(shouldArmDesktopDrag(mouseOn(chrome, 10))).toBe(true);
    expect(shouldArmDesktopDrag(mouseOn(chrome, 80))).toBe(false);

    region.remove();
    chrome.remove();
  });

  it("starts a Wails window drag after a move on an armed title-bar target", () => {
    const invoke = vi.fn();
    Object.defineProperty(window, "_wails", {
      configurable: true,
      value: { invoke },
    });
    expect(installDesktopWindowDrag()).toBe(true);
    expect(installDesktopWindowDrag()).toBe(false);

    const region = document.createElement("div");
    region.style.setProperty("--wails-draggable", "drag");
    document.body.appendChild(region);
    region.dispatchEvent(
      new MouseEvent("mousedown", {
        button: 0,
        clientY: 80,
        screenX: 40,
        screenY: 40,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      new MouseEvent("mousemove", {
        button: 0,
        screenX: 52,
        screenY: 48,
        bubbles: true,
      }),
    );
    expect(invoke).toHaveBeenCalledWith("wails:drag");

    region.dispatchEvent(
      new MouseEvent("dblclick", {
        button: 0,
        clientY: 80,
        bubbles: true,
      }),
    );
    expect(invoke).toHaveBeenCalledWith("wails:drag:doubleclick");
    region.remove();
    delete document.documentElement.dataset.voyagestarDragReady;
    delete (window as Window & { _wails?: unknown })._wails;
  });

  it("accepts only http/https/mailto as openable external URLs", () => {
    const base = "http://127.0.0.1:8088/";
    expect(isOpenableExternalUrl("https://example.com", base)).toBe(true);
    expect(isOpenableExternalUrl("http://example.com", base)).toBe(true);
    expect(isOpenableExternalUrl("mailto:a@b.c", base)).toBe(true);
    expect(isOpenableExternalUrl("javascript:alert(1)", base)).toBe(false);
    expect(isOpenableExternalUrl("file:///etc/passwd", base)).toBe(false);
    expect(isOpenableExternalUrl("mailto:", base)).toBe(false);
    expect(isOpenableExternalUrl("", base)).toBe(false);
  });

  it("routes target=_blank clicks to the shell open-url event", () => {
    const invoke = stubWailsBridge();
    expect(installDesktopExternalLinks()).toBe(true);
    expect(installDesktopExternalLinks()).toBe(false);

    const link = document.createElement("a");
    link.href = "https://example.com/docs";
    link.target = "_blank";
    document.body.appendChild(link);
    const ev = new MouseEvent("click", {
      button: 0,
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(ev);

    expect(invoke).toHaveBeenCalledWith(
      OPEN_URL_PREFIX + encodeURIComponent(link.href),
    );
    expect(ev.defaultPrevented).toBe(true);
    link.remove();
  });

  it("ignores same-tab links, downloads, and secondary buttons", () => {
    const invoke = stubWailsBridge();
    installDesktopExternalLinks();

    const sameTab = document.createElement("a");
    sameTab.href = "https://example.com/a";
    document.body.appendChild(sameTab);
    const download = document.createElement("a");
    download.href = "https://example.com/b";
    download.target = "_blank";
    download.setAttribute("download", "");
    document.body.appendChild(download);
    const blank = document.createElement("a");
    blank.href = "https://example.com/c";
    blank.target = "_blank";
    document.body.appendChild(blank);

    sameTab.dispatchEvent(
      new MouseEvent("click", { button: 0, bubbles: true }),
    );
    download.dispatchEvent(
      new MouseEvent("click", { button: 0, bubbles: true }),
    );
    blank.dispatchEvent(new MouseEvent("click", { button: 2, bubbles: true }));
    expect(invoke).not.toHaveBeenCalled();

    sameTab.remove();
    download.remove();
    blank.remove();
  });

  it("dedupes the pointerdown and click pair for one activation", () => {
    const invoke = stubWailsBridge();
    installDesktopExternalLinks();

    const link = document.createElement("a");
    link.href = "https://example.com/dedupe";
    link.target = "_blank";
    document.body.appendChild(link);
    link.dispatchEvent(
      new MouseEvent("pointerdown", { button: 0, bubbles: true }),
    );
    link.dispatchEvent(new MouseEvent("click", { button: 0, bubbles: true }));

    expect(invoke).toHaveBeenCalledTimes(1);
    link.remove();
  });

  it("intercepts window.open(_blank) and passes other targets through", () => {
    const passthrough = vi.fn().mockReturnValue(null);
    vi.stubGlobal("open", passthrough);
    const invoke = stubWailsBridge();
    installDesktopExternalLinks();

    expect(window.open("https://example.com/popup", "_blank")).toBeNull();
    expect(invoke).toHaveBeenCalledWith(
      OPEN_URL_PREFIX + encodeURIComponent("https://example.com/popup"),
    );

    invoke.mockClear();
    window.open("https://example.com/self", "_self");
    expect(invoke).not.toHaveBeenCalled();
    expect(passthrough).toHaveBeenCalledWith(
      "https://example.com/self",
      "_self",
      undefined,
    );
  });
});

function mouseOn(
  target: Element,
  clientY: number,
): Pick<MouseEvent, "button" | "clientY" | "target"> {
  return { button: 0, clientY, target };
}
