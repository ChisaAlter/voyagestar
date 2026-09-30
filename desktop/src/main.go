package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed assets/*
var assets embed.FS

type bootPhase string

const (
	phaseChecking  bootPhase = "checking"
	phasePreparing bootPhase = "preparing"
	phaseStarting  bootPhase = "starting"
	phaseReady     bootPhase = "ready"
	phaseError     bootPhase = "error"
)

// App is the Wails service bound to the shell UI.
type App struct {
	app            *application.App
	window         *application.WebviewWindow
	settingsWindow *application.WebviewWindow
	tray           *trayUI
	store          *settingsStore
	sleep          *sleepGuard
	cmd            *exec.Cmd
	mu             sync.Mutex
	quitting       bool
	booting        bool
	phase          bootPhase
	bootMessage    string

	windowReady     chan struct{}
	windowReadyOnce sync.Once
}

func (a *App) ServiceName() string { return "desktop" }

func (a *App) ServiceStartup(context.Context, application.ServiceOptions) error { return nil }

func (a *App) ServiceShutdown() error {
	a.sleep.stop()
	a.mu.Lock()
	cmd := a.cmd
	a.cmd = nil
	a.mu.Unlock()
	stopVoyagestar(cmd)
	return nil
}

func (a *App) GetSettings() Settings {
	return a.store.get()
}

func (a *App) GetSettingsStatus() (Settings, error) {
	s := a.store.get()
	if a.app == nil {
		return s, nil
	}
	status, err := a.app.Autostart.Status()
	if err != nil {
		return s, fmt.Errorf("read autostart status: %w", err)
	}
	if s.Autostart != status.Enabled {
		s.Autostart = status.Enabled
		if err := a.store.save(s); err != nil {
			return s, err
		}
	}
	return s, nil
}

func (a *App) SaveSettings(next Settings) (Settings, error) {
	cur, err := a.GetSettingsStatus()
	if err != nil {
		return cur, err
	}
	autostart, err := a.setAutostart(next.Autostart)
	if err != nil {
		return cur, err
	}
	if err := a.sleep.set(next.PreventSleep); err != nil {
		if _, rollbackErr := a.setAutostart(cur.Autostart); rollbackErr != nil {
			log.Printf("rollback autostart after sleep prevention failure: %v", rollbackErr)
		}
		return cur, err
	}
	next.Autostart = autostart
	if err := a.store.save(next); err != nil {
		return cur, err
	}
	saved := a.store.get()
	a.applyDashboardPrefs(saved)
	a.applyShellLocale()
	return saved, nil
}

func (a *App) ShowMain() {
	a.showWindow()
}

func (a *App) HideSettings() {
	if a.settingsWindow == nil {
		return
	}
	a.settingsWindow.Hide()
}

func (a *App) Quit() {
	a.requestQuit()
}

// Restart re-runs the boot sequence — wired to the splash error card.
func (a *App) Restart() {
	a.mu.Lock()
	if a.booting {
		a.mu.Unlock()
		return
	}
	a.booting = true
	a.mu.Unlock()
	go func() {
		defer func() {
			a.mu.Lock()
			a.booting = false
			a.mu.Unlock()
		}()
		a.boot()
	}()
}

// OpenDataDir reveals ~/.voyagestar in the OS file manager.
func (a *App) OpenDataDir() error {
	if a.app == nil {
		return fmt.Errorf("application is not ready")
	}
	return a.app.Env.OpenFileManager(voyagestarHome(), false)
}

func (a *App) setAutostart(on bool) (bool, error) {
	if a.app == nil {
		return false, fmt.Errorf("autostart is unavailable before the application starts")
	}
	if on {
		if err := a.app.Autostart.Enable(); err != nil {
			return false, fmt.Errorf("enable autostart: %w", err)
		}
	} else if err := a.app.Autostart.Disable(); err != nil {
		return false, fmt.Errorf("disable autostart: %w", err)
	}
	status, err := a.app.Autostart.Status()
	if err != nil {
		return false, fmt.Errorf("read autostart status: %w", err)
	}
	if status.Enabled != on {
		return status.Enabled, fmt.Errorf("autostart state did not update")
	}
	return status.Enabled, nil
}

func (a *App) applyDashboardPrefs(s Settings) {
	if a.window == nil {
		return
	}
	js := fmt.Sprintf(
		`(function(){try{localStorage.setItem('voyagestar:ui-locale',%s);}catch(e){}})();`,
		jsonString(string(s.Locale)),
	)
	a.window.ExecJS(js)
}

func jsonString(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

// emitBoot reports the boot phase + localized status to the splash page and
// the tray status item.
func (a *App) emitBoot(phase bootPhase, msg string) {
	a.mu.Lock()
	a.phase = phase
	a.bootMessage = msg
	a.mu.Unlock()
	a.refreshTrayStatus()
	if a.app == nil {
		return
	}
	a.app.Event.Emit("desktop:boot", map[string]string{
		"phase":   string(phase),
		"message": msg,
	})
}

func (a *App) currentPhase() bootPhase {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.phase
}

// GetBootState lets the splash page pull the current boot state — events
// emitted before its Events.On registration would otherwise be lost.
func (a *App) GetBootState() map[string]string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return map[string]string{
		"phase":   string(a.phase),
		"message": a.bootMessage,
	}
}

func (a *App) boot() {
	s := a.store.get()
	locale := s.Locale
	if url := os.Getenv("VOYAGESTAR_DESKTOP_URL"); url != "" {
		a.emitBoot(phaseStarting, desktopText(locale, copyStatusConnecting))
		if err := waitHealth(locale, url, 60*time.Second); err != nil {
			a.emitBoot(phaseError, err.Error())
			return
		}
		a.emitBoot(phaseReady, desktopText(locale, copyStatusReady))
		a.showDashboard(url)
		return
	}
	a.emitBoot(phaseChecking, desktopText(locale, copyStatusCheckingRuntime))
	if err := ensurePortable(locale, func(msg string) {
		a.emitBoot(phasePreparing, msg)
	}); err != nil {
		a.emitBoot(phaseError, err.Error())
		return
	}
	root := portableDir()
	a.mu.Lock()
	stopVoyagestar(a.cmd)
	cmd, err := startVoyagestar(root, s.Port)
	a.cmd = cmd
	a.mu.Unlock()
	if err != nil {
		a.emitBoot(phaseError, err.Error())
		return
	}
	base := dashboardURL(s.Port)
	a.emitBoot(phaseStarting, desktopText(locale, copyStatusStartingService))
	if err := waitHealth(locale, base, 2*time.Minute); err != nil {
		a.emitBoot(phaseError, err.Error())
		return
	}
	a.emitBoot(phaseReady, desktopText(locale, copyStatusReady))
	a.showDashboard(base)
}

// markWindowReady records that the shell webview finished its first
// navigation. SetURL during WebView2 embed init panics on a nil controller,
// so steering to the dashboard must wait for this signal.
func (a *App) markWindowReady() {
	a.windowReadyOnce.Do(func() {
		if a.windowReady != nil {
			close(a.windowReady)
		}
	})
}

func (a *App) isWindowReady() bool {
	if a.windowReady == nil {
		return true
	}
	select {
	case <-a.windowReady:
		return true
	default:
		return false
	}
}

func (a *App) showDashboard(base string) {
	if a.window == nil {
		return
	}
	go func() {
		if a.windowReady != nil {
			select {
			case <-a.windowReady:
			case <-time.After(10 * time.Second):
			}
		}
		a.window.SetURL(base)
	}()
	s := a.store.get()
	go func() {
		time.Sleep(800 * time.Millisecond)
		a.applyDashboardPrefs(s)
	}()
}

func (a *App) hideToTray() {
	if a.window == nil {
		return
	}
	a.window.Hide()
}

func (a *App) showWindow() {
	if a.window == nil {
		return
	}
	if a.window.IsMinimised() {
		a.window.UnMinimise()
	}
	a.window.Show()
	a.window.Focus()
}

func (a *App) showSettings() {
	if a.settingsWindow == nil {
		return
	}
	if a.settingsWindow.IsMinimised() {
		a.settingsWindow.UnMinimise()
	}
	a.settingsWindow.Show()
	a.settingsWindow.Center()
	a.settingsWindow.Focus()
}

func (a *App) toggleMainWindow() {
	if a.window == nil {
		return
	}
	if a.window.IsVisible() && !a.window.IsMinimised() {
		a.hideToTray()
		return
	}
	a.showWindow()
}

func (a *App) requestQuit() {
	a.mu.Lock()
	a.quitting = true
	a.mu.Unlock()
	if a.app != nil {
		a.app.Quit()
	}
}

// applyShellLocale re-applies window titles and tray copy after a locale change.
func (a *App) applyShellLocale() {
	locale := a.store.get().Locale
	if a.window != nil {
		a.window.SetTitle(desktopText(locale, copyAppName))
	}
	if a.settingsWindow != nil {
		a.settingsWindow.SetTitle(desktopText(locale, copySettingsTitle))
	}
	a.refreshTrayCopy()
}

func shellBackground(dark bool) application.RGBA {
	if dark {
		return application.NewRGB(14, 14, 14)
	}
	return application.NewRGB(245, 246, 248)
}

func settingsBackground(dark bool) application.RGBA {
	if dark {
		return application.NewRGB(20, 20, 20)
	}
	return application.NewRGB(255, 255, 255)
}

func (a *App) applyTheme(dark bool) {
	if a.window != nil {
		a.window.SetBackgroundColour(shellBackground(dark))
	}
	if a.settingsWindow != nil {
		a.settingsWindow.SetBackgroundColour(settingsBackground(dark))
	}
}

func (a *App) watchTheme() {
	onChange := func(_ *application.ApplicationEvent) {
		if a.app != nil {
			a.applyTheme(a.app.Env.IsDarkMode())
		}
	}
	a.app.Event.OnApplicationEvent(events.Common.ThemeChanged, onChange)
	a.app.Event.OnApplicationEvent(events.Windows.SystemThemeChanged, onChange)
	a.app.Event.OnApplicationEvent(events.Mac.ApplicationDidChangeTheme, onChange)
	a.app.Event.OnApplicationEvent(events.Linux.SystemThemeChanged, onChange)
}

// createWindows builds both webview windows once the app is running so the
// frameless background can match the live system theme (Env.IsDarkMode needs
// the platform impl, which only exists after Run()).
func (a *App) createWindows() {
	locale := a.store.get().Locale
	dark := a.app.Env.IsDarkMode()

	win := a.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:                desktopText(locale, copyAppName),
		Width:                1200,
		Height:               800,
		URL:                  "/",
		Frameless:            true,
		AllowSimpleEventEmit: true,
		BackgroundColour:     shellBackground(dark),
	})
	a.window = win
	a.app.Event.On("desktop:toggle-maximise", func(_ *application.CustomEvent) {
		win.ToggleMaximise()
	})
	a.app.Event.On("desktop:minimise", func(_ *application.CustomEvent) {
		win.Minimise()
	})
	a.app.Event.On("desktop:close", func(_ *application.CustomEvent) {
		a.hideToTray()
	})
	markReady := func(_ *application.WindowEvent) {
		a.markWindowReady()
	}
	win.OnWindowEvent(events.Mac.WebViewDidFinishNavigation, markReady)
	win.OnWindowEvent(events.Windows.WebViewNavigationCompleted, markReady)
	win.OnWindowEvent(events.Linux.WindowLoadFinished, markReady)

	settingsWin := a.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            desktopText(locale, copySettingsTitle),
		Width:            settingsWindowWidth,
		Height:           settingsWindowOuterHeight(),
		URL:              "/settings.html",
		Hidden:           true,
		Frameless:        true,
		DisableResize:    true,
		BackgroundColour: settingsBackground(dark),
		Windows: application.WindowsWindow{
			HiddenOnTaskbar: true,
		},
	})
	a.settingsWindow = settingsWin
	a.app.Event.RegisterApplicationEventHook(events.Mac.ApplicationShouldHandleReopen, func(event *application.ApplicationEvent) {
		event.Cancel()
		restoreMainAfterDockClick(a.window, a.settingsWindow)
	})

	win.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		a.mu.Lock()
		quit := a.quitting
		a.mu.Unlock()
		if quit {
			return
		}
		e.Cancel()
		a.hideToTray()
	})
	win.OnWindowEvent(events.Common.WindowMinimise, func(_ *application.WindowEvent) {
		if a.store.get().MinimizeToTray {
			a.hideToTray()
		}
	})
	settingsWin.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		e.Cancel()
		settingsWin.Hide()
	})
}

func main() {
	store := &settingsStore{cur: loadSettings()}
	api := &App{
		store:       store,
		sleep:       &sleepGuard{},
		windowReady: make(chan struct{}),
		phase:       phaseChecking,
	}

	app := application.New(application.Options{
		Name:        "Voyagestar Sanctum",
		Description: "Voyagestar Sanctum desktop",
		Services: []application.Service{
			application.NewService(api),
		},
		Assets: application.AssetOptions{
			Handler: application.BundledAssetFileServer(assets),
		},
		Windows: application.WindowsOptions{
			DisableQuitOnLastWindowClosed: true,
		},
		Linux: application.LinuxOptions{
			DisableQuitOnLastWindowClosed: true,
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
	})
	api.app = app
	attachOpenURLEventListener(app, api.OpenExternal)

	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(_ *application.ApplicationEvent) {
		applyAppIcon(app)
		api.createWindows()
		api.installTray()
		api.watchTheme()
		if _, err := api.setAutostart(store.get().Autostart); err != nil {
			log.Printf("sync autostart: %v", err)
		}
		if err := api.sleep.set(store.get().PreventSleep); err != nil {
			log.Printf("enable sleep prevention: %v", err)
		}
		api.Restart()
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
