import type * as monaco from "monaco-editor";

export interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileItem[];
}

export interface FileTab {
  name: string;
  path: string;
  content?: string;
  category?: string;
  isDir: boolean;
}

export interface WorkspaceRoot {
  name: string;
  path: string;
}

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: "on" | "off" | "wordWrapColumn" | "bounded";
  minimap: boolean;
  fontLigatures: boolean;
  lineNumbers: "on" | "off" | "relative" | "interval";
  autoSave: boolean;
  formatOnSave: boolean;
  formatOnPaste: boolean;
  formatOnType: boolean;
}
