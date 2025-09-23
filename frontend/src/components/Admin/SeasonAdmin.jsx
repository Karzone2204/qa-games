import React, { Suspense, lazy } from "react";
import AdminTabs from "./AdminTabs.jsx";

const SeasonTab = lazy(() => import("./tabs/SeasonTab.jsx"));
const FeaturesTab = lazy(() => import("./tabs/FeaturesTab.jsx"));
const AuthTab = lazy(() => import("./tabs/AuthTab.jsx"));
const UsersTab = lazy(() => import("./tabs/UsersTab.jsx"));

export default function SeasonAdmin(){
  const tabs = [
    { key: 'season', title: 'Season', render: () => (
      <Suspense fallback={<div>Loading season…</div>}><SeasonTab /></Suspense>
    )},
    { key: 'features', title: 'Features', render: ({ onDirtyChange }) => (
      <Suspense fallback={<div>Loading features…</div>}><FeaturesTab onDirtyChange={onDirtyChange} /></Suspense>
    )},
    { key: 'auth', title: 'Auth', render: () => (
      <Suspense fallback={<div>Loading auth…</div>}><AuthTab /></Suspense>
    )},
    { key: 'users', title: 'Users', render: () => (
      <Suspense fallback={<div>Loading users…</div>}><UsersTab /></Suspense>
    )},
  ];

  return (
    <div style={{maxWidth:980, margin:"20px auto", padding:16, background:"rgba(255,255,255,0.06)", borderRadius:16}}>
      <AdminTabs tabs={tabs} initialKey="season" />
    </div>
  );
}

