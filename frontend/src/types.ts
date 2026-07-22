// src/types.ts

export interface FileTab {
  name: string;
  path: string;
  content?: string;
  imageDataUrl?: string; // Stores the base64 source for images
  category?: string;
}

export interface WorkspaceRoot {
  name: string;
  path: string;
}
