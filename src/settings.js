// UI settings + cross-section navigation (zustand, persisted separately from stats).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const BOARD_THEMES = [
  { id: 'classic', name: 'Green (chess.com)', light: '#ebecd0', dark: '#739552' },
  { id: 'midnight', name: 'Midnight', light: '#c6cddf', dark: '#3c4a6e' },
  { id: 'walnut', name: 'Walnut', light: '#f0d9b5', dark: '#b58863' },
  { id: 'ocean', name: 'Ocean', light: '#cfdbe6', dark: '#5b7d99' },
  { id: 'glacier', name: 'Glacier', light: '#e8edf9', dark: '#7286a3' },
  { id: 'rose', name: 'Rosewood', light: '#e8d0c2', dark: '#9e5e51' },
];
export const themeById = (id) => BOARD_THEMES.find((t) => t.id === id) || BOARD_THEMES[0];

export const useSettings = create(
  persist(
    (set) => ({
      boardTheme: 'classic', // chess.com green by default
      appTheme: 'dark',      // dark | light
      pieceSet: 'classic',   // classic | unicode
      showLegal: true,       // legal-move dots on click/drag
      coords: true,          // board coordinates
      animMs: 160,           // piece animation duration
      autoQueen: false,      // skip the promotion picker
      evalBarPlay: false,    // live eval bar while playing vs a bot
      hifiSound: true,       // richer sound set
      set: (patch) => set(patch),
    }),
    { name: 'chesslab_settings_v1' }
  )
);

// Ephemeral UI state — current page + cross-section handoffs.
export const useUi = create((set) => ({
  page: 'play',
  setPage: (page) => set({ page }),
  analyzeRequest: null, // { pgn, color }
  requestAnalysis: (pgn, color) => set({ analyzeRequest: { pgn, color }, page: 'analyzer' }),
  consumeAnalysis: () => set({ analyzeRequest: null }),
  playRequest: null, // { fen, color, name } — start a bot game from a repertoire position
  requestPlay: (fen, color, name) => set({ playRequest: { fen, color, name }, page: 'play' }),
  consumePlay: () => set({ playRequest: null }),
}));
