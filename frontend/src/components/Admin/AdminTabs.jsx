import React, { useCallback, useEffect, useMemo, useState } from "react";

export default function AdminTabs({ tabs, initialKey }){
  const keys = useMemo(() => tabs.map(t => t.key), [tabs]);
  const [active, setActive] = useState(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("tab");
    return keys.includes(t) ? t : (initialKey || tabs[0]?.key);
  });
  const [dirtyMap, setDirtyMap] = useState({});

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", active);
    window.history.replaceState({}, "", url.toString());
  }, [active]);

  const onDirtyChange = useCallback((key, dirty) => {
    setDirtyMap(m => (m[key] === dirty ? m : { ...m, [key]: !!dirty }));
  }, []);

  const tryChange = useCallback((nextKey) => {
    if (nextKey === active) return;
    if (dirtyMap[active]) {
      const ok = window.confirm("You have unsaved changes on this tab. Switch and discard changes?");
      if (!ok) return;
    }
    setActive(nextKey);
  }, [active, dirtyMap]);

  const activeTab = tabs.find(t => t.key === active) || tabs[0];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.18)', marginBottom: 12, overflowX:'auto' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => tryChange(t.key)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              background: t.key === active ? 'rgba(255,255,255,0.12)' : 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              position: 'relative'
            }}
            title={dirtyMap[t.key] ? 'Unsaved changes' : ''}
          >
            {t.title}
            {dirtyMap[t.key] ? (
              <span style={{ position: 'absolute', top: 2, right: 4, width: 8, height: 8, borderRadius: 8, background: '#f59e0b' }} />
            ) : null}
          </button>
        ))}
      </div>
      <div>
        {activeTab.render({ onDirtyChange: (dirty) => onDirtyChange(activeTab.key, dirty) })}
      </div>
    </div>
  );
}
