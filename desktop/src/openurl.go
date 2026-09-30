package main

import (
	"fmt"
	"log"
	"net/url"
	"reflect"
	"strings"
	"sync"
	"unsafe"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const openURLEventPrefix = "desktop:open-url:"

func (a *App) OpenExternal(raw string) error {
	sanitized, err := validateOpenURL(raw)
	if err != nil {
		return err
	}
	if a.app == nil {
		return fmt.Errorf("application is not ready")
	}
	return a.app.Browser.OpenURL(sanitized)
}

type openURLEventListener struct {
	open func(string) error
}

func (l *openURLEventListener) DispatchWailsEvent(event *application.CustomEvent) {
	if event == nil || l.open == nil {
		return
	}
	raw, ok := parseOpenURLEvent(event.Name)
	if !ok {
		return
	}
	if err := l.open(raw); err != nil {
		log.Printf("open external url: %v", err)
	}
}

func parseOpenURLEvent(name string) (string, bool) {
	if !strings.HasPrefix(name, openURLEventPrefix) {
		return "", false
	}
	raw, err := url.QueryUnescape(strings.TrimPrefix(name, openURLEventPrefix))
	if err != nil {
		return "", false
	}
	if _, err := validateOpenURL(raw); err != nil {
		return "", false
	}
	return raw, true
}

func attachOpenURLEventListener(app *application.App, open func(string) error) {
	if app == nil || open == nil {
		return
	}
	root := reflect.ValueOf(app).Elem()
	lockField := root.FieldByName("wailsEventListenerLock")
	listField := root.FieldByName("wailsEventListeners")
	if !lockField.IsValid() || !listField.IsValid() {
		log.Printf("open-url: wails event listener field missing")
		return
	}
	lock := reflect.NewAt(lockField.Type(), unsafe.Pointer(lockField.UnsafeAddr())).Interface().(*sync.Mutex)
	lock.Lock()
	defer lock.Unlock()
	list := reflect.NewAt(listField.Type(), unsafe.Pointer(listField.UnsafeAddr())).Elem()
	var listener application.WailsEventListener = &openURLEventListener{open: open}
	list.Set(reflect.Append(list, reflect.ValueOf(listener)))
}

func validateOpenURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" || strings.ContainsRune(raw, 0) {
		return "", fmt.Errorf("url is not allowed")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("url is not allowed")
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
		if parsed.Host == "" {
			return "", fmt.Errorf("url is not allowed")
		}
	case "mailto":
		if parsed.Opaque == "" && strings.Trim(parsed.Path, "/") == "" {
			return "", fmt.Errorf("url is not allowed")
		}
	default:
		return "", fmt.Errorf("url is not allowed")
	}
	return parsed.String(), nil
}

// Note: the external-link click interception that used to be injected here
// via ExecJS now lives in the dashboard itself (desktopChrome.ts installs it
// when the Wails bridge appears). The shell only keeps the Go-side event
// listener that opens the URL in the system browser.
