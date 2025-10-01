/**
 * CheckersGame class
 * 
 * Implements the core logic of a standard 8x8 checkers game:
 */

class CheckersGame {
  // --- Private state ---
  #board;                // 8x8 array of cells: null | { color:'R'|'B', king:boolean }
  #currentPlayer;        // 'R' | 'B'
  #selected;             // null | {row, col}
  #validMovesCache;      // null | array of moves for currently selected piece

  // Constants
  static get SIZE() { return 8; }

  constructor() {
    this.reset();
  }


  /**
   * Reset to initial standard checkers setup; Red starts.
   */
  reset() {
    this.#board = this.#makeEmptyBoard();
    // Place Black on top (rows 0-2), Red on bottom (rows 5-7)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < CheckersGame.SIZE; c++) {
        if ((r + c) % 2 === 1) this.#board[r][c] = { color: 'B', king: false };
      }
    }
    for (let r = CheckersGame.SIZE - 3; r < CheckersGame.SIZE; r++) {
      for (let c = 0; c < CheckersGame.SIZE; c++) {
        if ((r + c) % 2 === 1) this.#board[r][c] = { color: 'R', king: false };
      }
    }
    this.#currentPlayer = 'R'; // Red starts first
    this.#selected = null;
    this.#validMovesCache = null;
  }

  /**
   * 'R' or 'B'
   */
  getCurrentPlayer() {
    return this.#currentPlayer;
  }

  /**
   * Query piece data on a square. Returns a COPY or null.
   */
  getPiece(row, col) {
    if (!this.#inBounds(row, col)) return null;
    const p = this.#board[row][col];
    return p ? { color: p.color, king: p.king } : null;
  }

  /**
   * Selection state, or null.
   */
  getSelected() {
    return this.#selected ? { row: this.#selected.row, col: this.#selected.col } : null;
  }

  /**
   * Attempt to select one of the current player's pieces.
   * Returns true if selected, false otherwise.
   */
  selectPiece(row, col) {
    if (!this.#inBounds(row, col)) return false;
    const p = this.#board[row][col];
    if (!p || p.color !== this.#currentPlayer) return false;

    this.#selected = { row, col };
    this.#validMovesCache = this.#computeValidMoves(row, col);
    return true;
  }

  /**
   * Clear the current selection.
   */
  deselect() {
    this.#selected = null;
    this.#validMovesCache = null;
  }

  /**
   * Valid moves for the currently selected piece.
   * Each move: { from:{row,col}, to:{row,col}, capture?:{row,col} }
   * Returns [] if no selection.
   */
  getValidMoves() {
    return this.#validMovesCache ? this.#cloneMoves(this.#validMovesCache) : [];
  }

  /**
   * Move the selected piece to (toRow, toCol) if it's a valid move.
   * Applies capture removal and kinging if applicable.
   * On success: executes move, flips turn, clears selection; returns true.
   * On failure: no change; returns false.
   */
  moveSelected(toRow, toCol) {
    if (!this.#selected || !this.#validMovesCache) return false;

    const match = this.#validMovesCache.find(
      m => m.to.row === toRow && m.to.col === toCol
    );
    if (!match) return false;

    const { row: fromRow, col: fromCol } = this.#selected;
    const piece = this.#board[fromRow][fromCol];
    if (!piece) return false; // Defensive

    // Execute move
    this.#board[toRow][toCol] = piece;
    this.#board[fromRow][fromCol] = null;

    // Capture?
    if (match.capture) {
      const { row: cr, col: cc } = match.capture;
      this.#board[cr][cc] = null;
    }

    // King?
    if (!piece.king) {
      if ((piece.color === 'R' && toRow === 0) ||
          (piece.color === 'B' && toRow === CheckersGame.SIZE - 1)) {
        piece.king = true;
      }
    }

    // Clear selection and advance turn
    this.#selected = null;
    this.#validMovesCache = null;
    this.#flipTurn();
    return true;
  }

  /**
   * Optional convenience: deep copy snapshot of the board for read-only display or debugging.
   */
  getBoardSnapshot() {
    return this.#board.map(row =>
      row.map(cell => (cell ? { color: cell.color, king: cell.king } : null))
    );
  }

  /**
   * Optional: returns whether the current player has at least one legal move.
   * (Not required by spec but handy for disabling input.)
   */
  canAnyMove() {
    // Efficiently scan only current player's pieces; still acceptable for 8x8.
    for (let r = 0; r < CheckersGame.SIZE; r++) {
      for (let c = 0; c < CheckersGame.SIZE; c++) {
        const p = this.#board[r][c];
        if (p && p.color === this.#currentPlayer) {
          if (this.#computeValidMoves(r, c).length > 0) return true;
        }
      }
    }
    return false;
  }

  // ---------- Private helpers ----------

  #makeEmptyBoard() {
    const b = new Array(CheckersGame.SIZE);
    for (let r = 0; r < CheckersGame.SIZE; r++) {
      b[r] = new Array(CheckersGame.SIZE).fill(null);
    }
    return b;
  }

  #inBounds(r, c) {
    return r >= 0 && r < CheckersGame.SIZE && c >= 0 && c < CheckersGame.SIZE;
  }

  #flipTurn() {
    this.#currentPlayer = this.#currentPlayer === 'R' ? 'B' : 'R';
  }

  #cloneMoves(moves) {
    return moves.map(m => ({
      from: { row: m.from.row, col: m.from.col },
      to: { row: m.to.row, col: m.to.col },
      capture: m.capture ? { row: m.capture.row, col: m.capture.col } : undefined
    }));
  }

  /**
   * Compute valid moves from a single piece efficiently (no whole-board evaluation).
   * For non-king pieces:
   *   - Red moves "up" the board (row - 1) and captures "up" (row - 2)
   *   - Black moves "down" the board (row + 1) and captures "down" (row + 2)
   * For kings: all 4 diagonal directions are available for both step and capture.
   *
   * NOTE: No multi-jumps, no forced-jumps as per milestone requirements.
   */
  #computeValidMoves(row, col) {
    const piece = this.#board[row][col];
    if (!piece) return [];

    const dirs = [];
    if (piece.king) {
      // All four diagonal directions
      dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    } else if (piece.color === 'R') {
      // Red moves "up" the board (toward row 0)
      dirs.push([-1, -1], [-1, 1]);
    } else {
      // Black moves "down" the board (toward row 7)
      dirs.push([1, -1], [1, 1]);
    }

    const moves = [];

    // Step moves (one diagonal)
    for (const [dr, dc] of dirs) {
      const r1 = row + dr, c1 = col + dc;
      if (this.#inBounds(r1, c1) && !this.#board[r1][c1]) {
        moves.push({
          from: { row, col },
          to: { row: r1, col: c1 }
          // no capture
        });
      }
    }

    // Capture moves (two diagonal, leaping over opponent)
    for (const [dr, dc] of dirs) {
      const r1 = row + dr, c1 = col + dc;           // adjacent
      const r2 = row + 2 * dr, c2 = col + 2 * dc;   // landing
      if (!this.#inBounds(r2, c2)) continue;
      if (this.#board[r2][c2]) continue;            // landing must be empty

      const mid = this.#inBounds(r1, c1) ? this.#board[r1][c1] : null;
      if (mid && mid.color !== piece.color) {
        moves.push({
          from: { row, col },
          to: { row: r2, col: c2 },
          capture: { row: r1, col: c1 }
        });
      }
    }

    // For the Oct 6 milestone we DO NOT enforce "forced jumps".
    // If you later add forced jumps, filter to capture-only when any capture exists.

    return moves;
  }
}

// ---- Example minimal usage (for your harness/controller) ----
// const game = new CheckersGame();
// game.selectPiece(5, 0);                 // if that square has a Red piece
// const moves = game.getValidMoves();     // [{from:{}, to:{}, capture?}, ...]
// game.moveSelected(4, 1);                // execute one of the valid moves
// game.getCurrentPlayer();                // 'B' after Red moves