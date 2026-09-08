/* Сапёр — игровая логика (чистые функции, без DOM). */

const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateBoard(width, height, mineCount) {
  const totalCells = width * height;
  const mineCountClamped = Math.min(mineCount, totalCells);

  const mineArray = new Array(totalCells).fill(false);
  for (let i = 0; i < mineCountClamped; i++) mineArray[i] = true;
  const shuffledMines = shuffle(mineArray);

  const board = [];
  for (let r = 0; r < height; r++) {
    const row = [];
    for (let c = 0; c < width; c++) {
      const idx = r * width + c;
      row.push({
        isMine: shuffledMines[idx],
        adjacentMines: 0,
        state: "unopened",
      });
    }
    board.push(row);
  }

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (board[r][c].isMine) continue;
      let count = 0;
      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr;
        const nc = c + dc;
        if (
          nr >= 0 &&
          nr < height &&
          nc >= 0 &&
          nc < width &&
          board[nr][nc].isMine
        ) {
          count++;
        }
      }
      board[r][c].adjacentMines = count;
    }
  }

  return board;
}

function cloneBoard(board) {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function revealCell(board, row, col, width, height) {
  const newBoard = cloneBoard(board);
  const cell = newBoard[row][col];

  if (cell.state === "revealed" || cell.state === "flagged") {
    return newBoard;
  }

  cell.state = "revealed";

  if (cell.isMine) {
    return newBoard;
  }

  if (cell.adjacentMines === 0) {
    const stack = [[row, col]];
    const visited = new Set([`${row},${col}`]);

    while (stack.length > 0) {
      const [cr, cc] = stack.pop();
      for (const [dr, dc] of DIRECTIONS) {
        const nr = cr + dr;
        const nc = cc + dc;
        const key = `${nr},${nc}`;
        if (
          nr >= 0 &&
          nr < height &&
          nc >= 0 &&
          nc < width &&
          !visited.has(key) &&
          newBoard[nr][nc].state !== "revealed"
        ) {
          visited.add(key);
          if (!newBoard[nr][nc].isMine) {
            newBoard[nr][nc].state = "revealed";
            if (newBoard[nr][nc].adjacentMines === 0) {
              stack.push([nr, nc]);
            }
          }
        }
      }
    }
  }

  return newBoard;
}

function toggleFlag(board, row, col) {
  const newBoard = cloneBoard(board);
  const cell = newBoard[row][col];

  if (cell.state === "revealed") {
    return newBoard;
  }

  cell.state = cell.state === "flagged" ? "unopened" : "flagged";
  return newBoard;
}

function revealAllMines(board, width, height) {
  const newBoard = cloneBoard(board);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (newBoard[r][c].isMine) {
        newBoard[r][c].state = "revealed";
      }
    }
  }
  return newBoard;
}

function checkWin(board, width, height) {
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = board[r][c];
      if (!cell.isMine && cell.state !== "revealed") {
        return false;
      }
    }
  }
  return true;
}

function countFlags(board) {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.state === "flagged") count++;
    }
  }
  return count;
}

window.Minesweeper = {
  generateBoard,
  revealCell,
  toggleFlag,
  revealAllMines,
  checkWin,
  countFlags,
};
