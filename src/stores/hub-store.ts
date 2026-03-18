import { create } from 'zustand';

interface HubStore {
  sidebarOpen: boolean;
  activeFilters: { provider?: string; sourceType?: string };
  chatDrafts: Record<string, string>;
  toggleSidebar: () => void;
  setFilter: (key: string, value: string | undefined) => void;
  clearFilters: () => void;
  setChatDraft: (workspaceId: string, text: string) => void;
}

export const useHubStore = create<HubStore>((set) => ({
  sidebarOpen: true,
  activeFilters: {},
  chatDrafts: {},
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setFilter: (key, value) =>
    set((s) => ({
      activeFilters: { ...s.activeFilters, [key]: value },
    })),
  clearFilters: () => set({ activeFilters: {} }),
  setChatDraft: (workspaceId, text) =>
    set((s) => ({
      chatDrafts: { ...s.chatDrafts, [workspaceId]: text },
    })),
}));
