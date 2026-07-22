import * as monaco from "monaco-editor";

interface CustomActionDefinition {
  id: string;
  label: string;
  keybindings: number[];
  contextMenuGroupId?: string;
  contextMenuOrder?: number;
  run: (editor: monaco.editor.IStandaloneCodeEditor) => void | Promise<void>;
}

// Factory container for all custom Monaco shortcuts
export const getCustomActions = (handlers: {
  onSave: (content: string) => void | Promise<void>;
}): CustomActionDefinition[] => [
  {
    id: "merv-save-file",
    label: "Save File Changes",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    contextMenuGroupId: "navigation",
    contextMenuOrder: 1.0,
    run: async (editor) => {
      const currentContent = editor.getValue();
      await handlers.onSave(currentContent);
      console.log("File saved via custom action intercept.");
    },
  },
  // You can easily drop in extra keys here later (e.g., Run code, Format code...)
];
