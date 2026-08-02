# Workspace & Settings Persistence

MervCode persists everything about "what you had open" and "how the editor
is configured" in the **webview's `localStorage`**, keyed by plain string
constants. There is no Go/SQLite/file-based store for this - it all lives in
the frontend, scoped to the Wails webview instance for this installation of
the app (on Windows, WebView2's per-user-data-folder profile).

## Storage keys

| Key                          | Written by                                   | Contents |
|-------------------------------|-----------------------------------------------|----------|
| `mervcode.workspace-state`    | `frontend/src/lib/persistence.ts`             | `{ activePath, tabs, rootPath }` - the open tabs, which one is active, and the last opened project folder. |
| `mervcode:editorSettings`     | `frontend/src/hooks/useEditorSettings.ts`     | The full `EditorSettings` object (font, tab size, minimap, word wrap, ...) shown in the Settings panel. |
| `mervcode:theme`              | `frontend/src/contexts/ThemeContext.tsx`      | `"dark"` or `"light"`. |

All three are read/written directly via `window.localStorage` - see
`lib/persistence.ts` for the workspace state helpers
(`loadWorkspaceState`/`saveWorkspaceState`), which are just thin
`JSON.parse`/`JSON.stringify` wrappers with try/catch (localStorage can throw
in locked-down webviews, in which case MervCode silently falls back to
in-memory defaults for that session).

## How MervCode knows which project was open last

1. **`ExplorerPanel`** (`components/editor/ExplorerPanel.tsx`) is the source
   of truth for the file tree. On mount it reads `rootPath` out of
   `mervcode.workspace-state` and calls `loadRoot(rootPath)`, which lists the
   directory via the Go `ReadDir` binding, starts the file watcher
   (`StartWatcher`), and reports the resolved root up to `Home` via
   `onRootChange`.
2. Every time `root` changes, `ExplorerPanel` re-persists
   `{ ...state, rootPath: root.path }` back into the same
   `mervcode.workspace-state` blob, so opening a *different* folder updates
   what gets restored next launch.
3. **`Home`** (`pages/Home.tsx`) *also* seeds its own `workspaceRoot` React
   state synchronously from the same persisted `rootPath` the moment the
   component is created (not only once `ExplorerPanel`'s async `ReadDir`
   round-trip finishes). This closes a startup race: restored tabs mount
   their `Editor`/LSP connections on the very same render as the initial
   tab restore, and without this synchronous seed, `rootPath` would briefly
   be `undefined` for those files - long enough for a language server (e.g.
   Kotlin) to be spawned rooted at the wrong directory. `ExplorerPanel`'s own
   `loadRoot` call still runs afterwards and reconfirms/refreshes the same
   value once the real directory listing comes back.
4. Similarly, `activePath` and `tabs` (the full list of open file tabs, with
   their last-saved `content` inlined for text files) are restored
   synchronously from the same blob in `Home`'s mount effect, so all
   previously open tabs reappear immediately without waiting on any Go call.

In short: **`localStorage["mervcode.workspace-state"].rootPath` is the single
value that determines "which project MervCode reopens on launch"**, and it's
kept in sync any time you open a different folder through the Explorer's
"Open Folder" action or the `mervcode:open-folder` window event (Header's
"Open Folder" button / `Ctrl+O`-style flows dispatch this).

## Inspecting or resetting it

Open MervCode's Dev Tools (the LSP Inspector's underlying webview devtools,
or attach an external one) and run in the console:

```js
JSON.parse(localStorage.getItem("mervcode.workspace-state"))
```

To force MervCode to forget the last project/tabs (e.g. after moving/deleting
a folder that no longer exists), clear just that key:

```js
localStorage.removeItem("mervcode.workspace-state")
```

This does not touch editor settings or theme, which are stored under their
own separate keys listed above.

## Why this is `localStorage` and not a Go-side file

Wails' webview keeps `localStorage` scoped per-app already, and using it
avoids adding a second, Go-owned persistence format (with its own migration
concerns) for what is, in practice, pure UI state - which files are open, not
project data. Actual file contents are always read from and written back to
disk directly via the Go `ReadFile`/`WriteFile`/`InspectAndReadFile` bindings
in `func.go`; nothing about a file's real content ever lives in
`localStorage` beyond the short-lived "last known saved snapshot" used to
restore tabs before their real content is (optionally) re-read.
