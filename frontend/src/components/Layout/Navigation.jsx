import React from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";

export default function Navigation({ section, setSection, features }) {
  const { user } = useAuth();

  const tabs = [
    { id: "games",        label: "🎮 Games" },
    { id: "tournament",   label: "🏆 Tournament" },
    { id: "season",       label: "📊 Season Stats" },
    { id: "achievements", label: "🌟 Achievements" },
  ];
  if (user && (user.role === 'admin' || features?.enableQATools)) tabs.push({ id: "qa", label: "🧪 QA Tools" });
  if (user?.role === 'admin') tabs.push({ id: "admin", label: "🛠️ Admin" });

  return (
    <div className="nav-tabs">
      {tabs.map(t => (
        <div
          key={t.id}
          className={`nav-tab ${section === t.id ? "active" : ""}`}
          onClick={() => setSection(t.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setSection(t.id)}
        >
          {t.label}
        </div>
      ))}
    </div>
  );
}
