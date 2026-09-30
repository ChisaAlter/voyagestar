package main

import (
	"os"
	"strings"
	"testing"
)

func readAsset(t *testing.T, name string) string {
	t.Helper()
	data, err := os.ReadFile("assets/" + name)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestSplashHTMLWiresSharedShellAssets(t *testing.T) {
	body := readAsset(t, "index.html")
	for _, needle := range []string{
		`href="/shell.css"`,
		`from "/shell.js"`,
		`voyagestar-desktop-drag`,
		`src="/voyagestar-badge.svg"`,
		`id="brand"`,
		`id="status"`,
		`id="steps"`,
		`data-phase="checking"`,
		`data-phase="preparing"`,
		`data-phase="starting"`,
		`id="error"`,
		`id="retry"`,
		`id="open-data"`,
		`id="quit"`,
		`desktop:boot`,
		`"Restart"`,
		`"OpenDataDir"`,
		`"Quit"`,
	} {
		if !strings.Contains(body, needle) {
			t.Fatalf("splash HTML missing %q", needle)
		}
	}
}

func TestSettingsHTMLIsStandalonePage(t *testing.T) {
	body := readAsset(t, "settings.html")
	for _, needle := range []string{
		`href="/shell.css"`,
		`from "/shell.js"`,
		`id="locale"`,
		`id="autostart"`,
		`id="tray"`,
		`id="sleep"`,
		`id="port"`,
		`id="show-main"`,
		`id="quit"`,
		`"HideSettings"`,
		`"SaveSettings"`,
		`"ShowMain"`,
	} {
		if !strings.Contains(body, needle) {
			t.Fatalf("settings HTML missing %q", needle)
		}
	}
	if strings.Contains(body, `settings=1`) {
		t.Fatal("settings is a standalone page now — drop the ?settings=1 mode flag")
	}
}

func TestShellCSSHasDarkThemeAndShellSurfaces(t *testing.T) {
	css := readAsset(t, "shell.css")
	for _, needle := range []string{
		`prefers-color-scheme: dark`,
		`--brand: #df7e99`,
		`--brand: #ee9fb8`,
		`.loading-card`,
		`.loading-steps`,
		`.error-badge`,
		`.window-controls`,
		`.switch`,
		`--wails-draggable: drag`,
	} {
		if !strings.Contains(css, needle) {
			t.Fatalf("shell.css missing %q", needle)
		}
	}
}

func TestShellJSBuildsPlatformControlsAndCopy(t *testing.T) {
	js := readAsset(t, "shell.js")
	for _, needle := range []string{
		`installWindowControls`,
		`ctrl-mac`,
		`ctrl-win`,
		`win-close`,
		`wails:event:emit:desktop:`,
		`Call.ByName("main.App."`,
		`applyControlsCopy`,
	} {
		if !strings.Contains(js, needle) {
			t.Fatalf("shell.js missing %q", needle)
		}
	}
	for _, key := range []string{
		"brand", "stepChecking", "stepPreparing", "stepStarting",
		"retry", "openDataDir", "quit",
		"settingsTitle", "port", "portInvalid", "showMain",
		"winGroup", "winMin", "winMax", "winClose",
	} {
		if strings.Count(js, key+":") < 2 {
			t.Fatalf("copy key %q must exist in both zh and en tables", key)
		}
	}
}

func TestSettingsWindowSizeFitsContent(t *testing.T) {
	if settingsWindowWidth != 400 {
		t.Fatalf("settings width is %d, expected 400", settingsWindowWidth)
	}
	if settingsWindowHeight >= 520 {
		t.Fatalf("settings height %d leaves empty space under the form", settingsWindowHeight)
	}
	if settingsWindowHeight < 450 {
		t.Fatalf("settings height %d clips the port row and bottom padding", settingsWindowHeight)
	}
	if settingsWindowWindowsExtraHeight < 16 {
		t.Fatal("Windows settings window needs extra height so DWM frame does not eat the bottom gap")
	}
	if settingsWindowOuterHeight() < settingsWindowHeight {
		t.Fatal("outer height must be at least the content height")
	}
}
