import type * as monaco from "monaco-editor";
import Editor from "../../pages/Editor";
import ImageViewer from "../../pages/ImageViewer";
import SpreadSheetViewer from "../../pages/SpreadSheetViewer";
import ErrorBoundary from "./ErrorBoundary";
import SettingsPanel from "./SettingsPanel";
import { detectLang } from "../../editor/detectLang";
import type { EditorSettings, FileTab } from "../../types";

interface FileViewerProps {
  tab: FileTab;
  language?: string;
  settings: EditorSettings;
  onSettingsChange: (patch: Partial<EditorSettings>) => void;
  onSettingsReset: () => void;
  onCursorChange: (pos: { line: number; column: number }) => void;
  onEditorReady: (
    path: string,
    editor: monaco.editor.IStandaloneCodeEditor,
  ) => void;
  onChange: (path: string, content: string) => void;
  onSave: (path: string, content: string) => void | Promise<void>;
  rootPath?: string | undefined;
  active?: boolean | undefined;
}

export default function FileViewer({
  tab,
  language,
  settings,
  onSettingsChange,
  onSettingsReset,
  onCursorChange,
  onEditorReady,
  onChange,
  onSave,
  rootPath,
  active,
}: FileViewerProps) {
  // Language identity belongs to the file being rendered, not the currently
  // active tab. EditorArea renders hidden tabs too; using the active tab's
  // language for every FileViewer was causing hidden .jsx/.tsx/.js/.ts models
  // to be re-labeled whenever the user switched tabs, which broke Monaco's
  // grammar, didOpen languageId, formatter routing, and lint marker ownership.
  const fileLanguage = language ?? detectLang(tab.name);

  return (
    <ErrorBoundary label={tab.name} resetKey={tab.path}>
      {tab.category === "settings" ? (
        <SettingsPanel
          settings={settings}
          onSettingsChange={onSettingsChange}
          onSettingsReset={onSettingsReset}
        />
      ) : tab.category === "image" ? (
        <ImageViewer
          path={tab.path}
          name={tab.name}
          content={tab.content ?? ""}
        />
      ) : tab.category === "video" ? (
        <div className="flex h-full items-center justify-center bg-canvas p-4">
          <video
            src={tab.content}
            controls
            className="max-h-full max-w-full rounded shadow-app"
          />
        </div>
      ) : tab.category === "audio" ? (
        <div className="flex h-full flex-col items-center justify-center bg-canvas p-4 gap-4">
          <i className="bi bi-music-note-beamed text-4xl text-tertiary" />
          <audio src={tab.content} controls className="w-80" />
        </div>
      ) : tab.category === "pdf" ? (
        <iframe
          src={tab.content}
          className="w-full h-full border-0 bg-canvas"
          title={tab.name}
        />
      ) : tab.category === "binary" ? (
        <div className="flex h-full flex-col items-center justify-center bg-canvas gap-2 text-tertiary">
          <i className="bi bi-file-earmark text-4xl text-tertiary" />
          <p className="text-xs">Binary file can't be displayed.</p>
        </div>
      ) : tab.category === "spreadsheet" &&
        (tab.name.endsWith(".csv") || tab.name.endsWith(".tsv")) ? (
        <SpreadSheetViewer content={tab.content ?? ""} name={tab.name} />
      ) : (
        <Editor
          doc={tab.content ?? ""}
          langKey={fileLanguage}
          path={tab.path}
          settings={settings}
          onCursorChange={onCursorChange}
          onReady={(editor) => onEditorReady(tab.path, editor)}
          onChange={(content) => onChange(tab.path, content)}
          onSave={async (newContent) => onSave(tab.path, newContent)}
          rootPath={rootPath}
          active={active}
        />
      )}
    </ErrorBoundary>
  );
}