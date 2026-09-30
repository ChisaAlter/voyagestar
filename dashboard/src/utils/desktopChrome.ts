type DesktopWindow = Window & {
  _wails?: { invoke?: (message: string) => void };
};

export type DesktopChromeStyle = "mac" | "windows";
export type DesktopWindowAction = "minimise" | "toggle-maximise" | "close";

export const WINDOW_CONTROLS_INSET: Record<DesktopChromeStyle, number> = {
  // 3×12px lights + 2×8px gaps + 8px/12px padding, plus a little slack.
  mac: 80,
  // 3 × 46px caption buttons.
  windows: 138,
};

/** Right-edge overlay chrome (dock toolbar, etc.) to keep clear of caption buttons. */
export const CHROME_END_PAD_ATTR = "data-voyagestar-chrome-end-pad";
export const WINDOW_CONTROLS_SPACER_ATTR =
  "data-voyagestar-window-controls-spacer";

/**
 * Dock toolbar already has 12px end padding. Subtract that plus 6px so the
 * ⋮ / close group sits a few pixels closer to the caption buttons than the
 * personalization title row.
 */
export const DOCK_WINDOW_CONTROLS_PAD_PX = 18;

const INSET_VAR = "--window-controls-inset-end";

/** Inline padding so CSS-module `padding` shorthands cannot clobber the inset. */
export function chromeEndPadValue(minPx = 12): string {
  return `max(${minPx}px, var(${INSET_VAR}, 0px))`;
}

/** Pixel width of a flex spacer that clears overlay caption buttons. */
export function windowControlsEndSpacerPx(
  chrome: DesktopChromeStyle | null,
  panelTouchesWindowEnd: boolean,
  existingEndPadPx = 0,
): number {
  if (!chrome || !panelTouchesWindowEnd) return 0;
  return Math.max(0, WINDOW_CONTROLS_INSET[chrome] - existingEndPadPx);
}

/** Marks shell chrome that Wails should treat as a window-drag region. */
export const DESKTOP_DRAG_REGION_CLASS = "voyagestar-desktop-drag";
export const DESKTOP_NO_DRAG_CLASS = "voyagestar-desktop-no-drag";
export const DESKTOP_TITLEBAR_DRAG_HEIGHT = 32;

const NO_DRAG_SELECTOR =
  'button, a, input, textarea, select, [role="button"], [role="menuitem"], [data-voyagestar-no-drag], .voyagestar-desktop-no-drag';

export function isDesktopShell(
  win: Pick<DesktopWindow, "_wails"> = window as DesktopWindow,
): boolean {
  return typeof win._wails?.invoke === "function";
}

export function resolveDesktopChromeStyle(
  userAgent = navigator.userAgent,
): DesktopChromeStyle {
  if (/Mac|iPhone|iPad/.test(userAgent)) return "mac";
  return "windows";
}

export function titleRowEndPadding(outerPadPx: number): string {
  return `max(0px, calc(var(${INSET_VAR}, 0px) - ${outerPadPx}px))`;
}

export function applyDesktopChrome(
  style: DesktopChromeStyle | null,
  root: HTMLElement = document.documentElement,
): void {
  if (!style) {
    delete root.dataset.voyagestarDesktopChrome;
    root.style.removeProperty(INSET_VAR);
    return;
  }
  root.dataset.voyagestarDesktopChrome = style;
  root.style.setProperty(INSET_VAR, `${WINDOW_CONTROLS_INSET[style]}px`);
}

export function emitDesktopWindowAction(
  action: DesktopWindowAction,
  win: Pick<DesktopWindow, "_wails"> = window as DesktopWindow,
): boolean {
  const invoke = win._wails?.invoke;
  if (typeof invoke !== "function") return false;
  invoke(`wails:event:emit:desktop:${action}`);
  return true;
}

function dragEventElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

/** True when a primary click should start a frameless window-drag gesture. */
export function shouldArmDesktopDrag(
  event: Pick<MouseEvent, "button" | "clientY" | "target">,
): boolean {
  if (event.button !== 0) return false;
  const el = dragEventElement(event.target);
  if (!el) return false;
  if (el.closest(NO_DRAG_SELECTOR)) return false;
  const value = window
    .getComputedStyle(el)
    .getPropertyValue("--wails-draggable")
    .trim();
  if (value === "no-drag") return false;
  if (value === "drag") return true;
  return event.clientY <= DESKTOP_TITLEBAR_DRAG_HEIGHT;
}

