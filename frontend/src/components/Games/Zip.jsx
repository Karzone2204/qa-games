import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';

function key(r, c) { return `${r},${c}`; }
function parseKey(k) { 
  const [r, c] = k.split(',').map(Number);
  return [r, c];
}
function isNeighbor(a, b) { 
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1; 
}

// Seeded random number generator for consistent puzzle generation
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2147483648;
    return s / 2147483648;
  };
}

// Generate a solvable puzzle with strategically placed targets
function generatePuzzle(rows, cols, numTargets, seed) {
  const rng = seededRandom(seed);
  const totalCells = rows * cols;
  
  // Helper to get neighbors
  const getNeighbors = (r, c) => {
    const neighbors = [];
    if (r > 0) neighbors.push([r - 1, c]);
    if (r < rows - 1) neighbors.push([r + 1, c]);
    if (c > 0) neighbors.push([r, c - 1]);
    if (c < cols - 1) neighbors.push([r, c + 1]);
    return neighbors;
  };
  
  // Generate a Hamiltonian path that visits all cells
  const generateHamiltonianPath = () => {
    const visited = new Set();
    const path = [];
    
    // Start from a corner for better puzzles
    const corners = [[0, 0], [0, cols - 1], [rows - 1, 0], [rows - 1, cols - 1]];
    const startCorner = corners[Math.floor(rng() * corners.length)];
    
    // Use DFS with randomization to create a path
    const dfs = (r, c) => {
      const k = key(r, c);
      if (visited.has(k)) return false;
      
      visited.add(k);
      path.push([r, c]);
      
      if (path.length === totalCells) return true;
      
      // Get and shuffle neighbors
      const neighbors = getNeighbors(r, c)
        .filter(([nr, nc]) => !visited.has(key(nr, nc)))
        .sort(() => rng() - 0.5);
      
      for (const [nr, nc] of neighbors) {
        if (dfs(nr, nc)) return true;
      }
      
      // Backtrack
      path.pop();
      visited.delete(k);
      return false;
    };
    
    // Try to generate a path
    if (dfs(startCorner[0], startCorner[1])) {
      return path;
    }
    
    // Fallback: create a simple snake pattern
    const fallback = [];
    for (let r = 0; r < rows; r++) {
      if (r % 2 === 0) {
        for (let c = 0; c < cols; c++) fallback.push([r, c]);
      } else {
        for (let c = cols - 1; c >= 0; c--) fallback.push([r, c]);
      }
    }
    return fallback;
  };
  
  // Generate the solution path
  const solutionPath = generateHamiltonianPath();
  
  // Strategic target placement
  const placeTargets = () => {
    const targets = [];
    
    // Always start at the beginning of the path
    targets.push([...solutionPath[0], 1]);
    
    if (numTargets === 2) {
      // For 2 targets, place the second at the end
      targets.push([...solutionPath[solutionPath.length - 1], 2]);
    } else {
      // For multiple targets, distribute them to force maximum coverage
      // Calculate ideal spacing
      const segmentLength = Math.floor(solutionPath.length / (numTargets - 1));
      
      for (let i = 1; i < numTargets - 1; i++) {
        // Place targets at strategic points that maximize the forced path
        let targetIndex = i * segmentLength;
        
        // Add some randomness but ensure good distribution
        const variance = Math.floor(segmentLength * 0.2);
        targetIndex += Math.floor((rng() - 0.5) * variance * 2);
        targetIndex = Math.max(
          (i - 1) * segmentLength + 2, // Minimum distance from previous
          Math.min(
            solutionPath.length - (numTargets - i) * 2, // Leave room for remaining
            targetIndex
          )
        );
        
        targets.push([...solutionPath[targetIndex], i + 1]);
      }
      
      // Last target at the end of the path
      targets.push([...solutionPath[solutionPath.length - 1], numTargets]);
    }
    
    return targets;
  };
  
  const targets = placeTargets();
  
  const verifySolution = () => true; // Targets lie on the solution path
  
  return { 
    targets, 
    solution: solutionPath,
    isValid: verifySolution()
  };
}

