import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./contexts/AuthContext.jsx";
import { api } from "./services/api.js";

import Header from "./components/Layout/Header.jsx";
import Navigation from "./components/Layout/Navigation.jsx";
import UserMenu from "./components/Layout/UserMenu.jsx";

import GameSelector from "./components/Dashboard/GameSelector.jsx";
import BugSmasher from "./components/Games/BugSmasher.jsx";
import Memory from "./components/Games/Memory.jsx";
import Sudoku from "./components/Games/Sudoku.jsx";
import MiniSudoku from "./components/Games/MiniSudoku.jsx";
import TicTacToe from "./components/Games/TicTacToe.jsx";
import TypeRacer from "./components/Games/TypeRacer.jsx";
import MathSprint from "./components/Games/MathSprint.jsx";
import WordScramble from "./components/Games/WordScramble.jsx";
import TrainTheBrain from "./components/Games/TrainTheBrain.jsx";
import RPS from "./components/Games/RPS.jsx";
import Zip from "./components/Games/Zip.jsx";
import CutTheFruit from "./components/Games/CutTheFruit.jsx";

import QAToolsHub from "./components/QATools/QAToolsHub.jsx";
import LoginGate from "./components/Auth/LoginGate.jsx";

import AuthModal from "./components/Auth/AuthModal.jsx";
import ResetPasswordModal from "./components/Auth/ResetPasswordModal.jsx";
import AuthLanding from "./components/Auth/AuthLanding.jsx";
import BackgroundAura from "./components/Layout/BackgroundAura.jsx";
import ChatWidget from "./components/Games/ChatWidget.jsx";
import OnlineWidget from "./components/UI/OnlineWidget.jsx";
import SeasonStats from "./components/Dashboard/SeasonStats.jsx";
import Achievements from "./components/Dashboard/Achievements.jsx";
import TournamentView from "./components/Dashboard/Tournament.jsx";
import SeasonAdmin from "./components/Admin/SeasonAdmin.jsx";
import ToastHost from "./components/UI/ToastHost.jsx";
import { toast } from "./services/toast.js";

function GamesSection({ selected, setSelected, openAuth }) {
  return (
    <div id="games" className="content-section active">
      <GameSelector selected={selected} onSelect={setSelected} openAuth={openAuth} />
      <div style={{ marginTop: 20 }}>
        {selected === "bugSmasher" && <BugSmasher />}
        {selected === "memory" && <Memory />}
        {selected === "sudoku" && <Sudoku />}
  {selected === "miniSudoku" && <MiniSudoku />}
        {selected === "tictactoe" && <TicTacToe />}
        {selected === "typeRacer" && <TypeRacer />}
        {selected === "mathSprint" && <MathSprint />}
        {selected === "wordScram" && <WordScramble />}
        {selected === "trainBrain" && <TrainTheBrain />}
        {selected === "rps" && <RPS />}
        {selected === "zip" && <Zip />}
        {selected === "cutFruit" && <CutTheFruit />}
      </div>
    </div>
  );
}

