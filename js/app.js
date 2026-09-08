/* Сапёр — контроллер интерфейса (DOM, состояние игры, таймер, localStorage). */

(function () {
  "use strict";

  const MIN_DIM = 5;
  const MAX_DIM = 14;
  const MIN_PERCENT = 5;
  const MAX_PERCENT = 50;
  const DEFAULT_WIDTH = 10;
  const DEFAULT_HEIGHT = 10;
  const DEFAULT_PERCENT = 15;
  const LEADERBOARD_KEY = "minesweeper:scores";
  const MAX_SCORES = 5;

  const $ = (id) => document.getElementById(id);

  const els = {
    settingsForm: $("settings-form"),
    settingsSection: document.querySelector(".panel--settings"),
    gameSection: document.querySelector(".panel--game"),
    leaderboardSection: document.querySelector(".panel--leaderboard"),
    widthInput: $("width"),
    heightInput: $("height"),
    widthValue: $("width-value"),
    heightValue: $("height-value"),
    minesRange: $("mines"),
    minesValue: $("mines-value"),
    boardWrap: $("board-wrap"),
    mineCounter: $("mine-counter"),
    timer: $("timer"),
    resetBtn: $("reset-btn"),
    restartSettingsBtn: $("restart-settings-btn"),
    resetLeaderboardBtn: $("reset-leaderboard-btn"),
    leaderboard: $("leaderboard"),
    shareBtn: $("share-btn"),
    toast: $("toast"),
  };

  const state = {
    board: [],
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    mineCount: 0,
    status: "ready", // ready | playing | won | lost
    started: false,
    timerSeconds: 0,
    timerInterval: null,
    flagCount: 0,
    longPressTimer: null,
  };

  /* ---------- Хранилище результатов ---------- */

  function loadScores() {
    try {
      const raw = localStorage.getItem(LEADERBOARD_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (s) => s && typeof s.time === "number" && typeof s.width === "number"
        )
        .sort((a, b) => a.time - b.time)
        .slice(0, MAX_SCORES);
    } catch {
      return [];
    }
  }

  function saveScore(entry) {
    const scores = loadScores();
    scores.push(entry);
    scores.sort((a, b) => a.time - b.time);
    const next = scores.slice(0, MAX_SCORES);
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
    return next;
  }

  function clearScores() {
    try {
      localStorage.removeItem(LEADERBOARD_KEY);
    } catch {
      /* ignore */
    }
  }

  function formatDate(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function renderLeaderboard() {
    const scores = loadScores();
    els.leaderboard.innerHTML = "";

    if (scores.length === 0) {
      const empty = document.createElement("div");
      empty.className = "leaderboard__empty";
      empty.textContent = "Пока нет результатов — выиграйте партию!";
      els.leaderboard.appendChild(empty);
      return;
    }

    const table = document.createElement("table");
    table.className = "leaderboard__table";

    const thead = document.createElement("thead");
    thead.innerHTML =
      "<tr><th>#</th><th>Время</th><th>Поле</th><th>Мины</th><th>Дата</th></tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    scores.forEach((s, i) => {
      const tr = document.createElement("tr");

      const rank = document.createElement("td");
      rank.className = "leaderboard__rank";
      rank.textContent = String(i + 1);

      const time = document.createElement("td");
      time.className = "leaderboard__time";
      time.textContent = formatTime(s.time);

      const meta1 = document.createElement("td");
      meta1.className = "leaderboard__meta";
      meta1.textContent = `${s.width}×${s.height}`;

      const mines = document.createElement("td");
      mines.className = "leaderboard__meta";
      mines.textContent = String(s.mines);

      const date = document.createElement("td");
      date.className = "leaderboard__meta";
      date.textContent = formatDate(s.date);

      tr.append(rank, time, meta1, mines, date);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    els.leaderboard.appendChild(table);
  }

  /* ---------- Таймер ---------- */

  function formatTime(totalSeconds) {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function updateTimerDisplay() {
    els.timer.textContent = formatTime(state.timerSeconds);
  }

  function startTimer() {
    if (state.timerInterval) return;
    state.timerInterval = setInterval(() => {
      state.timerSeconds += 1;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function resetTimer() {
    stopTimer();
    state.timerSeconds = 0;
    updateTimerDisplay();
  }

  /* ---------- Сборка поля ---------- */

  function computeCellSize() {
    const wrap = els.boardWrap;
    const avail = Math.min(wrap.clientWidth, window.innerWidth - 32);
    const cell = Math.floor((avail - (state.width - 1) * 3 - 2) / state.width);
    return Math.max(22, Math.min(40, cell));
  }

  function buildBoardDOM(board) {
    const cellSize = computeCellSize();
    const boardEl = document.createElement("div");
    boardEl.className = "board";
    boardEl.style.gridTemplateColumns = `repeat(${state.width}, var(--cell-size))`;
    boardEl.style.setProperty("--cell-size", `${cellSize}px`);

    for (let r = 0; r < state.height; r++) {
      for (let c = 0; c < state.width; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.setAttribute("aria-label", `Клетка ${r + 1}, ${c + 1}`);
        attachCellHandlers(cell);
        boardEl.appendChild(cell);
      }
    }

    els.boardWrap.innerHTML = "";
    els.boardWrap.appendChild(boardEl);
  }

  function renderBoard() {
    const cells = els.boardWrap.querySelectorAll(".cell");
    cells.forEach((el) => {
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      const cell = state.board[r][c];
      el.className = "cell";
      el.removeAttribute("data-num");
      el.innerHTML = "";

      if (cell.state === "revealed") {
        el.classList.add("cell--revealed");
        if (cell.isMine) {
          el.classList.add("cell--mine");
          if (state.status === "lost") el.classList.add("cell--lost-mine");
          el.textContent = "💣";
        } else if (cell.adjacentMines > 0) {
          el.dataset.num = String(cell.adjacentMines);
          el.textContent = String(cell.adjacentMines);
        }
      } else if (cell.state === "flagged") {
        el.classList.add("cell--flagged");
        el.textContent = "🚩";
      }
    });
  }

  function updateMineCounter() {
    const remaining = state.mineCount - state.flagCount;
    els.mineCounter.textContent = String(remaining);
  }

  function newGame(width, height, percent) {
    stopTimer();
    clearTimeout(state.longPressTimer);
    state.width = width;
    state.height = height;
    state.mineCount = Math.round((width * height * percent) / 100);
    state.board = Minesweeper.generateBoard(width, height, state.mineCount);
    state.status = "ready";
    state.started = false;
    state.flagCount = 0;
    state.timerSeconds = 0;
    updateTimerDisplay();
    updateMineCounter();
    setFace("🙂");
    buildBoardDOM(state.board);
    renderBoard();
  }

  /* ---------- Игровые действия ---------- */

  function firstClick() {
    if (!state.started) {
      state.started = true;
      state.status = "playing";
      setSettingsVisible(false);
      startTimer();
    }
  }

  function setSettingsVisible(visible) {
    els.settingsSection.classList.toggle("hidden", !visible);
    els.restartSettingsBtn.classList.toggle("hidden", visible);
    els.gameSection.classList.toggle("hidden", visible);
    els.leaderboardSection.classList.toggle("hidden", visible);
  }

  function openCell(r, c) {
    if (state.status !== "ready" && state.status !== "playing") return;

    const cell = state.board[r][c];
    if (cell.state === "flagged" || cell.state === "revealed") return;

    firstClick();

    if (cell.isMine) {
      state.board = Minesweeper.revealAllMines(
        state.board,
        state.width,
        state.height
      );
      state.status = "lost";
      stopTimer();
      renderBoard();
      setFace("😵");
      showToast("Вы подорвались на мине!", "error");
      return;
    }

    state.board = Minesweeper.revealCell(
      state.board,
      r,
      c,
      state.width,
      state.height
    );
    renderBoard();

    if (Minesweeper.checkWin(state.board, state.width, state.height)) {
      handleWin();
    }
  }

  function handleWin() {
    state.status = "won";
    stopTimer();
    setFace("😎");
    renderBoard();

    const entry = {
      time: state.timerSeconds,
      width: state.width,
      height: state.height,
      mines: state.mineCount,
      date: new Date().toISOString(),
    };
    saveScore(entry);
    renderLeaderboard();
    showToast("Победа! Время: " + formatTime(state.timerSeconds), "success");
  }

  function toggleFlag(r, c) {
    if (state.status !== "ready" && state.status !== "playing") return;

    const cell = state.board[r][c];
    if (cell.state === "revealed") return;

    firstClick();

    state.board = Minesweeper.toggleFlag(state.board, r, c);
    state.flagCount = Minesweeper.countFlags(state.board);
    renderBoard();
    updateMineCounter();
  }

  function setFace(emoji) {
    els.resetBtn.textContent = emoji;
  }

  /* ---------- Обработчики клеток ---------- */

  function attachCellHandlers(cell) {
    cell.addEventListener("click", () => {
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      openCell(r, c);
    });

    cell.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      toggleFlag(r, c);
    });

    let longPressTriggered = false;

    const startLongPress = () => {
      longPressTriggered = false;
      clearTimeout(state.longPressTimer);
      state.longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        const r = Number(cell.dataset.r);
        const c = Number(cell.dataset.c);
        toggleFlag(r, c);
        navigator.vibrate && navigator.vibrate(20);
      }, 400);
    };

    const cancelLongPress = () => {
      clearTimeout(state.longPressTimer);
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 1) startLongPress();
    };

    const onTouchEnd = (e) => {
      cancelLongPress();
      if (longPressTriggered) {
        e.preventDefault();
      }
    };

    cell.addEventListener("touchstart", onTouchStart, { passive: true });
    cell.addEventListener("touchend", onTouchEnd, { passive: false });
  }

  /* ---------- Уведомления ---------- */

  let toastTimer = null;

  function showToast(message, type) {
    els.toast.textContent = message;
    els.toast.className = "toast toast--show" + (type ? " toast--" + type : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.className = "toast";
    }, 2600);
  }

  /* ---------- Поделиться ---------- */

  const shareUrl = window.location.href;

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast("Ссылка скопирована", "success");
    } catch {
      showToast("Не удалось скопировать ссылку", "error");
    } finally {
      document.body.removeChild(ta);
    }
  }

  function copyLink() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => showToast("Ссылка скопирована", "success"))
        .catch(() => fallbackCopy(shareUrl));
    } else {
      fallbackCopy(shareUrl);
    }
  }

  function handleShare() {
    if (navigator.share) {
      navigator
        .share({
          title: document.title,
          text: "Играй в Сапёр!",
          url: shareUrl,
        })
        .catch(() => {});
      return;
    }
    copyLink();
  }

  /* ---------- Настройки ---------- */

  function readSettings() {
    const width = clampInt(els.widthInput.value, MIN_DIM, MAX_DIM);
    const height = clampInt(els.heightInput.value, MIN_DIM, MAX_DIM);
    const percent = clampInt(els.minesRange.value, MIN_PERCENT, MAX_PERCENT);
    return { width, height, percent };
  }

  function clampInt(value, min, max) {
    let n = parseInt(value, 10);
    if (Number.isNaN(n)) n = min;
    return Math.min(max, Math.max(min, n));
  }

  function syncSettingsFromDefaults() {
    els.widthInput.value = String(DEFAULT_WIDTH);
    els.heightInput.value = String(DEFAULT_HEIGHT);
    els.minesRange.value = String(DEFAULT_PERCENT);
    els.widthValue.textContent = String(DEFAULT_WIDTH);
    els.heightValue.textContent = String(DEFAULT_HEIGHT);
    els.minesValue.textContent = DEFAULT_PERCENT + "%";
  }

  /* ---------- Инициализация ---------- */

  function init() {
    syncSettingsFromDefaults();

    els.widthInput.addEventListener("input", () => {
      els.widthValue.textContent = els.widthInput.value;
    });

    els.heightInput.addEventListener("input", () => {
      els.heightValue.textContent = els.heightInput.value;
    });

    els.minesRange.addEventListener("input", () => {
      els.minesValue.textContent = els.minesRange.value + "%";
    });

    els.settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const { width, height, percent } = readSettings();
      els.widthInput.value = String(width);
      els.heightInput.value = String(height);
      newGame(width, height, percent);
      setSettingsVisible(false);
      showToast("Новая игра: " + width + "×" + height, null);
    });

    els.resetBtn.addEventListener("click", () => {
      const { width, height, percent } = readSettings();
      newGame(width, height, percent);
    });

    els.restartSettingsBtn.addEventListener("click", () => {
      setSettingsVisible(true);
      showToast("Настройте новую игру", null);
    });

    els.resetLeaderboardBtn.addEventListener("click", () => {
      clearScores();
      renderLeaderboard();
      showToast("Результаты сброшены", null);
    });

    els.shareBtn.addEventListener("click", handleShare);

    window.addEventListener("resize", () => {
      if (state.board.length) {
        buildBoardDOM(state.board);
        renderBoard();
      }
    });

    renderLeaderboard();
    newGame(DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_PERCENT);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
