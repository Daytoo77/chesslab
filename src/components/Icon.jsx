import React from 'react';
import {
  AlarmClock, ArrowLeft, ChevronFirst, ChevronLast, ChevronLeft, MoveUpRight, ArrowRight, ArrowUpDown, BookMarked, BookOpen, Bot, CalendarClock, ChartColumn,
  ChartLine, Check, ChessKing, ChessKnight, ChessPawn, ChevronRight, Circle, CircleCheck, ClipboardCopy,
  Coins, Cpu, Crown, Dices, Download, Dumbbell, Flag, Flame, FolderOpen, GitFork, GraduationCap,
  HandCoins, Handshake, Library, Lightbulb, List, ListChecks, Lock, MapPin, MessageCircle, Mic, Pin,
  Puzzle, Repeat, ScanSearch, Settings, Shuffle, Square, SquareCheck, Star, Swords, Target, ThumbsUp,
  Timer, TrendingUp, TriangleAlert, Trophy, Undo2, Upload, User, X, Zap, Bomb, Plus,
} from 'lucide-react';

// The one icon registry. Data files store a semantic NAME ('tactics',
// 'hung_piece'); only this file knows which drawing that is. lucide-react
// icons are imported one by one, so the bundle only carries what's listed.
const ICONS = {
  // sections / pages
  play: ChessKnight, tactics: Puzzle, openings: BookMarked, endgames: ChessKing,
  train: ListChecks, analyzer: ScanSearch, dashboard: ChartLine,
  // actions
  settings: Settings, export: Download, import: Upload, flip: ArrowUpDown, hint: Lightbulb,
  takeback: Undo2, resign: Flag, copy: ClipboardCopy, random: Shuffle, dice: Dices, close: X,
  next: ChevronRight, prev: ChevronLeft, first: ChevronFirst, last: ChevronLast, arrow: MoveUpRight,
  forward: ArrowRight, back: ArrowLeft, repeat: Repeat, folder: FolderOpen, add: Plus,
  explain: MessageCircle, prove: Dumbbell, drill: Puzzle, blunders: Bomb,
  // review / analysis
  review: Zap, report: ChartColumn, engine: Cpu, mistakes: TriangleAlert, moves: List,
  coach: GraduationCap, commentary: Mic, library: Library, best: Star, book: BookOpen,
  excellent: ThumbsUp, good: Check, forced: ArrowRight, miss: X,
  // status / feedback
  check: Check, done: CircleCheck, todo: Square, todoDone: SquareCheck, pending: Circle,
  warn: TriangleAlert, win: Trophy, loss: Flag, draw: Handshake, streak: Flame, rating: Zap,
  rush: Timer, bot: Bot, user: User, due: CalendarClock, insight: Pin, next_up: MapPin,
  focus: Target, trend_up: TrendingUp, quiz: Swords, test: ChessPawn, idea: Lightbulb,
  // mistake motifs (keys of MOTIF_META in review-core)
  hung_piece: Target, pawn_grab: HandCoins, missed_capture: Coins, missed_fork: GitFork,
  missed_mate: Crown, allowed_fork: GitFork, allowed_mate: TriangleAlert, back_rank: Lock,
  time_trouble: AlarmClock,
};

export const hasIcon = (name) => Boolean(ICONS[name]);

// <Icon name="tactics" /> — `fallback` covers stale names (e.g. an old
// persisted session that still stores a glyph). Decorative by default.
export default function Icon({ name, fallback, size = 18, strokeWidth = 2, className = '', label, ...rest }) {
  const C = ICONS[name] || ICONS[fallback];
  if (!C) return null;
  return (
    <C
      size={size}
      strokeWidth={strokeWidth}
      className={`icon-svg ${className}`.trim()}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
      {...rest}
    />
  );
}
