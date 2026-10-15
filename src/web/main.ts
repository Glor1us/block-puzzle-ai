// PC viewer: watch the bot play with a speed slider. Pure DOM, no framework.

import {
  REGIONS,
  SIZE,
  applyMove,
  fitsAnywhere,
  getPiece,
  newGame,
  type GameState,
  type Move,
} from '../core/index.ts';
import { createBot, type Bot, type BotName } from '../ai/bots.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const boardEl = $('board');
const overlayEl = $('overlay');
const scoreEl = $('score');
const movesEl = $('moves');
const streakEl = $('streak');
const lastEl = $('last');
const trayEl = $('tray');
const playBtn = $<HTMLButtonElement>('play');
const stepBtn = $<HTMLButtonElement>('step');
const newBtn = $<HTMLButtonElement>('new');
const speedInput = $<HTMLInputElement>('speed');
const speedLabel = $('speedLabel');
const seedInput = $<HTMLInputElement>('seed');
const randomSeedBtn = $<HTMLButtonElement>('randomSeed');
const historyEl = $('history');
const botSelect = $<HTMLSelectElement>('botSelect');

// Delay between moves per slider position; 0 = turbo (many moves per frame).
const SPEEDS = [
  { delay: 2000, label: '0.5 moves/s' },
  { delay: 1000, label: '1 move/s' },
  { delay: 600, label: '~2 moves/s' },
  { delay: 350, label: '~3 moves/s' },
  { delay: 180, label: '~5 moves/s' },
  { delay: 80, label: '~12 moves/s' },
  { delay: 30, label: '~30 moves/s' },
  { delay: 8, label: '~100 moves/s' },
  { delay: 0, label: 'turbo' },
];
/** At this delay or slower the chosen move is previewed (ghost) before it is placed. */
const GHOST_MIN_DELAY = 300;
/** Turbo runs moves until this much of each frame is used. */
const TURBO_FRAME_MS = 14;

let bot: Bot = createBot(botSelect.value as BotName);

let state: GameState;
let running = false;
let timer: number | undefined;
let ghost: Move | null = null;
let lastCells = new Set<number>();
let flashCells = new Set<number>();
const history: { seed: number; score: number; moves: number; bot: string }[] = [];

// --- board DOM, built once ---
const cellEls: HTMLDivElement[] = [];
for (let r = 0; r < SIZE; r++) {
  for (let c = 0; c < SIZE; c++) {
    const el = document.createElement('div');
    const box = Math.floor(r / 3) + Math.floor(c / 3);
    el.className = 'cell';
    if (box % 2 === 1) el.dataset.alt = '1';
    boardEl.appendChild(el);
    cellEls.push(el);
  }
}

function speed() {
  return SPEEDS[Number(speedInput.value)]!;
}

function cellsOf(move: Move, s: GameState): number[] {
  const piece = getPiece(s.tray[move.slot]!);
  return piece.cells.map(([dr, dc]) => (move.row + dr) * SIZE + move.col + dc);
}

function render() {
  const ghostCells = new Set(ghost ? cellsOf(ghost, state) : []);
  cellEls.forEach((el, i) => {
    const classes = ['cell'];
    if (el.dataset.alt) classes.push('alt');
    if (state.board[i]) {
      classes.push('filled');
      if (lastCells.has(i)) classes.push('last');
    } else if (ghostCells.has(i)) classes.push('ghost');
    else if (flashCells.has(i)) classes.push('flash');
    el.className = classes.join(' ');
  });
  boardEl.classList.toggle('fast', speed().delay < 60);

  scoreEl.textContent = String(state.score);
  movesEl.textContent = String(state.moves);
  streakEl.textContent = String(state.streak);
  renderTray();

  if (state.gameOver) {
    overlayEl.hidden = false;
    overlayEl.innerHTML = `Game over<small>${state.score} points · ${state.moves} moves · seed ${seedInput.value}</small>`;
  } else {
    overlayEl.hidden = true;
  }
  playBtn.textContent = running ? '⏸ Pause' : '▶ Play';
  playBtn.disabled = stepBtn.disabled = state.gameOver;
}