export default function App() {
  const { user, justLoggedOut, clearJustLoggedOut } = useAuth(); // safe now because provider wraps App in index.jsx
  const [section, setSection] = useState("games");
  const [selectedGame, setSelectedGame] = useState(null);
  const [features, setFeatures] = useState({ enableQATools:false, enableChatbot:false });
  function handleSetSection(next){
    setSection(next);
  }

  const [authOpen, setAuthOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState("login");
  const openAuth = (tab = "login") => { setAuthDefaultTab(tab); setAuthOpen(true); };
  const socketRef = useRef(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  // no separate verify modal; we show toast + open login

  // Process reset/verify URL tokens on app load
  useEffect(() => {
    const url = new URL(window.location.href);
    const resetTok = url.searchParams.get('resetToken');
    const verifyTok = url.searchParams.get('verifyToken');
    const paramEmail = url.searchParams.get('email');
    const base = new URL(window.location.href);
    base.searchParams.delete('resetToken');
    base.searchParams.delete('verifyToken');
    base.searchParams.delete('email');

    async function doVerify(email, token){
      try {
        const RAW = import.meta.env.VITE_API_BASE || "";
  const BASE = (RAW||"").replace(/\/+$/,"");
        const r = await fetch(`${BASE}/auth/verify`, {
          method:'POST', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ email, token })
        });
        const data = await r.json().catch(()=>({}));
        if (r.ok && data.ok) {
          try { localStorage.setItem('lastEmail', email); } catch {}
          toast.success('Email confirmed. Please log in.');
          openAuth('login');
        } else {
          toast.error(data.error || 'Verification failed');
        }
      } catch {
        toast.error('Verification failed');
      }
    }

    (async () => {
      if (verifyTok && paramEmail){ await doVerify(paramEmail, verifyTok); }
      if (resetTok && paramEmail){ setResetEmail(paramEmail); setResetToken(resetTok); setResetOpen(true); }
      // clean URL after processing
      if (verifyTok || resetTok){ window.history.replaceState({}, document.title, base.toString()); }
    })();
  }, []);
  // react to accepted invites and route into games
  useEffect(() => {
    function onAccept(e){
      const { game, code } = e.detail || {};
      if (!game || !code) return;
      // ensure we are on games section
      handleSetSection('games');
      // select appropriate game
      const map = { rps:'rps', tictactoe:'tictactoe', typeracer:'typeRacer' };
      const sel = map[game]; if (!sel) return;
      setSelectedGame(sel);
      // give component time to mount, then tell it to join
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('qa:invite:join', { detail: { game: sel, code } }));
      }, 50);
    }
    window.addEventListener('qa:invite:accept', onAccept);
    function onPeerAccepted(e){ onAccept(e); }
    window.addEventListener('qa:invite:peer-accepted', onPeerAccepted);
    return () => {
      window.removeEventListener('qa:invite:accept', onAccept);
      window.removeEventListener('qa:invite:peer-accepted', onPeerAccepted);
    };
  }, []);

  // Wire a singleton socket to emit area/game so OnlineWidget stays minimal
  useEffect(() => {
    let onLocalScore = null;
    (async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      const { io } = await import("https://cdn.socket.io/4.7.5/socket.io.esm.min.js");
      const RAW = import.meta.env.VITE_API_BASE || "";
      const BASE = (RAW || "").replace(/\/+$/, "");
      const url = BASE || `${location.protocol}//${location.hostname}:4000`;
      const s = io(url, { transports:["websocket"], auth: { token } });
      socketRef.current = s;
      // forward local score events to peers and refetch listeners
      onLocalScore = (e) => {
        const detail = e?.detail || {};
        try { s.emit('score:new', detail); } catch {}
        // also notify local listeners that a refresh is needed
        window.dispatchEvent(new CustomEvent('qa:score:refresh', { detail }));
      };
      window.addEventListener('qa:score:new', onLocalScore);
      // when others submit, server broadcasts score:refresh
      s.on('score:refresh', (payload) => {
        window.dispatchEvent(new CustomEvent('qa:score:refresh', { detail: payload }));
      });
    })();
    return () => {
      if (socketRef.current){ try { socketRef.current.disconnect(); } catch {}
        socketRef.current = null; }
      if (onLocalScore) window.removeEventListener('qa:score:new', onLocalScore);
    };
  }, []);

  // Allow other components to navigate to a specific game (e.g., Tournament Play)
  useEffect(() => {
    function onNavGame(e){
      const game = e?.detail?.game;
      if (!game) return;
      handleSetSection('games');
      setSelectedGame(game);
    }
    window.addEventListener('qa:navigate:game', onNavGame);
    return () => window.removeEventListener('qa:navigate:game', onNavGame);
  }, []);

  useEffect(() => {
    const s = socketRef.current;
    if (!s || !s.connected) return;
    if (section === "games"){
      s.emit("presence:game", selectedGame || null);
      if (!selectedGame) s.emit("presence:area", "Games");
    } else if (section === "qa"){
      s.emit("presence:area", "QA Tools");
      s.emit("presence:game", null);
    } else if (section === "tournament"){
      s.emit("presence:area", "Tournament");
      s.emit("presence:game", null);
    } else if (section === "season"){
      s.emit("presence:area", "Season Stats");
      s.emit("presence:game", null);
    } else if (section === "achievements"){
      s.emit("presence:area", "Achievements");
      s.emit("presence:game", null);
    } else {
      s.emit("presence:area", null);
      s.emit("presence:game", null);
    }
  }, [section, selectedGame]);

  // Load feature flags for non-admin users (admins always see everything)
  useEffect(() => {
    (async () => {
      if (!user) return;
      if (user.role === 'admin') { setFeatures({ enableQATools:true, enableChatbot:true }); return; }
      const f = await fetch((import.meta.env.VITE_API_BASE||"").replace(/\/+$/,'') + "/api/features", { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r=>r.json()).catch(()=>null);
      if (f && typeof f.enableQATools === 'boolean' && typeof f.enableChatbot === 'boolean') setFeatures(f);
    })();
  }, [user?.email]);

  // If not logged in, show dedicated landing overlay (hides rest of app options)
  if (!user) {
    return (
      <>
        <AuthLanding openAuth={openAuth} justLoggedOutMessage={justLoggedOut? 'You have been logged out.' : null} />
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authDefaultTab} />
        <ResetPasswordModal
            open={resetOpen}
            email={resetEmail}
            token={resetToken}
            onClose={()=> setResetOpen(false)}
            onSuccess={()=> { toast.success('Password updated. Please log in.'); setResetOpen(false); openAuth('login'); }}
          />
        <ToastHost />
      </>
    );
  }

  return (
    <>
      <BackgroundAura />
      <div style={{position:'relative', zIndex:1}}>
  <Header />
  <Navigation section={section} setSection={handleSetSection} features={features} />
        <UserMenu openAuth={openAuth} />

      {section === "games" && (
        <GamesSection selected={selectedGame} setSelected={setSelectedGame} openAuth={openAuth} />
      )}

      {section === "tournament" && (
        <div id="tournament" className="content-section active">
          <TournamentView />
        </div>
      )}

      {section === "season" && (
        <div id="season" className="content-section active">
          <SeasonStats />
        </div>
      )}

      {section === "achievements" && (
        <div id="achievements" className="content-section active">
          <Achievements />
        </div>
      )}

  {section === "qa" && ((user && (user.role==='admin' || features.enableQATools)) ? <QAToolsHub /> : null)}

  {section === "admin" && (user?.role === 'admin' ? <SeasonAdmin /> : null)}

  <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authDefaultTab} />
  <ResetPasswordModal
    open={resetOpen}
    email={resetEmail}
    token={resetToken}
    onClose={()=> setResetOpen(false)}
    onSuccess={()=> { toast.success('Password updated. Please log in.'); setResetOpen(false); openAuth('login'); }}
  />
  {(user?.role==='admin' || features.enableChatbot) ? <ChatWidget /> : null}
  <OnlineWidget currentGame={selectedGame} />
        <ToastHost />
      </div>
    </>
  );
}
