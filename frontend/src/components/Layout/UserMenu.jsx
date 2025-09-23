import React from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { toast } from "../../services/toast.js";

export default function UserMenu({ openAuth }) {
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    const msgs = [
      "You’re out! Come back for more bug-smashing 🐛✨",
      "Logged out. The tournament awaits your return 🏆",
      "See you soon, champ! 🎮",
      "Session ended. The QA Bot will miss you 🤖💬",
    ];
    toast(msgs[Math.floor(Math.random() * msgs.length)]);
  }

  return (
    <div className="top-right-auth">
      {!user ? (
        <>
          <button onClick={() => openAuth?.("signup")} style={{ marginRight: 8 }}>Sign Up</button>
          <button onClick={() => openAuth?.("login")}>Login</button>
        </>
      ) : (
        <>
          <span className="user-chip">👋 {user.name} <small>({user.role})</small></span>
          <button onClick={handleLogout} style={{ marginLeft: 8 }}>Logout</button>
        </>
      )}
    </div>
  );
}
