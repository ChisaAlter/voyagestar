//go:build !production || darwin

package main

// Development builds look for Voyagestar-<plat>.zip or Voyagestar-portable-<plat>-*.zip
// beside the executable. macOS production copies the zip into Resources as
// Voyagestar-<plat>.zip.
var embeddedPortable []byte
