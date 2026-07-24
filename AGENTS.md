# MervCode Project Guidelines

## Architecture

- **Stack**: Wails v2 (Go backend + React/TypeScript frontend) + Monaco Editor
- **Desktop-first**: Native desktop IDE, not a web app
- **Frameless**: Custom title bar and window controls
- **Plugin system**: Languages defined in `toolchain.go` (backend) + `editor/monaco/languages/` (frontend)

## General

- MervCode is a native desktop IDE focused on performance and responsiveness
- Prioritize maintainability over clever implementations
- Avoid introducing new dependencies unless they provide significant value
- Follow existing code style and architecture
- Reuse existing components before creating new ones

## UI/UX Philosophy

### Design Language
- **Modern but nostalgic**: Clean, minimal interface with familiar IDE patterns devs expect
- **Dark theme default**: Pure black background (`#000000`), crimson red accent (`#DC143C`)
- **Custom cursors**: Use provided `.cur` files for different interaction states
- **Monaspace font**: With ligatures enabled for better code readability
- **Consistent spacing**: Use Tailwind's spacing scale (4px base unit)

### Component Patterns
- **Sidebar**: Collapsible, resizable (160-500px), with tab-based panels (explorer, search, git, settings)
- **Editor tabs**: Draggable, context menus, dirty indicators, close buttons
- **Status bar**: Bottom bar showing file type, cursor position, unsaved count
- **Settings panel**: Sectioned with headers, toggles for booleans, sliders for numbers, dropdowns for enums
- **Modals/dialogs**: Centered overlays with dark backdrop, consistent button styles

