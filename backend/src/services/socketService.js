import jwt from "jsonwebtoken";
import { jwtConfig, allowedEmailDomain } from "../config/auth.js";

function isAllowedDomainEmail(email){
  const domain = (email?.split("@")[1] || "").toLowerCase();
  const allowed = (allowedEmailDomain || "").toLowerCase();
  if (!domain || !allowed) return false;
  return domain === allowed || domain.endsWith(`.${allowed}`);
}

const presence = new Map(); // userId -> { id, name, game, area, count }

export function initSocket(io){
  // Auth middleware for Socket.IO
  io.use((socket, next) => {
    try{
      const token = socket.handshake.auth?.token || (socket.handshake.headers?.authorization || "").replace(/^Bearer\s+/i, "");
      if (!token) return next(new Error("Missing token"));
      const payload = jwt.verify(token, jwtConfig.secret);
      if (!isAllowedDomainEmail(payload.email)) return next(new Error("Email domain not allowed"));
      socket.user = { id: payload.id, name: payload.name, email: payload.email, role: payload.role };
      next();
    } catch(err){
      next(new Error("Invalid token"));
    }
  });

  function broadcastPresence(){
    const list = Array.from(presence.values()).map(({ id, name, game, area }) => ({ id, name, game: game || null, area: area || null }));
    io.emit("presence:update", list);
  }

  io.on("connection", (socket) => {
    const u = socket.user;
    // Join personal room for direct messages (invites)
    try { socket.join(`user:${u.id}`); } catch {}
  let entry = presence.get(u.id) || { id: u.id, name: u.name, game: null, area: null, count: 0 };
    entry.count += 1;
    entry.name = u.name; // keep latest name
    presence.set(u.id, entry);
    broadcastPresence();

    socket.on("presence:game", (gameKey) => {
      const e = presence.get(u.id);
      if (!e) return;
      e.game = gameKey || null;
      if (e.game) e.area = null; // playing overrides area
      presence.set(u.id, e);
      broadcastPresence();
    });

    socket.on("presence:area", (areaKey) => {
      const e = presence.get(u.id);
      if (!e) return;
      e.area = areaKey || null;
      if (e.area) e.game = null; // area overrides game when not playing
      presence.set(u.id, e);
      broadcastPresence();
    });

    socket.on("disconnect", () => {
      const e = presence.get(u.id);
      if (!e) return;
      e.count -= 1;
      if (e.count <= 0){ presence.delete(u.id); } else { presence.set(u.id, e); }
      broadcastPresence();
    });

    // Existing score sharing
    socket.on("score:new", (payload) => socket.broadcast.emit("score:refresh", payload));

    // --- Rock-Paper-Scissors (online) ---
    const rpsRooms = io._rpsRooms || (io._rpsRooms = new Map()); // code -> room

    function codeGen(){
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let out = ""; for(let i=0;i<4;i++) out += alphabet[Math.floor(Math.random()*alphabet.length)];
      return out;
    }
    function choiceWinner(a,b){
      if (a===b) return 0; // draw
      if ((a==="rock"&&b==="scissors")||(a==="paper"&&b==="rock")||(a==="scissors"&&b==="paper")) return 1;
      return 2;
    }
    function bestOfToWin(best){ return Math.floor(best/2)+1; }
    function summarize(room){
      const players = Array.from(room.players.values()).map(p=>({ id:p.id, name:p.name, score:p.score, picked: !!p.choice }));
      const hiddenChoices = room.reveal ? Object.fromEntries(Array.from(room.players.entries()).map(([id,p])=>[id, p.choice])) : null;
      return { code: room.code, bestOf: room.bestOf, round: room.round, status: room.status, players, reveal: room.reveal||null, choices: hiddenChoices };
    }

    socket.on('rps:create', ({ bestOf=5 } = {}) => {
      const me = socket.user;
      let code;
      do { code = codeGen(); } while (rpsRooms.has(code));
      const room = {
        code,
        bestOf: Math.max(1, Math.min(9, bestOf|0)),
        round: 1,
        status: 'waiting',
        players: new Map(), // id -> {id,name,socketId,choice,score}
        reveal: null
      };
      room.players.set(me.id, { id: me.id, name: me.name, socketId: socket.id, choice: null, score: 0 });
      rpsRooms.set(code, room);
      socket.join(`rps:${code}`);
      socket.data.rpsCode = code;
      io.to(`rps:${code}`).emit('rps:state', summarize(room));
    });

    socket.on('rps:join', ({ code } = {}) => {
      const me = socket.user; code = String(code||'').toUpperCase();
      const room = rpsRooms.get(code);
      if (!room) return socket.emit('rps:error', { error:'room_not_found' });
      // idempotent rejoin: if already a player, just bind this socket and re-emit state
      if (room.players.has(me.id)){
        const p = room.players.get(me.id); p.socketId = socket.id; room.players.set(me.id, p);
        socket.join(`rps:${code}`); socket.data.rpsCode = code;
        io.to(`rps:${code}`).emit('rps:state', summarize(room));
        return;
      }
      if (room.players.size >= 2) return socket.emit('rps:error', { error:'room_full' });
      room.players.set(me.id, { id: me.id, name: me.name, socketId: socket.id, choice: null, score: 0 });
      room.status = 'playing';
      socket.join(`rps:${code}`);
      socket.data.rpsCode = code;
      io.to(`rps:${code}`).emit('rps:state', summarize(room));
    });

    socket.on('rps:leave', () => {
      const code = socket.data.rpsCode; if (!code) return;
      const room = rpsRooms.get(code); if (!room) return;
      const leaver = { id: socket.user.id, name: socket.user.name };
      room.players.delete(socket.user.id);
      socket.leave(`rps:${code}`); socket.data.rpsCode = null;
      if (room.players.size === 0){ rpsRooms.delete(code); return; }
      try { io.to(`rps:${code}`).emit('rps:peer_left', leaver); } catch {}
      room.status = 'waiting'; room.round = 1; room.reveal = null;
      for (const p of room.players.values()){ p.choice = null; p.score = 0; }
      io.to(`rps:${code}`).emit('rps:state', summarize(room));
    });

    socket.on('rps:choose', ({ choice } = {}) => {
      const code = socket.data.rpsCode; if (!code) return;
      const room = rpsRooms.get(code); if (!room) return;
      const me = room.players.get(socket.user.id); if (!me) return;
      if (!['rock','paper','scissors'].includes(choice)) return;
      if (room.status !== 'playing') return;
      if (me.choice) return; // already picked this round
      me.choice = choice;
      const others = Array.from(room.players.values()).filter(p=>p.id!==me.id);
      if (others.length === 1){
        const op = others[0];
        if (op.choice){
          // resolve round
          const res = choiceWinner(me.choice, op.choice);
          let winner = null; if (res===1) winner = me.id; if (res===2) winner = op.id;
          if (winner){ room.players.get(winner).score += 1; }
          const winnerName = winner ? (room.players.get(winner)?.name || null) : null;
          room.reveal = { winner: winner, winnerName, draw: res===0, round: room.round };
          io.to(`rps:${code}`).emit('rps:state', summarize(room));
          // next round setup
          const toWin = bestOfToWin(room.bestOf);
          const scores = Array.from(room.players.values()).map(p=>p.score);
          const finished = scores.some(s=> s>=toWin);
          if (finished){
            room.status = 'finished';
            io.to(`rps:${code}`).emit('rps:state', summarize(room));
          } else {
            setTimeout(() => {
              const r = rpsRooms.get(code); if (!r) return;
              for (const p of r.players.values()) p.choice = null;
              r.round += 1; r.reveal = null;
              io.to(`rps:${code}`).emit('rps:state', summarize(r));
            }, 900);
          }
        } else {
          // waiting for opponent
          io.to(`rps:${code}`).emit('rps:state', summarize(room));
        }
      } else {
        // solo in room
        io.to(`rps:${code}`).emit('rps:state', summarize(room));
      }
    });

    socket.on('rps:rematch', () => {
      const code = socket.data.rpsCode; if (!code) return;
      const room = rpsRooms.get(code); if (!room) return;
      if (room.players.size < 1) return;
      for (const p of room.players.values()){ p.choice = null; p.score = 0; }
      room.round = 1;
      room.status = room.players.size >= 2 ? 'playing' : 'waiting';
      room.reveal = null;
      io.to(`rps:${code}`).emit('rps:state', summarize(room));
    });

    socket.on('disconnect', () => {
      const code = socket.data.rpsCode; if (!code) return;
      const room = rpsRooms.get(code); if (!room) return;
      const leaver = { id: socket.user.id, name: socket.user.name };
      room.players.delete(socket.user.id);
      if (room.players.size === 0){ rpsRooms.delete(code); }
      else {
        room.status = 'waiting'; room.round = 1; room.reveal = null; for (const p of room.players.values()){ p.choice=null; p.score=0; }
        try { io.to(`rps:${code}`).emit('rps:peer_left', leaver); } catch {}
        io.to(`rps:${code}`).emit('rps:state', summarize(room));
      }
    });

    // --- TicTacToe online ---
    const tttRooms = io._tttRooms || (io._tttRooms = new Map()); // code -> room
    function tttCode(){ return 'T' + Math.random().toString(36).slice(2,6).toUpperCase(); }
    function tttWinner(board){
      const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      for (const [a,b,c] of L){ if (board[a] && board[a]===board[b] && board[a]===board[c]) return board[a]; }
      return null;
    }
    function tttSummary(room){
      const players = Array.from(room.players.values()).map(p=>({ id:p.id, name:p.name, symbol:p.symbol }));
      const turnId = Array.from(room.players.values()).find(p=>p.symbol===room.turn)?.id || null;
      const winnerName = room.winner ? (room.players.get(room.winner)?.name || null) : null;
      return { code: room.code, board: room.board, turn: turnId, status: room.status, winner: room.winner||null, winnerName, draw: room.draw||false, players };
    }
    socket.on('ttt:create', () => {
      const code = tttCode();
      const room = { code, players: new Map(), board: Array(9).fill(null), turn: 'X', status: 'waiting', winner: null, draw: false };
      room.players.set(socket.user.id, { id: socket.user.id, name: socket.user.name, socketId: socket.id, symbol: 'X' });
      tttRooms.set(code, room); socket.join(`ttt:${code}`); socket.data.tttCode = code;
      io.to(`ttt:${code}`).emit('ttt:state', tttSummary(room));
    });
    socket.on('ttt:join', ({ code }={}) => {
      code = String(code||'').toUpperCase(); const room = tttRooms.get(code);
      if (!room) return socket.emit('ttt:error',{error:'room_not_found'});
      // idempotent rejoin: if already a player, bind socket and emit state
      if (room.players.has(socket.user.id)){
        const p = room.players.get(socket.user.id); p.socketId = socket.id; room.players.set(socket.user.id, p);
        socket.join(`ttt:${code}`); socket.data.tttCode = code; io.to(`ttt:${code}`).emit('ttt:state', tttSummary(room));
        return;
      }
      if (room.players.size>=2) return socket.emit('ttt:error',{error:'room_full'});
      room.players.set(socket.user.id, { id: socket.user.id, name: socket.user.name, socketId: socket.id, symbol: 'O' });
      room.status = 'playing'; socket.join(`ttt:${code}`); socket.data.tttCode = code;
      io.to(`ttt:${code}`).emit('ttt:state', tttSummary(room));
    });
    socket.on('ttt:move', ({ index }={}) => {
      const code = socket.data.tttCode; if (!code) return;
      const room = tttRooms.get(code); if (!room) return;
      if (room.status!== 'playing') return;
      if (typeof index !== 'number' || index<0 || index>8) return;
      const p = room.players.get(socket.user.id); if (!p) return;
      if (p.symbol !== room.turn) return;
      if (room.board[index]) return;
      room.board[index] = p.symbol;
      const w = tttWinner(room.board);
      if (w){ room.status='finished'; room.winner = Array.from(room.players.values()).find(pl=>pl.symbol===w)?.id || null; room.draw=false; }
      else if (room.board.every(Boolean)){ room.status='finished'; room.draw=true; room.winner=null; }
      else { room.turn = room.turn === 'X' ? 'O' : 'X'; }
      io.to(`ttt:${code}`).emit('ttt:state', tttSummary(room));
    });
    socket.on('ttt:rematch', () => {
      const code = socket.data.tttCode; if (!code) return; const room = tttRooms.get(code); if (!room) return;
      room.board = Array(9).fill(null); room.turn = 'X'; room.status = room.players.size>=2? 'playing':'waiting'; room.winner=null; room.draw=false;
      io.to(`ttt:${code}`).emit('ttt:state', tttSummary(room));
    });
    socket.on('ttt:leave', () => {
      const code = socket.data.tttCode; if (!code) return; const room = tttRooms.get(code); if (!room) return;
      const leaver = { id: socket.user.id, name: socket.user.name };
      room.players.delete(socket.user.id); socket.leave(`ttt:${code}`); socket.data.tttCode=null;
      if (room.players.size===0){ tttRooms.delete(code); return; }
      try { io.to(`ttt:${code}`).emit('ttt:peer_left', leaver); } catch {}
      room.status='waiting'; room.board=Array(9).fill(null); room.turn='X'; room.winner=null; room.draw=false;
      io.to(`ttt:${code}`).emit('ttt:state', tttSummary(room));
    });

    // cleanup on disconnect for ttt
    socket.on('disconnect', () => {
      const code = socket.data.tttCode; if (!code) return; const room = tttRooms.get(code); if (!room) return;
      const leaver = { id: socket.user.id, name: socket.user.name };
      room.players.delete(socket.user.id);
      if (room.players.size===0){ tttRooms.delete(code); }
      else { room.status='waiting'; room.board=Array(9).fill(null); room.turn='X'; room.winner=null; room.draw=false; try { io.to(`ttt:${code}`).emit('ttt:peer_left', leaver); } catch {} io.to(`ttt:${code}`).emit('ttt:state', tttSummary(room)); }
    });

    // --- TypeRacer online ---
    const typerRooms = io._typerRooms || (io._typerRooms = new Map());
    const QUOTES = [
      "Quality is not an act it is a habit.",
      "Bugs are just misunderstood features.",
      "Test early test often test automatically.",
      "If it is not tested it is broken.",
      "Move fast but do not break production.",
    ];
    function pickQuote(){ return QUOTES[Math.floor(Math.random()*QUOTES.length)]; }
    function typerSummary(room){
      const players = Array.from(room.players.values()).map(p=>({ id:p.id, name:p.name, progress:p.progress, finished:p.finished }));
      const winnerName = room.winner ? (room.players.get(room.winner)?.name || null) : null;
      return { code: room.code, text: room.text, status: room.status, players, winner: room.winner||null, winnerName };
    }
    function typerCode(){ return 'R' + Math.random().toString(36).slice(2,6).toUpperCase(); }
    socket.on('type:create', () => {
      const code = typerCode();
      const room = { code, text: pickQuote(), status:'waiting', players:new Map(), winner:null };
      room.players.set(socket.user.id, { id: socket.user.id, name: socket.user.name, socketId: socket.id, progress:0, finished:false });
      typerRooms.set(code, room); socket.join(`typer:${code}`); socket.data.typerCode=code;
      io.to(`typer:${code}`).emit('type:state', typerSummary(room));
    });
    socket.on('type:join', ({ code }={}) => {
      code = String(code||'').toUpperCase(); const room = typerRooms.get(code);
      if (!room) return socket.emit('type:error', { error:'room_not_found' });
      // idempotent rejoin: if already a player, bind socket and emit state
      if (room.players.has(socket.user.id)){
        const p = room.players.get(socket.user.id); p.socketId = socket.id; room.players.set(socket.user.id, p);
        socket.join(`typer:${code}`); socket.data.typerCode=code; io.to(`typer:${code}`).emit('type:state', typerSummary(room));
        return;
      }
      if (room.players.size>=2) return socket.emit('type:error',{ error:'room_full' });
      room.players.set(socket.user.id, { id: socket.user.id, name: socket.user.name, socketId: socket.id, progress:0, finished:false });
      room.status = 'ready'; socket.join(`typer:${code}`); socket.data.typerCode=code;
      io.to(`typer:${code}`).emit('type:state', typerSummary(room));
    });
    socket.on('type:start', () => {
      const code = socket.data.typerCode; if (!code) return; const room = typerRooms.get(code); if (!room) return;
      if (room.players.size<2) return; room.status='playing'; for(const p of room.players.values()){ p.progress=0; p.finished=false; }
      io.to(`typer:${code}`).emit('type:state', typerSummary(room));
    });
    socket.on('type:progress', ({ progress }={}) => {
      const code = socket.data.typerCode; if (!code) return; const room = typerRooms.get(code); if (!room) return;
      const p = room.players.get(socket.user.id); if (!p) return; if (room.status!=='playing') return;
      const len = room.text.length; p.progress = Math.max(0, Math.min(progress|0, len));
      io.to(`typer:${code}`).emit('type:state', typerSummary(room));
    });
    socket.on('type:finish', () => {
      const code = socket.data.typerCode; if (!code) return; const room = typerRooms.get(code); if (!room) return;
      const p = room.players.get(socket.user.id); if (!p) return; if (room.status!=='playing') return;
      p.finished = true; p.progress = room.text.length;
      if (!room.winner){ room.winner = p.id; room.status = 'finished'; }
      io.to(`typer:${code}`).emit('type:state', typerSummary(room));
    });
    socket.on('type:rematch', () => {
      const code = socket.data.typerCode; if (!code) return; const room = typerRooms.get(code); if (!room) return;
      room.text = pickQuote(); room.winner=null; room.status = room.players.size>=2? 'ready':'waiting';
      for (const p of room.players.values()){ p.progress=0; p.finished=false; }
      io.to(`typer:${code}`).emit('type:state', typerSummary(room));
    });
    socket.on('type:leave', () => {
      const code = socket.data.typerCode; if (!code) return; const room = typerRooms.get(code); if (!room) return;
      const leaver = { id: socket.user.id, name: socket.user.name };
      room.players.delete(socket.user.id); socket.leave(`typer:${code}`); socket.data.typerCode=null;
      if (room.players.size===0){ typerRooms.delete(code); return; }
      try { io.to(`typer:${code}`).emit('type:peer_left', leaver); } catch {}
      room.status = 'waiting'; room.winner=null; for(const p of room.players.values()){ p.progress=0; p.finished=false; }
      io.to(`typer:${code}`).emit('type:state', typerSummary(room));
    });
    socket.on('disconnect', () => {
      const code = socket.data.typerCode; if (!code) return; const room = typerRooms.get(code); if (!room) return;
      const leaver = { id: socket.user.id, name: socket.user.name };
      room.players.delete(socket.user.id);
      if (room.players.size===0){ typerRooms.delete(code); }
      else { room.status='waiting'; room.winner=null; for(const p of room.players.values()){ p.progress=0; p.finished=false; } try { io.to(`typer:${code}`).emit('type:peer_left', leaver); } catch {} io.to(`typer:${code}`).emit('type:state', typerSummary(room)); }
    });

    // --- Invites across online games ---
    // Allow sending an invite that creates a room and DM's the target with the code
    socket.on('invite:send', ({ toUserId, game } = {}) => {
      try {
        const me = socket.user;
        const target = String(toUserId||'');
        const gameKey = String(game||'').toLowerCase(); // 'rps' | 'tictactoe' | 'typeracer'
        if (!target || !gameKey) return;
        let code = null;
        if (gameKey === 'rps'){
          // create RPS room
          let c; do { c = codeGen(); } while (rpsRooms.has(c));
          const room = { code:c, bestOf:5, round:1, status:'waiting', players:new Map(), reveal:null };
          room.players.set(me.id, { id: me.id, name: me.name, socketId: socket.id, choice:null, score:0 });
          rpsRooms.set(c, room); socket.join(`rps:${c}`); socket.data.rpsCode = c; code = c;
          io.to(`rps:${c}`).emit('rps:state', summarize(room));
        } else if (gameKey === 'tictactoe'){
          // create TTT room
          const c = tttCode();
          const room = { code:c, players:new Map(), board:Array(9).fill(null), turn:'X', status:'waiting', winner:null, draw:false };
          room.players.set(socket.user.id, { id: socket.user.id, name: socket.user.name, socketId: socket.id, symbol:'X' });
          tttRooms.set(c, room); socket.join(`ttt:${c}`); socket.data.tttCode = c; code = c;
          io.to(`ttt:${c}`).emit('ttt:state', tttSummary(room));
        } else if (gameKey === 'typeracer'){
          // create TypeRacer room
          const c = typerCode();
          const room = { code:c, text: pickQuote(), status:'waiting', players:new Map(), winner:null };
          room.players.set(socket.user.id, { id: socket.user.id, name: socket.user.name, socketId: socket.id, progress:0, finished:false });
          typerRooms.set(c, room); socket.join(`typer:${c}`); socket.data.typerCode = c; code = c;
          io.to(`typer:${c}`).emit('type:state', typerSummary(room));
        } else {
          return;
        }
        // notify target and confirm to sender
        io.to(`user:${target}`).emit('invite:receive', { from: { id: me.id, name: me.name }, game: gameKey, code });
        socket.emit('invite:sent', { to: target, game: gameKey, code });
      } catch {}
    });

    socket.on('invite:accept', ({ fromUserId, game, code } = {}) => {
      // Best-effort notify inviter; actual room join is handled by client 'join' flows
      try { io.to(`user:${fromUserId}`).emit('invite:accepted', { by: socket.user.id, game, code }); } catch {}
    });

    socket.on('invite:decline', ({ fromUserId, game, code } = {}) => {
      try { io.to(`user:${fromUserId}`).emit('invite:declined', { by: socket.user.id, game, code }); } catch {}
    });
  });
}
