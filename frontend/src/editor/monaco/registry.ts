import type { MonacoLanguage } from "./types";

import { javascript } from "./languages/javascript";
import { typescript } from "./languages/typescript";
import { go } from "./languages/go";

export const registry: Record<string, MonacoLanguage> = {
  javascript,
  typescript,
  go,
};