### Interaction Patterns
- **Keyboard shortcuts**: Follow VSCode conventions (Ctrl+Shift+P, Ctrl+S, Ctrl+W, Ctrl+`, Ctrl+B, Ctrl+Tab)
- **Command palette**: Fuzzy search for commands and files
- **Context menus**: Right-click on tabs, files, editor
- **Drag-and-drop**: Tabs reorderable, sidebar resizable
- **Live feedback**: Status bar updates, dirty indicators, loading states

### Visual Consistency
- **Borders**: Subtle (`rgba(255,255,255,0.08)`), stronger on focus/hover
- **Text hierarchy**: Primary (92% opacity), secondary (60%), tertiary (38%), faint (20%)
- **Accent usage**: Crimson red for primary actions, active states, focus rings
- **Animations**: Minimal, 100-150ms ease transitions, no bouncy effects
- **Icons**: Bootstrap Icons, consistent size (16px default)

## Performance

- Minimize unnecessary React renders
- Avoid unnecessary state
- Memoize only when profiling indicates it is beneficial
- Keep bundle size and startup time low
- Debounce file watcher events (200ms) to prevent UI flooding
- Cache LSP client instances per (language, project root)
- Limit search results (300 max) and file size (4MB max)

## Go Backend

- Prefer the Go standard library
- Return descriptive errors with context
- Avoid blocking the UI thread
- Long-running work should execute asynchronously when appropriate
- Use `runtime.EventsEmit` for backend-to-frontend communication
- Handle graceful shutdown (stop watchers, close LSP clients)

## Frontend

- Prefer TypeScript strict typing
- Avoid `any` (except where Wails bindings require it)
- Keep components focused and composable
- Separate business logic from UI when practical
- Use custom hooks for shared logic (`useTabManager`, `useFileOps`, `useEditorSettings`)
- Persist settings and workspace state to `localStorage`

## Adding New Languages

When implementing support for a new language, you MUST update ALL of these:

### Backend (Go)
1. **`toolchain.go`**: Add entry to `toolchains` map in `init()`:
   ```go
   "python": {
       ID: "python",
       Name: "Python",
       LSP: &LSPConfig{Command: "pylsp", Args: []string{"--stdio"}},
       Formatter: &FormatterConfig{Command: "black", Args: []string{"-"}},
       Markers: []string{"pyproject.toml", "setup.py", "requirements.txt"},
   }
   ```
2. **`lsp_proxy.go`**: 
   - Add case to `lspCommand()` switch
   - Add case to `lspLangForFile()` switch
   - Add case to `projectMarkersForLang()` switch
3. **`types/main.go`**: Add any language-specific types if needed

### Frontend (TypeScript)
1. **`editor/monaco/languages/{lang}.ts`**: Create language module implementing `MonacoLanguage` interface:
   ```typescript
   export const python: MonacoLanguage = {
     id: "python",
     lsp(editor, _model) { return openLSPDocument(editor); },
     async formatter(model) {
       const formatted = await FormatDocument("python", model.uri.fsPath, model.getValue());
       return [{ range: model.getFullModelRange(), text: formatted }];
     },
   };
   ```
2. **`editor/monaco/registry.ts`**: Import and register the language:
   ```typescript
   import { python } from "./languages/python";
   export const registry: Record<string, MonacoLanguage> = {
     go,
     python,
   };
   ```
3. **`editor/detectLang.ts`**: Add file extension mapping:
   ```typescript
   case ".py": return "python";
   ```

### Settings & Configuration
1. **`frontend/src/types.ts`**: Update `EditorSettings` interface if language needs specific settings
2. **`frontend/src/hooks/useEditorSettings.ts`**: Add defaults for new settings
3. **`frontend/src/components/editor/SettingsPanel.tsx`**: Add UI controls for new settings
4. **`frontend/src/index.css`**: Add any language-specific syntax highlighting overrides if needed

### Testing
1. Verify LSP starts and provides completions/hover/definition
2. Verify formatter works on save
3. Verify syntax highlighting is correct
4. Verify file detection works
5. Test with missing tools (should prompt for installation)

## UI/UX Updates

When updating the interface:

### Do
- Maintain the dark theme with crimson accent unless explicitly changing theme
- Keep interactions familiar to VSCode/Sublime/Atom users
- Use existing component patterns (toggles, sliders, dropdowns)
- Preserve keyboard shortcuts unless there's a compelling reason
- Test with both light and dark themes
- Ensure custom cursors still work
- Keep the frameless window aesthetic

### Don't
- Introduce mobile-inspired layouts or touch-first patterns
- Use bright colors outside the accent palette
- Add animations longer than 200ms
- Remove familiar IDE features (minimap, line numbers, word wrap)
- Change the fundamental layout (sidebar left, editor center, status bar bottom)
- Break existing keyboard shortcuts without migration path

## Before Making Changes

When implementing a feature:

1. **Understand the existing implementation**: Read the relevant files, trace the data flow
2. **Explain the proposed approach**: Describe what you'll change and why
3. **Modify the minimum amount of code necessary**: Don't refactor unrelated code
4. **Update all related systems**: If adding a language, update ALL files listed above
5. **Test end-to-end**: Verify the feature works from UI to backend and back

## Things to Avoid

- Large-scale refactors without permission
- Unnecessary abstractions
- Duplicate logic
- Dead code
- Magic numbers
- Unused dependencies
- Breaking the plugin system contract
- Ignoring error handling in async operations
- Forgetting to update `wails generate module` after adding Go methods

## File Structure Reference

```
/
├── main.go                    # Wails app entry point
├── func.go                    # Core file operations, git, search
├── lsp_proxy.go               # LSP client implementation
├── toolchain.go               # Language toolchain registry
├── types/main.go              # Shared Go types
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # React router + providers
│   │   ├── index.css          # Global styles, theme tokens, cursors
│   │   ├── types.ts           # Shared TypeScript types
│   │   ├── pages/Home.tsx     # Main IDE layout
│   │   ├── components/editor/ # UI components (Header, Sidebar, EditorArea, StatusBar, SettingsPanel)
│   │   ├── hooks/             # Custom hooks (useTabManager, useFileOps, useEditorSettings)
│   │   ├── contexts/          # React contexts (ThemeContext)
│   │   ├── editor/
│   │   │   ├── monaco/
│   │   │   │   ├── setup.ts           # Monaco initialization
│   │   │   │   ├── registry.ts        # Language registry
│   │   │   │   ├── types.ts           # MonacoLanguage interface
│   │   │   │   ├── lsp.ts             # LSP integration
│   │   │   │   └── languages/         # Language implementations (go.ts, etc.)
│   │   │   ├── detectLang.ts          # File extension → language mapping
│   │   │   └── keybinding.ts          # Keyboard shortcut definitions
│   │   └── lib/persistence.ts         # localStorage helpers
│   └── index.html
└── types/                     # Shared Go types (imported as merv-code/types)
```

## Configuration Persistence

- **Theme**: `localStorage["mervcode:theme"]` ("dark" | "light")
- **Editor settings**: `localStorage["mervcode:editorSettings"]` (JSON object)
- **Workspace state**: `localStorage["mervcode.workspace-state"]` (tabs, active file, root path)

When adding new settings:
1. Add to `EditorSettings` interface in `frontend/src/types.ts`
2. Add default value in `useEditorSettings.ts`
3. Add UI control in `SettingsPanel.tsx`
4. Apply setting in `EditorArea.tsx` via `editor.updateOptions()`
