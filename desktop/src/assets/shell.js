// Shared helpers for the Voyagestar desktop shell pages (splash + settings).
// Loaded as an ES module from the bundled wails:// origin — /wails/runtime.js
// is available here (unlike the remote dashboard origin).

import { Call, Events } from "/wails/runtime.js";

export const copy = {
  zh: {
    brand: "远航星 Sanctum",
    statusWait: "正在启动，请稍候…",
    stepChecking: "检查环境",
    stepPreparing: "准备运行时",
    stepStarting: "启动服务",
    stepReady: "就绪",
    retry: "重试",
    openDataDir: "打开数据目录",
    quit: "退出",
    settingsTitle: "设置",
    lang: "语言",
    auto: "开机启动",
    tray: "最小化到托盘",
    sleep: "防止休眠",
    port: "端口",
    portInvalid: "端口需为 1–65535 的整数",
    project: "项目地址",
    showMain: "显示 Voyagestar",
    winGroup: "窗口控制",
    winMin: "最小化",
    winMax: "最大化",
    winClose: "关闭",
  },
  en: {
    brand: "Voyagestar Sanctum",
    statusWait: "Starting, please wait…",
    stepChecking: "Checking",
    stepPreparing: "Preparing runtime",
    stepStarting: "Starting service",
    stepReady: "Ready",
    retry: "Retry",
    openDataDir: "Open data folder",
    quit: "Quit",
    settingsTitle: "Settings",
    lang: "Language",
    auto: "Launch at login",
    tray: "Minimize to tray",
    sleep: "Prevent sleep",
    port: "Port",
    portInvalid: "Port must be an integer between 1 and 65535",
    project: "Project URL",
    showMain: "Show Voyagestar",
    winGroup: "Window controls",
    winMin: "Minimize",
    winMax: "Maximize",
    winClose: "Close",
  },
};

export function t(locale, key) {
  const table = copy[locale] || copy.en;
  return table[key] ?? copy.en[key] ?? key;
}

export function call(name, ...args) {
  return Call.ByName("main.App." + name, ...args);
}

export function openExternal(url) {
  emitWindowAction("open-url:" + encodeURIComponent(url));
}

export function emitWindowAction(action) {
  const invoke = window._wails?.invoke;
  if (typeof invoke === "function") {
    invoke(`wails:event:emit:desktop:${action}`);
    return;
  }
  Events.Emit("desktop:" + action);
}

export function detectChrome() {
  return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "mac" : "windows";
}

const CONTROLS_INSET = { mac: 80, windows: 138 };
const SETTINGS_CONTROLS_INSET = 36;

const MAC_LIGHTS = [
  { action: "toggle-maximise", cls: "zoom", glyph: "+", copyKey: "winMax" },
  { action: "minimise", cls: "min", glyph: "–", copyKey: "winMin" },
  { action: "close", cls: "close", glyph: "×", copyKey: "winClose" },
];

const WIN_BUTTONS = [
  {
    action: "minimise",
    copyKey: "winMin",
    svg: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14" /></svg>',
  },
  {
    action: "toggle-maximise",
    copyKey: "winMax",
    svg: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>',
  },
  {
    action: "close",
    copyKey: "winClose",
    svg: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>',
  },
];

let controlsGroup = null;

export function applyControlsCopy(locale) {
  if (!controlsGroup) return;
  controlsGroup.setAttribute("aria-label", t(locale, "winGroup"));
  for (const btn of controlsGroup.querySelectorAll("[data-action]")) {
    const def = [...MAC_LIGHTS, ...WIN_BUTTONS].find(
      (d) => d.action === btn.dataset.action,
    );
    if (def) btn.setAttribute("aria-label", t(locale, def.copyKey));
  }
}

// installWindowControls renders the frameless caption buttons. The settings
// window is a fixed-size dialog, so it only gets the close button.
export function installWindowControls({ settings = false, onClose } = {}) {
  const chrome = detectChrome();
  document.documentElement.dataset.chrome = chrome;
  document.documentElement.style.setProperty(
    "--window-controls-inset-end",
    `${settings ? SETTINGS_CONTROLS_INSET : CONTROLS_INSET[chrome]}px`,
  );

  const group = document.createElement("div");
  group.className = `window-controls ${chrome === "mac" ? "ctrl-mac" : "ctrl-win"}`;
  group.setAttribute("data-voyagestar-no-drag", "true");

  if (chrome === "mac") {
    for (const def of MAC_LIGHTS) {
      if (settings && def.action !== "close") continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `light ${def.cls}`;
      btn.dataset.action = def.action;
      btn.innerHTML = `<span class="glyph" aria-hidden>${def.glyph}</span>`;
      group.appendChild(btn);
    }
  } else {
    for (const def of WIN_BUTTONS) {
      if (settings && def.action !== "close") continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `win-btn${def.action === "close" ? " win-close" : ""}`;
      btn.dataset.action = def.action;
      btn.innerHTML = def.svg;
      group.appendChild(btn);
    }
  }

  group.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "close" && onClose) {
      onClose();
      return;
    }
    emitWindowAction(action);
  });

  document.body.appendChild(group);
  controlsGroup = group;
  return group;
}
