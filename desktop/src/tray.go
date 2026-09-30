package main

import (
	"runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// trayUI holds the tray icon plus its menu so labels can be re-localized and
// the status line can track the boot phase.
type trayUI struct {
	tray   *application.SystemTray
	menu   *application.Menu
	status *application.MenuItem
	show   *application.MenuItem
	prefs  *application.MenuItem
	quit   *application.MenuItem
}

// installTray builds the native tray menu. On macOS the menu opens on any
// click via native tracking (no click handler). On Windows/Linux left-click
// toggles the main window and right-click opens the menu.
func (a *App) installTray() {
	locale := a.store.get().Locale

	tray := a.app.SystemTray.New()
	applyTrayIcon(tray)
	tray.SetTooltip(desktopText(locale, copyAppName))

	menu := a.app.NewMenu()
	ui := &trayUI{tray: tray, menu: menu}
	ui.status = menu.Add("").SetEnabled(false)
	menu.AddSeparator()
	ui.show = menu.Add("").OnClick(func(*application.Context) {
		a.showWindow()
	})
	ui.prefs = menu.Add("").OnClick(func(*application.Context) {
		a.showSettings()
	})
	menu.AddSeparator()
	ui.quit = menu.Add("").OnClick(func(*application.Context) {
		a.requestQuit()
	})
	tray.SetMenu(menu)

	if runtime.GOOS != "darwin" {
		tray.OnClick(func() { a.toggleMainWindow() })
		tray.OnRightClick(func() { tray.ShowMenu() })
	}

	a.tray = ui
	a.refreshTrayCopy()
	a.refreshTrayStatus()
}

func (a *App) refreshTrayCopy() {
	if a.tray == nil {
		return
	}
	locale := a.store.get().Locale
	a.tray.tray.SetTooltip(desktopText(locale, copyAppName))
	a.tray.show.SetLabel(desktopText(locale, copyTrayShow))
	a.tray.prefs.SetLabel(desktopText(locale, copyTraySettings))
	a.tray.quit.SetLabel(desktopText(locale, copyTrayQuit))
	a.tray.menu.Update()
}

// refreshTrayStatus mirrors the boot phase into the disabled status line at
// the top of the tray menu.
func (a *App) refreshTrayStatus() {
	if a.tray == nil {
		return
	}
	locale := a.store.get().Locale
	key := copyTrayStatusStarting
	switch a.currentPhase() {
	case phaseReady:
		key = copyTrayStatusRunning
	case phaseError:
		key = copyTrayStatusFailed
	}
	a.tray.status.SetLabel(
		desktopText(locale, copyAppName) + " — " + desktopText(locale, key),
	)
	a.tray.menu.Update()
}