function renderTray() {
  trayEl.innerHTML = '';
  state.tray.forEach((id, slot) => {
    const slotEl = document.createElement('div');
    slotEl.className = 'tray-slot';
    if (id === null) {
      slotEl.classList.add('empty');
      trayEl.appendChild(slotEl);
      return;
    }
    const piece = getPiece(id);
    if (ghost?.slot === slot) slotEl.classList.add('chosen');
    if (!fitsAnywhere(state.board, piece)) slotEl.classList.add('unfit');
    slotEl.style.gridTemplateColumns = `repeat(${piece.width}, 20px)`;
    const on = new Set(piece.cells.map(([r, c]) => r * piece.width + c));
    for (let i = 0; i < piece.width * piece.height; i++) {
      const p = document.createElement('div');
      p.className = on.has(i) ? 'p on' : 'p';
      slotEl.appendChild(p);
    }
    trayEl.appendChild(slotEl);
  });
}

/** Applies a move; returns false if the game is over afterwards. */
function commit(move: Move, quiet = false): boolean {
  const before = state.board;
  const placed = cellsOf(move, state);
  const { state: next, result } = applyMove(state, move);
  state = next;
  ghost = null;
  lastCells = new Set(placed.filter((i) => state.board[i]));
  flashCells = new Set();
  if (result.regions.length) {
    for (const r of result.regions) for (const i of REGIONS[r]!) if (before[i] || placed.includes(i)) flashCells.add(i);
  }
  if (!quiet) {
    if (result.regions.length) {
      const parts = [`+${result.points}`];
      if (result.regions.length > 1) parts.push(`combo ×${result.regions.length}`);
      if (result.streak > 1) parts.push(`streak ${result.streak}`);
      lastEl.textContent = parts.join(' · ');
    } else {
      lastEl.textContent = `+${result.points}`;
    }
  }
  if (state.gameOver) finishGame();
  return !state.gameOver;
}

function finishGame() {
  stop();
  const botLabel = botSelect.selectedOptions[0]?.textContent ?? botSelect.value;
  history.unshift({ seed: Number(seedInput.value), score: state.score, moves: state.moves, bot: botLabel });
  const best = Math.max(...history.map((h) => h.score));
  historyEl.innerHTML = history
    .map((h) => `<li class="${h.score === best ? 'best' : ''}">${h.score} points · ${h.moves} moves · seed ${h.seed}<br><small>${h.bot}</small></li>`)
    .join('');
}

function tick() {
  if (!running || state.gameOver) return;
  const { delay } = speed();

  if (delay === 0) {
    const t0 = performance.now();
    while (running && performance.now() - t0 < TURBO_FRAME_MS) {
      const move = bot(state);
      if (!move || !commit(move, true)) break;
    }
    lastEl.textContent = ' ';
    render();
    timer = requestAnimationFrame(tick);
    return;
  }

  const move = bot(state);
  if (!move) return;
  if (delay >= GHOST_MIN_DELAY) {
    ghost = move;
    render();
    timer = window.setTimeout(() => {
      commit(move);
      render();
      timer = window.setTimeout(tick, delay / 2);
    }, delay / 2);
  } else {
    commit(move);
    render();
    timer = window.setTimeout(tick, delay);
  }
}

function stop() {
  running = false;
  clearTimeout(timer);
  cancelAnimationFrame(timer ?? 0);
}

function start() {
  if (state.gameOver) return;
  running = true;
  tick();
}

function resetGame() {
  stop();
  state = newGame(Number(seedInput.value) || 1);
  ghost = null;
  lastCells = new Set();
  flashCells = new Set();
  lastEl.textContent = ' ';
  render();
}

playBtn.onclick = () => {
  if (running) stop();
  else start();
  render();
};

stepBtn.onclick = () => {
  stop();
  // A pending ghost is committed by the step; otherwise make a fresh move.
  const move = ghost ?? bot(state);
  if (move) commit(move);
  render();
};

// Same seed = same game, so "new game" moves on to the next seed; edit the field to replay one.
newBtn.onclick = () => {
  seedInput.value = String((Number(seedInput.value) || 0) + 1);
  resetGame();
};
randomSeedBtn.onclick = () => {
  seedInput.value = String(1 + Math.floor(Math.random() * 1_000_000));
  resetGame();
};
seedInput.onchange = resetGame;
botSelect.onchange = () => {
  bot = createBot(botSelect.value as BotName);
  resetGame();
};

speedInput.oninput = () => {
  speedLabel.textContent = speed().label;
  // Restart the loop so the new delay applies at once.
  if (running) {
    stop();
    ghost = null;
    start();
  }
  render();
};

speedLabel.textContent = speed().label;
resetGame();