const OPEN_URL_EVENT_PREFIX = "wails:event:emit:desktop:open-url:";
const EXTERNAL_LINK_DEDUPE_MS = 800;
const EXTERNAL_LINKS_FLAG = "__VOYAGESTAR_EXTERNAL_LINKS_INSTALLED__";

/** http/https/mailto URLs we may hand to the system browser. */
export function isOpenableExternalUrl(raw: string, base: string): boolean {
  if (!String(raw).trim()) return false;
  try {
    const parsed = new URL(String(raw), base);
    const scheme = parsed.protocol.replace(":", "").toLowerCase();
    if (scheme === "mailto") {
      return Boolean(parsed.pathname || parsed.href.slice("mailto:".length));
    }
    return scheme === "http" || scheme === "https";
  } catch {
    return false;
  }
}

function externalLinkFromEvent(event: Event): HTMLAnchorElement | null {
  let node = event.target as Node | null;
  if (node && node.nodeType === 3) node = node.parentNode;
  if (!(node instanceof Element)) return null;
  const link = node.closest("a[href][target]");
  if (!link) return null;
  const anchor = link as HTMLAnchorElement;
  if (String(anchor.getAttribute("target")).toLowerCase() !== "_blank") {
    return null;
  }
  if (anchor.hasAttribute("download")) return null;
  return anchor;
}

/**
 * Route `target="_blank"` activations (clicks and window.open) to the shell's
 * `desktop:open-url:` event so links open in the system browser instead of a
 * webview popup. Installed by the dashboard itself — the shell no longer
 * injects this via ExecJS.
 */
export function installDesktopExternalLinks(
  win: DesktopWindow = window as DesktopWindow,
): boolean {
  const invoke = win._wails?.invoke;
  if (typeof invoke !== "function") return false;
  const flagged = win as DesktopWindow & Record<string, unknown>;
  if (flagged[EXTERNAL_LINKS_FLAG]) return false;
  flagged[EXTERNAL_LINKS_FLAG] = true;

  let lastUrl = "";
  let lastAt = 0;
  const openExternal = (url: string): boolean => {
    if (!isOpenableExternalUrl(url, win.location?.href ?? "")) return false;
    const now = Date.now();
    if (url === lastUrl && now - lastAt < EXTERNAL_LINK_DEDUPE_MS) return true;
    lastUrl = url;
    lastAt = now;
    invoke(OPEN_URL_EVENT_PREFIX + encodeURIComponent(url));
    return true;
  };
  const onActivate = (event: Event) => {
    const mouse = event as MouseEvent;
    if (mouse.button != null && mouse.button !== 0) return;
    const link = externalLinkFromEvent(event);
    if (!link) return;
    if (!openExternal(link.href)) return;
    event.preventDefault();
  };
  win.document.addEventListener("click", onActivate, true);
  win.document.addEventListener("pointerdown", onActivate, true);
  const origOpen = win.open?.bind(win);
  win.open = (url?: string | URL, target?: string, features?: string) => {
    const name = target == null ? "_blank" : String(target);
    if (url && name.toLowerCase() === "_blank" && openExternal(String(url))) {
      return null;
    }
    return origOpen ? origOpen(url, target, features) : null;
  };
  return true;
}

/**
 * Wails only injects `_wails.invoke` into the remote dashboard origin.
 * The official `--wails-draggable` listeners live in `/wails/runtime.js`,
 * which this page never loads, so we start `wails:drag` ourselves.
 */
export function installDesktopWindowDrag(
  win: DesktopWindow = window as DesktopWindow,
): boolean {
  const invoke = win._wails?.invoke;
  if (typeof invoke !== "function") return false;
  const root = document.documentElement;
  if (root.dataset.voyagestarDragReady === "1") return false;
  root.dataset.voyagestarDragReady = "1";

  let armed = false;
  let startX = 0;
  let startY = 0;
  win.addEventListener(
    "mousedown",
    (event) => {
      if (!shouldArmDesktopDrag(event)) return;
      armed = true;
      startX = event.screenX;
      startY = event.screenY;
    },
    true,
  );
  win.addEventListener(
    "mousemove",
    (event) => {
      if (!armed) return;
      if (
        Math.abs(event.screenX - startX) < 3 &&
        Math.abs(event.screenY - startY) < 3
      ) {
        return;
      }
      armed = false;
      invoke("wails:drag");
    },
    true,
  );
  win.addEventListener(
    "mouseup",
    () => {
      armed = false;
    },
    true,
  );
  win.addEventListener(
    "dblclick",
    (event) => {
      if (!shouldArmDesktopDrag(event)) return;
      invoke("wails:drag:doubleclick");
    },
    true,
  );
  return true;
}