// Predefined levels with guaranteed solvable configurations
const LEVELS = [
  { id: 1, rows: 2, cols: 2, numTargets: 2 },  // 2x2 intro
  { id: 2, rows: 3, cols: 3, numTargets: 2 },  // 3x3 easy
  { id: 3, rows: 3, cols: 3, numTargets: 3 },  // 3x3 with 3 targets
  { id: 4, rows: 4, cols: 4, numTargets: 3 },  // 4x4 
  { id: 5, rows: 4, cols: 4, numTargets: 4 },  // 4x4 harder
  { id: 6, rows: 5, cols: 5, numTargets: 3 },  // 5x5
  { id: 7, rows: 5, cols: 5, numTargets: 5 },  // 5x5 harder
  { id: 8, rows: 6, cols: 6, numTargets: 4 },  // 6x6
  { id: 9, rows: 6, cols: 6, numTargets: 6 },  // 6x6 harder
  { id: 10, rows: 7, cols: 7, numTargets: 5 }, // 7x7
];

export default function Zip() {
  const [levelIndex, setLevelIndex] = useState(0);
  const level = LEVELS[Math.min(levelIndex, LEVELS.length - 1)];
  
  // Generate puzzle for current level
  const puzzle = useMemo(() => {
    // Use different seeds for variety, but consistent for each level
    const seed = (level.id * 1337) + (level.rows * 31) + (level.cols * 17) + (level.numTargets * 7);
    let attempt = 0;
    let result;
    
    // Try a few times to get a good puzzle
    do {
      result = generatePuzzle(level.rows, level.cols, level.numTargets, seed + attempt);
      attempt++;
    } while (!result.isValid && attempt < 5);
    
    return result;
  }, [level]);
  
  // Convert targets to map for easier lookup
  const targetMap = useMemo(() => {
    const map = new Map();
    puzzle.targets.forEach(([r, c, num]) => {
      map.set(key(r, c), num);
    });
    return map;
  }, [puzzle]);

  const sortedTargets = useMemo(() => {
    return [...puzzle.targets].sort((a, b) => a[2] - b[2]);
  }, [puzzle]);

  const [path, setPath] = useState(() => {
    const firstTarget = sortedTargets[0];
    return [[firstTarget[0], firstTarget[1]]];
  });
  
  // IMPORTANT: nextTargetIdx is the NEXT target number to collect.
  // We start on #1, so the next to collect is #2.
  const [nextTargetIdx, setNextTargetIdx] = useState(2);
  const [showComplete, setShowComplete] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const completionToastShown = useRef(false);

  // Track which targets have been collected
  const collectedTargets = useMemo(() => {
    const collected = new Set();
    for (const [r, c] of path) {
      const k = key(r, c);
      if (targetMap.has(k)) {
        collected.add(targetMap.get(k));
      }
    }
    return collected;
  }, [path, targetMap]);

  // Check if puzzle is complete:
  // - All cells are filled exactly once (enforced by UI interactions)
  // - All numbered targets have been collected in order (enforced by click rules)
  const isComplete = useMemo(() => {
    if (path.length !== level.rows * level.cols) return false;
    return collectedTargets.size === puzzle.targets.length;
  }, [path, level, collectedTargets, puzzle]);

  useEffect(() => {
    if (isComplete && !completionToastShown.current) {
      setShowComplete(true);
      completionToastShown.current = true;
      setTimeout(() => {
        // Hide the completion toast after a short delay; do not auto-advance
        setShowComplete(false);
      }, 2000);
    }
  }, [isComplete]);

  useEffect(() => {
    const firstTarget = sortedTargets[0];
    setPath([[firstTarget[0], firstTarget[1]]]);
    setNextTargetIdx(2); // start on #1, so next is #2
    setShowComplete(false);
    setHintsUsed(0);
    setShowSolution(false);
    completionToastShown.current = false;
  }, [levelIndex, sortedTargets]);

  function handleCellClick(r, c) {
    if (isComplete) return;
    
    const clickedKey = key(r, c);
    const last = path[path.length - 1];
    
    // Check if clicking on an existing path cell to undo
    const existingIndex = path.findIndex(p => p[0] === r && p[1] === c);
    if (existingIndex !== -1 && existingIndex < path.length - 1) {
      // Undo to that point
      const newPath = path.slice(0, existingIndex + 1);
      setPath(newPath);
      
      // Recalculate next target index (next target number to collect)
      let newNextIdx = 1;
      for (let i = 0; i < sortedTargets.length; i++) {
        const [tr, tc] = sortedTargets[i];
        if (newPath.some(p => p[0] === tr && p[1] === tc)) {
          newNextIdx = i + 2; // have target (i+1), so next to collect is (i+2)
        } else {
          break;
        }
      }
      // If only #1 is present, newNextIdx becomes 2; if none, it would be 1 (but start cell is #1).
      setNextTargetIdx(newNextIdx);
      return;
    }
    
    // Check if it's a neighbor of the last cell
    if (!isNeighbor(last, [r, c])) return;
    
    // Check if cell is already in path
    if (path.some(p => p[0] === r && p[1] === c)) return;
    
    // Check if this cell has a target
    if (targetMap.has(clickedKey)) {
      const targetNum = targetMap.get(clickedKey);
      
      // Must collect targets in order
      if (targetNum !== nextTargetIdx) {
        // Can't skip targets
        return;
      }
    }
    
    // Add to path
    const newPath = [...path, [r, c]];
    setPath(newPath);
    
    // Check if we collected a target
    if (targetMap.has(clickedKey) && targetMap.get(clickedKey) === nextTargetIdx) {
      setNextTargetIdx(nextTargetIdx + 1);
    }
  }

  function undo() {
    if (isComplete) return;
    if (path.length <= 1) return;
    
    const removed = path[path.length - 1];
    const removedKey = key(removed[0], removed[1]);
    
    const newPath = path.slice(0, -1);
    setPath(newPath);
    
    // If we removed a target, update the next target index
    if (targetMap.has(removedKey)) {
      const targetNum = targetMap.get(removedKey);
      setNextTargetIdx(targetNum);
    }
  }

  function restart() {
    const firstTarget = sortedTargets[0];
    setPath([[firstTarget[0], firstTarget[1]]]);
    setNextTargetIdx(2); // next to collect is #2
    setShowComplete(false);
    setShowSolution(false);
  }

  function nextLevel() {
    if (levelIndex >= LEVELS.length - 1) return;
    setLevelIndex(levelIndex + 1);
  }

  function prevLevel() {
    if (levelIndex <= 0) return;
    setLevelIndex(levelIndex - 1);
  }

  const getHint = useCallback(() => {
    if (isComplete || hintsUsed >= 3) return null;
    
    const last = path[path.length - 1];
    
    // Find where we are in the solution
    const currentPosInSolution = puzzle.solution.findIndex(
      ([r, c]) => r === last[0] && c === last[1]
    );
    
    if (currentPosInSolution !== -1 && currentPosInSolution < puzzle.solution.length - 1) {
      // Return the next cell in the solution
      return puzzle.solution[currentPosInSolution + 1];
    }
    
    // Fallback: find any valid neighbor
    const neighbors = [];
    const [lr, lc] = last;
    if (lr > 0) neighbors.push([lr - 1, lc]);
    if (lr < level.rows - 1) neighbors.push([lr + 1, lc]);
    if (lc > 0) neighbors.push([lr, lc - 1]);
    if (lc < level.cols - 1) neighbors.push([lr, lc + 1]);
    
    for (const neighbor of neighbors) {
      if (!path.some(p => p[0] === neighbor[0] && p[1] === neighbor[1])) {
        return neighbor;
      }
    }
    
    return null;
  }, [path, puzzle, isComplete, hintsUsed, level]);

  const [hintCell, setHintCell] = useState(null);

  function useHint() {
    if (hintsUsed >= 3) return;
    const hint = getHint();
    if (hint) {
      setHintCell(hint);
      setHintsUsed(hintsUsed + 1);
      setTimeout(() => setHintCell(null), 2000);
    }
  }

  function toggleSolution() {
    setShowSolution(!showSolution);
  }

  const cellSize = Math.min(60, Math.floor(Math.min(window.innerWidth - 100, 500) / Math.max(level.rows, level.cols)));
  const progress = (path.length / (level.rows * level.cols)) * 100;

  // Check if next target is reachable (for debugging)
  const isNextTargetReachable = useMemo(() => {
    // if we've already collected all targets
    if (nextTargetIdx > sortedTargets.length) return true;

    // find by target number, not index
    const nextTarget = sortedTargets.find(([, , num]) => num === nextTargetIdx);
    if (!nextTarget) return true;

    const [targetR, targetC] = nextTarget;
    const visited = new Set(path.map(([r, c]) => key(r, c)));
    const last = path[path.length - 1];
    
    // BFS to check if target is reachable
    const queue = [[last[0], last[1]]];
    const seen = new Set([key(last[0], last[1])]);
    
    while (queue.length > 0) {
      const [r, c] = queue.shift();
      
      if (r === targetR && c === targetC) return true;
      
      const neighbors = [];
      if (r > 0) neighbors.push([r - 1, c]);
      if (r < level.rows - 1) neighbors.push([r + 1, c]);
      if (c > 0) neighbors.push([r, c - 1]);
      if (c < level.cols - 1) neighbors.push([r, c + 1]);
      
      for (const [nr, nc] of neighbors) {
        const k = key(nr, nc);
        if (!visited.has(k) && !seen.has(k)) {
          seen.add(k);
          queue.push([nr, nc]);
        }
      }
    }
    
    return false;
  }, [path, nextTargetIdx, sortedTargets, level]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: 20,
      padding: 20,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: 'transparent',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: 8
      }}>
  <h2 style={{ margin: 0, fontSize: 28, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>Zip Path • Connect the Dots</h2>
        <div style={{ fontSize: 14, color: '#666' }}>
          Level {level.id} • {level.rows}×{level.cols} • {level.numTargets} targets
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        width: level.cols * cellSize + (level.cols - 1) * 2,
        height: 6,
        background: '#e0e0e0',
        borderRadius: 3,
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #4cb3a6, #4a90e2)',
          transition: 'width 0.3s ease'
        }} />
      </div>

      {/* Target Progress */}
      <div style={{ display: 'flex', gap: 8 }}>
        {sortedTargets.map(([r, c, num]) => (
          <div key={num} style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: collectedTargets.has(num) ? '#4cb3a6' : '#e0e0e0',
            color: collectedTargets.has(num) ? 'white' : '#666',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 'bold',
            transition: 'all 0.3s ease'
          }}>
            {num}
          </div>
        ))}
      </div>

      {/* Warning if puzzle is unsolvable (for debugging) */}
      {!isNextTargetReachable && nextTargetIdx <= sortedTargets.length && (
        <div style={{
          padding: '8px 16px',
          background: '#ffebee',
          color: '#c62828',
          borderRadius: 8,
          fontSize: 14
        }}>
          ⚠️ Target {nextTargetIdx} may not be reachable from current position
        </div>
      )}

      {/* Game Board */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${level.cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${level.rows}, ${cellSize}px)`,
        gap: 2,
        padding: 16,
        background: 'white',
        borderRadius: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        position: 'relative'
      }}>
        {Array.from({ length: level.rows }).map((_, r) => (
          Array.from({ length: level.cols }).map((__, c) => {
            const cellKey = key(r, c);
            const pathIndex = path.findIndex(p => p[0] === r && p[1] === c);
            const isInPath = pathIndex !== -1;
            const isTarget = targetMap.has(cellKey);
            const targetNum = targetMap.get(cellKey);
            const isHint = hintCell && hintCell[0] === r && hintCell[1] === c;
            const last = path[path.length - 1];
            const isLast = last[0] === r && last[1] === c;
            const canClick = !isComplete && (isNeighbor(last, [r, c]) || isInPath);
            
            // Show solution overlay
            const solutionIndex = showSolution ? 
              puzzle.solution.findIndex(([sr, sc]) => sr === r && sc === c) : -1;
            const isInSolution = solutionIndex !== -1;
            
            // Color based on path position
            let bgColor = '#f5f5f5';
            if (isInPath) {
              const ratio = pathIndex / Math.max(1, path.length - 1);
              // Gradient from teal to blue
              const red = Math.floor(76 + (74 - 76) * ratio);
              const green = Math.floor(179 + (144 - 179) * ratio);
              const blue = Math.floor(166 + (226 - 166) * ratio);
              bgColor = `rgb(${red}, ${green}, ${blue})`;
            }
            if (isHint) {
              bgColor = '#ffd700';
            }
            if (showSolution && isInSolution && !isInPath) {
              bgColor = 'rgba(255, 215, 0, 0.3)';
            }
            
            return (
              <div
                key={cellKey}
                onClick={() => handleCellClick(r, c)}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canClick ? 'pointer' : 'default',
                  background: bgColor,
                  border: isLast ? '3px solid #333' : 'none',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (canClick && !isInPath) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {isTarget && (
                  <div style={{
                    width: Math.min(36, cellSize * 0.6),
                    height: Math.min(36, cellSize * 0.6),
                    borderRadius: '50%',
                    background: '#2c3e50',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.min(18, cellSize * 0.3),
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    border: collectedTargets.has(targetNum) ? '2px solid #4cb3a6' : 'none'
                  }}>
                    {targetNum}
                  </div>
                )}
                {showSolution && isInSolution && !isTarget && (
                  <div style={{
                    position: 'absolute',
                    fontSize: 10,
                    color: '#999'
                  }}>
                    {solutionIndex + 1}
                  </div>
                )}
              </div>
            );
          })
        ))}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={prevLevel}
          disabled={levelIndex === 0}
          style={{
            padding: '12px 24px',
            fontSize: 16,
            borderRadius: 8,
            border: 'none',
            background: levelIndex > 0 ? '#e0e0e0' : '#f0f0f0',
            color: levelIndex > 0 ? '#333' : '#999',
            cursor: levelIndex > 0 ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease'
          }}
        >
          ← Prev
        </button>
        
        <button
          onClick={undo}
          disabled={path.length <= 1 || isComplete}
          style={{
            padding: '12px 24px',
            fontSize: 16,
            borderRadius: 8,
            border: 'none',
            background: path.length > 1 && !isComplete ? '#e0e0e0' : '#f0f0f0',
            color: path.length > 1 && !isComplete ? '#333' : '#999',
            cursor: path.length > 1 && !isComplete ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease'
          }}
        >
          Undo
        </button>
        
        <button
          onClick={useHint}
          disabled={isComplete || hintsUsed >= 3}
          style={{
            padding: '12px 24px',
            fontSize: 16,
            borderRadius: 8,
            border: 'none',
            background: !isComplete && hintsUsed < 3 ? '#ffe082' : '#f0f0f0',
            color: !isComplete && hintsUsed < 3 ? '#333' : '#999',
            cursor: !isComplete && hintsUsed < 3 ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease'
          }}
        >
          💡 Hint ({3 - hintsUsed})
        </button>
        
        <button
          onClick={restart}
          style={{
            padding: '12px 24px',
            fontSize: 16,
            borderRadius: 8,
            border: 'none',
            background: '#4a90e2',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#357abd';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#4a90e2';
          }}
        >
          🔄 Restart
        </button>
        
        <button
          onClick={nextLevel}
          disabled={!isComplete || levelIndex === LEVELS.length - 1}
          style={{
            padding: '12px 24px',
            fontSize: 16,
            borderRadius: 8,
            border: 'none',
            background: isComplete && levelIndex < LEVELS.length - 1 ? '#4cb3a6' : '#f0f0f0',
            color: isComplete && levelIndex < LEVELS.length - 1 ? 'white' : '#999',
            cursor: isComplete && levelIndex < LEVELS.length - 1 ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease'
          }}
        >
          Next →
        </button>
      </div>

      {/* Debug button (remove in production) */}
      <button
        onClick={toggleSolution}
        style={{
          padding: '8px 16px',
          fontSize: 12,
          borderRadius: 6,
          border: 'none',
          background: '#f0f0f0',
          color: '#666',
          cursor: 'pointer',
          marginTop: -10
        }}
      >
        {showSolution ? 'Hide' : 'Show'} Solution Path
      </button>

      {/* Instructions */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        marginTop: 20,
        padding: 20,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
      }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#333' }}>How to play</h3>
        <div style={{ display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3].map(num => (
                <div key={num} style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#2c3e50',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 'bold'
                }}>
                  {num}
                </div>
              ))}
            </div>
            <span style={{ fontSize: 14, color: '#666' }}>
              Connect the dots in order
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              <div style={{
                width: 24,
                height: 48,
                background: 'linear-gradient(180deg, #4cb3a6, #4a90e2)',
                borderRadius: 4
              }} />
              <div style={{
                width: 24,
                height: 48,
                background: 'linear-gradient(180deg, #4cb3a6, #4a90e2)',
                borderRadius: 4
              }} />
            </div>
            <span style={{ fontSize: 14, color: '#666' }}>
              Fill every cell
            </span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#999', textAlign: 'center', maxWidth: 400 }}>
          Draw a continuous path from 1 to {level.numTargets}, visiting every cell exactly once. 
          Click adjacent cells to extend your path, or click earlier cells to backtrack.
        </div>
      </div>

      {/* Completion Message */}
      {showComplete && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '24px 48px',
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          fontSize: 24,
          fontWeight: 'bold',
          color: '#4cb3a6',
          zIndex: 1000,
          animation: 'fadeIn 0.3s ease'
        }}>
          🎉 Perfect! Level Complete!
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}
