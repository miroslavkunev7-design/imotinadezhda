import { create } from "zustand";
import type { BlockInstance, PageLayout } from "@/lib/page-builder/blocks";
import { createBlockInstance } from "@/lib/page-builder/blocks";

interface BuilderState {
  designId: string | null;
  pageSlug: string;
  blocks: BlockInstance[];
  selectedId: string | null;
  history: BlockInstance[][];
  future: BlockInstance[][];
  setDesign: (id: string | null, slug: string, layout: PageLayout) => void;
  addBlock: (type: string, atIndex?: number) => void;
  removeBlock: (id: string) => void;
  moveBlock: (from: number, to: number) => void;
  updateProps: (id: string, patch: Record<string, any>) => void;
  select: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  snapshot: () => void;
  clear: () => void;
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  designId: null,
  pageSlug: "home",
  blocks: [],
  selectedId: null,
  history: [],
  future: [],
  setDesign: (id, slug, layout) =>
    set({ designId: id, pageSlug: slug, blocks: layout.blocks ?? [], history: [], future: [], selectedId: null }),
  snapshot: () => {
    const { blocks, history } = get();
    set({ history: [...history.slice(-30), blocks], future: [] });
  },
  addBlock: (type, atIndex) => {
    get().snapshot();
    const b = createBlockInstance(type);
    const blocks = [...get().blocks];
    if (atIndex == null) blocks.push(b);
    else blocks.splice(atIndex, 0, b);
    set({ blocks, selectedId: b.id });
  },
  removeBlock: (id) => {
    get().snapshot();
    set({ blocks: get().blocks.filter((b) => b.id !== id), selectedId: null });
  },
  moveBlock: (from, to) => {
    get().snapshot();
    const blocks = [...get().blocks];
    const [m] = blocks.splice(from, 1);
    blocks.splice(to, 0, m);
    set({ blocks });
  },
  updateProps: (id, patch) =>
    set({
      blocks: get().blocks.map((b) =>
        b.id === id ? { ...b, props: { ...b.props, ...patch } } : b,
      ),
    }),
  select: (id) => set({ selectedId: id }),
  undo: () => {
    const { history, blocks, future } = get();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    set({ blocks: prev, history: history.slice(0, -1), future: [blocks, ...future] });
  },
  redo: () => {
    const { future, blocks, history } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({ blocks: next, future: future.slice(1), history: [...history, blocks] });
  },
  clear: () => {
    get().snapshot();
    set({ blocks: [], selectedId: null });
  },
}));
