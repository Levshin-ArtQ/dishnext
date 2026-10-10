import type { Dish, TournamentState } from "../types";
import { jaccard, shuffle } from "./text";

export function emptyTournament(): TournamentState {
  return {
    remaining: [],
    current: null,
    bye: null,
    winners: [],
    round: 1,
    history: [],
    undoStack: []
  };
}

export function seedFinalists(
  dishes: Dish[],
  opts: { min?: number; max?: number; random?: () => number } = {}
): Dish[] {
  const min = opts.min ?? 2;
  const max = opts.max ?? 16;
  const random = opts.random ?? Math.random;
  const unique = new Map<string, Dish>();
  for (const dish of dishes) unique.set(dish.id, dish);
  let list = [...unique.values()];
  if (list.length > max) {
    const lovedFirst = list.slice();
    list = lovedFirst.slice(0, max);
  }
  if (list.length < min) return list;
  return diversifyPairing(list, random);
}

function diversifyPairing(dishes: Dish[], random: () => number): Dish[] {
  const pool = shuffle(dishes, random);
  const ordered: Dish[] = [];
  while (pool.length) {
    if (!ordered.length) {
      ordered.push(pool.shift()!);
      continue;
    }
    const prev = ordered[ordered.length - 1];
    let bestIdx = 0;
    let best = -1;
    for (let i = 0; i < pool.length; i += 1) {
      const d = pool[i];
      const cuisineGap = d.cuisine === prev.cuisine ? 0 : 1;
      const ingGap = 1 - jaccard(prev.ingredients, d.ingredients);
      const score = cuisineGap * 1.2 + ingGap;
      if (score > best) {
        best = score;
        bestIdx = i;
      }
    }
    ordered.push(pool.splice(bestIdx, 1)[0]);
  }
  return ordered;
}

export function startTournament(ids: string[]): TournamentState {
  const remaining = ids.slice();
  const state = emptyTournament();
  state.remaining = remaining;
  return nextPair(state);
}

export function cloneTournament(state: TournamentState, keepUndo = false): TournamentState {
  return {
    remaining: state.remaining.slice(),
    current: state.current ? [...state.current] : null,
    bye: state.bye,
    winners: state.winners.slice(),
    round: state.round,
    history: state.history.map((h) => ({ ...h })),
    undoStack: keepUndo ? state.undoStack : []
  };
}

export function nextPair(state: TournamentState): TournamentState {
  const next = cloneTournament(state, true);
  if (next.current) return next;

  if (next.remaining.length + next.winners.length <= 1) {
    return next;
  }

  if (next.remaining.length === 0) {
    next.remaining = next.winners;
    next.winners = [];
    next.round += 1;
    next.bye = null;
  }

  if (next.remaining.length === 1 && next.winners.length === 0) {
    return next;
  }

  if (next.remaining.length % 2 === 1) {
    next.bye = next.remaining.shift() ?? null;
    if (next.bye) next.winners.push(next.bye);
  }

  if (next.remaining.length >= 2) {
    const left = next.remaining.shift()!;
    const right = next.remaining.shift()!;
    next.current = [left, right];
  }
  return next;
}

export function chooseWinner(state: TournamentState, winnerId: string, at = Date.now()): TournamentState {
  if (!state.current) return state;
  const [left, right] = state.current;
  if (winnerId !== left && winnerId !== right) return state;
  const snapshot = cloneTournament(state);
  const next = cloneTournament(state, true);
  next.undoStack = [snapshot, ...state.undoStack].slice(0, 20);
  next.history = [
    ...next.history,
    { leftId: left, rightId: right, winnerId, skipped: false, at }
  ];
  next.winners.push(winnerId);
  next.current = null;
  return nextPair(next);
}

export function canSkipPair(state: TournamentState): boolean {
  return Boolean(state.current) && state.remaining.length + state.winners.length > 0;
}

export function skipPair(state: TournamentState, at = Date.now()): TournamentState {
  if (!state.current) return state;
  if (!canSkipPair(state)) return state;
  const [left, right] = state.current;
  const snapshot = cloneTournament(state);
  const next = cloneTournament(state, true);
  next.undoStack = [snapshot, ...state.undoStack].slice(0, 20);
  next.history = [
    ...next.history,
    { leftId: left, rightId: right, winnerId: null, skipped: true, at }
  ];
  next.winners.push(left, right);
  next.current = null;
  return nextPair(next);
}

export function undoTournament(state: TournamentState): TournamentState {
  const prev = state.undoStack[0];
  if (!prev) return state;
  const restored = cloneTournament(prev, true);
  restored.undoStack = state.undoStack.slice(1);
  return restored;
}

export function tournamentChampion(state: TournamentState): string | undefined {
  if (state.current) return undefined;
  const pool = [...state.remaining, ...state.winners];
  if (pool.length === 1) return pool[0];
  return undefined;
}

export function finalistsOf(state: TournamentState): string[] {
  const ids: string[] = [];
  for (const row of state.history) {
    if (row.winnerId) ids.push(row.winnerId);
    if (!row.skipped) {
      ids.push(row.leftId, row.rightId);
    }
  }
  return [...new Set(ids)];
}
