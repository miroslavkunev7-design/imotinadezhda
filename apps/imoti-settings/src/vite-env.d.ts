/// <reference types="vite/client" />

interface ImotiSettingsBridge {
  previewNavigate: (url: string) => Promise<{ ok: boolean; url?: string }>;
  previewReload: () => Promise<{ ok: boolean }>;
  previewApply: (
    components: Array<{ component_key: string; type: string; props: Record<string, unknown> }>,
    highlightKey?: string | null
  ) => Promise<{ ok: boolean; error?: string }>;
  setPreviewRatio: (ratio: number) => Promise<void>;
  openImage: () => Promise<{
    name: string;
    path: string;
    mime: string;
    dataUrl: string;
    bytes: number;
  } | null>;
  appInfo: () => Promise<{ siteOrigin: string; version: string; installHint: string }>;
}

interface Window {
  imotiSettings?: ImotiSettingsBridge;
}
