import type * as monaco from "monaco-editor";
import Editor from "../../pages/Editor";
import ImageViewer from "../../pages/ImageViewer";
import SpreadSheetViewer from "../../pages/SpreadSheetViewer";
import ErrorBoundary from "./ErrorBoundary";
import type { FileTab } from "../../types";

interface FileViewerProps {
  tab: FileTab;
  language: string;
  fontSize: number;
  onCursorChange: (pos: { line: number; column: number }) => void;
  onEditorReady: (path: string, editor: monaco.editor.IStandaloneCodeEditor) => void;
  onChange: (path: string, content: string) => void;
  onSave: (path: string, content: string) => void | Promise<void>;
}

export default function FileViewer({
  tab,
  language,
  fontSize,
  onCursorChange,
  onEditorReady,
  onChange,
  onSave,
}: FileViewerProps) {
  return (
    <ErrorBoundary label={tab.name} resetKey={tab.path}>
      {tab.category === "image" ? (
        <ImageViewer
          path={tab.path}
          name={tab.name}
          content={tab.content ?? ""}
        />
      ) : tab.category === "video" ? (
        <div className='flex h-full items-center justify-center bg-canvas p-4'>
          <video
            src={tab.content}
            controls
            className='max-h-full max-w-full rounded shadow-app'
          />
        </div>
      ) : tab.category === "audio" ? (
        <div className='flex h-full flex-col items-center justify-center bg-canvas p-4 gap-4'>
          <i className='bi bi-music-note-beamed text-4xl text-tertiary' />
          <audio
            src={tab.content}
            controls
            className='w-80'
          />
        </div>
      ) : tab.category === "pdf" ? (
        <iframe
          src={tab.content}
          className='w-full h-full border-0 bg-canvas'
          title={tab.name}
        />
      ) : tab.category === "binary" ? (
        <div className='flex h-full flex-col items-center justify-center bg-canvas gap-2 text-tertiary'>
          <i className='bi bi-file-earmark text-4xl text-tertiary' />
          <p className='text-xs'>
            Binary file can't be displayed.
          </p>
        </div>
      ) : tab.category === "spreadsheet" &&
        (tab.name.endsWith(".csv") || tab.name.endsWith(".tsv")) ? (
        <SpreadSheetViewer
          content={tab.content ?? ""}
          name={tab.name}
        />
      ) : (
        <Editor
          doc={tab.content ?? ""}
          langKey={language}
          path={tab.path}
          fontSize={fontSize}
          onCursorChange={onCursorChange}
          onReady={(editor) => onEditorReady(tab.path, editor)}
          onChange={(content) => onChange(tab.path, content)}
          onSave={async (newContent) => onSave(tab.path, newContent)}
        />
      )}
    </ErrorBoundary>
  );
}
