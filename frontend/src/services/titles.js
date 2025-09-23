const TITLE_MAP = {
  bugSmasher: "Bug Smasher",
  memory: "Memory Match",
  sudoku: "Sudoku",
  miniSudoku: "Mini Sudoku",
  tictactoe: "Tic-Tac-Toe",
  typeRacer: "Type Racer",
  mathSprint: "Math Sprint",
  wordScram: "Word Scramble",
  trainBrain: "Train the Brain",
  rps: "Rock • Paper • Scissors",
  cutFruit: "Cut the Fruit",
};

export function gameTitle(id){
  if (!id) return "";
  return TITLE_MAP[id] || id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}
