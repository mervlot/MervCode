package main

import (
	"bytes"
	"os/exec"
	"strings"
)

type AdbDevice struct {
	Serial       string `json:"serial"`
	State        string `json:"state"`
	Model        string `json:"model"`
	Manufacturer string `json:"manufacturer"`
	Brand        string `json:"brand"`
	Product      string `json:"product"`
	Device       string `json:"device"`
	Android      string `json:"android"`
	SDK          string `json:"sdk"`
	TransportID  string `json:"transportId"`
}

func adbProp(serial, prop string) string {
	cmd := exec.Command("adb", "-s", serial, "shell", "getprop", prop)

	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return ""
	}

	return strings.TrimSpace(out.String())
}

func (a *App) AdbDevices() ([]AdbDevice, error) {
	cmd := exec.Command("adb", "devices", "-l")

	var out bytes.Buffer
	cmd.Stdout = &out

	if err := cmd.Run(); err != nil {
		return nil, err
	}

	lines := strings.Split(out.String(), "\n")
	devices := []AdbDevice{}

	for _, line := range lines[1:] {
		line = strings.TrimSpace(line)

		if line == "" || strings.HasPrefix(line, "*") {
			continue
		}

		fields := strings.Fields(line)

		if len(fields) < 2 {
			continue
		}

		serial := fields[0]
		state := fields[1]

		transportID := ""

		for _, f := range fields[2:] {
			if strings.HasPrefix(f, "transport_id:") {
				transportID = strings.TrimPrefix(f, "transport_id:")
			}
		}

		devices = append(devices, AdbDevice{
			Serial:       serial,
			State:        state,
			Model:        adbProp(serial, "ro.product.model"),
			Manufacturer: adbProp(serial, "ro.product.manufacturer"),
			Brand:        adbProp(serial, "ro.product.brand"),
			Product:      adbProp(serial, "ro.product.name"),
			Device:       adbProp(serial, "ro.product.device"),
			Android:      adbProp(serial, "ro.build.version.release"),
			SDK:          adbProp(serial, "ro.build.version.sdk"),
			TransportID:  transportID,
		})
	}

	return devices, nil
}
