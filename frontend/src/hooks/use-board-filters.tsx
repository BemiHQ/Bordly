import { createContext, useContext } from 'react';

export interface BoardFilters {
  unread: boolean;
  sent: boolean;
  hasAttachments: boolean;
  draft: boolean;
  gmailAccountIds: string[];
}

export interface BoardFiltersContext {
  filters: BoardFilters;
  setFilters: (filters: BoardFilters | ((prev: BoardFilters) => BoardFilters)) => void;
}

const BoardFiltersContext = createContext<BoardFiltersContext | null>(null);

export const useBoardFilters = () => {
  const ctx = useContext(BoardFiltersContext);
  if (!ctx) throw new Error('useBoardFilters must be used within BoardFiltersProvider');
  return ctx;
};

export const BoardFiltersProvider = BoardFiltersContext.Provider;
