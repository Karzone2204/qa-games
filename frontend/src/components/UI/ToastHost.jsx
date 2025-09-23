import React, { useEffect, useState } from "react";

export default function ToastHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    function onToast(e) {
      const id = Math.random().toString(36).slice(2);
      const { message, duration = 3000, type = 'default' } = e.detail || {};
      setItems((x) => [...x, { id, message, type }]);
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), duration);
    }
    window.addEventListener("toast", onToast);
    return () => window.removeEventListener("toast", onToast);
  }, []);

  return (
    <div className="toast-container">
      {items.map((t) => (
        <div className={`toast toast-${t.type}`} key={t.id}>{t.message}</div>
      ))}
    </div>
  );
}
