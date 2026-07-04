package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist/*
var assets embed.FS

func main() {
	// Boot the background process bridge for JS/TS language services


	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title: "merv-code",

		Width:  1100,
		Height: 700,

		MinWidth:  800,
		MinHeight: 500,

		DisableResize: false,
		StartHidden:   false,

		Frameless: true,

		AssetServer: &assetserver.Options{
			Assets: assets,
		},

		OnStartup: app.startup,

		Bind: []interface{}{
			app,
		},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}