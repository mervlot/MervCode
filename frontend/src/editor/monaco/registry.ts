import type { MonacoLanguage } from "./types";

import { go } from "./languages/go";

export const registry: Record<string, MonacoLanguage> = {
  go,
};
