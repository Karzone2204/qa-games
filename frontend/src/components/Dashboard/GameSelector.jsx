import React, { useRef } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";

const games = [
  { id: "trainBrain", icon: "🧬", title: "Train The Brain", subtitle: "Visual memory!" },
  { id: "memory",     icon: "🧠", title: "Memory Match", subtitle: "Test your memory!" },
  { id: "miniSudoku", icon: "🧮", title: "Mini Sudoku",   subtitle: "4x4 quick play" },
  { id: "cutFruit",   icon: "🍉", title: "Cut the Fruit", subtitle: "Slice, avoid bombs!" },
  { id: "zip", icon: "🧵", title: "Zip Path", subtitle: "Complete the route" },
  { id: "rps", icon: "✊", title: "Rock • Paper • Scissors", subtitle: "Bot or online", online: true },
  { id: "bugSmasher", icon: "🐛", title: "Bug Smasher",    subtitle: "Squash the bugs!" },
  { id: "typeRacer",  icon: "⌨️", title: "TypeRacer",     subtitle: "Bot or online", online: true },
  { id: "tictactoe",  icon: "❌", title: "Tic Tac Toe",   subtitle: "Bot or online", online: true },
  { id: "sudoku",     icon: "🔢", title: "Sudoku Master",  subtitle: "Number puzzle!" },
  { id: "wordScram",  icon: "🧩", title: "Word Scramble", subtitle: "Unscramble words!" },
  { id: "mathSprint", icon: "➗", title: "Math Sprint",    subtitle: "Solve fast!" },
];

export default function GameSelector({ selected, onSelect, openAuth }) {
  const { user } = useAuth();
  const scroller = useRef(null);

  function handlePick(id){
    if (!user) return openAuth?.("login");
    onSelect(id);
  }

  const scrollBy = (dx) => {
    if (!scroller.current) return;
    scroller.current.scrollBy({ left: dx, behavior: "smooth" });
  };

  return (
    <div className="games-carousel-wrap">
      <button className="carousel-arrow left" onClick={() => scrollBy(-400)} aria-label="Scroll left">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18L9 12l6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <div className="games-carousel" ref={scroller}>
        {games.map((c) => (
          <div
            key={c.id}
            className={`game-card ${selected === c.id ? "active" : ""}`}
            onClick={() => handlePick(c.id)}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handlePick(c.id)}
            style={{ position: 'relative' }}
          >
            {c.online && (
              <span
                title="Online supported"
                aria-label="Online supported"
                style={{ position:'absolute', top:10, right:10, width:8, height:8, borderRadius:999, background:'#30d158', boxShadow:'0 0 0 2px rgba(255,255,255,0.9)' }}
              />
            )}
            <div className="game-icon">{c.icon}</div>
            <h3>{c.title}</h3>
            <p>{c.subtitle}</p>
          </div>
        ))}
      </div>
      <button className="carousel-arrow right" onClick={() => scrollBy(400)} aria-label="Scroll right">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}
