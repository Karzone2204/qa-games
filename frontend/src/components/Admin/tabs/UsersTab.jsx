import React, { useEffect, useState } from "react";
import { api } from "../../../services/api.js";
import { toast } from "../../../services/toast.js";
import ConfirmDialog from "../../UI/ConfirmDialog.jsx";

export default function UsersTab(){
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmUser, setConfirmUser] = useState(null);

  const load = async () => {
    const u = await api.adminListUsers();
    if (u?.error){ toast(u.error, 3000); return; }
    setUsers(u || []);
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (id, active) => {
    setBusy(true);
    const r = await api.adminToggleUserActive(id, active);
    setBusy(false);
    if (r?.error){ toast(r.error, 3000); return; }
    await load();
  };

  const remove = async (id) => {
    setConfirmOpen(false);
    setBusy(true);
    const r = await api.adminDeleteUser(id);
    setBusy(false);
    if (r?.error){ toast(r.error, 3000); return; }
    await load();
  };

  const resend = async (id) => {
    setBusy(true);
    const r = await api.adminResendVerify(id);
    setBusy(false);
    if (r?.error){ toast(r.error, 3000); return; }
    toast("Verification email sent", 2000);
  };

  const resetPassword = async (email) => {
    setBusy(true);
    const r = await api.authForgot(email);
    setBusy(false);
    if (r?.error){ toast(r.error, 3000); return; }
    toast("Password reset link sent", 2000);
  };

  return (
    <div style={{display:'grid', gap:12}}>
      <div style={{fontSize:12, opacity:0.8}}>Total users: {users.length}</div>
      <div style={{display:'grid', gap:8}}>
        {users.map(u => (
          <div key={u._id} style={{display:'grid', gridTemplateColumns:'1fr auto auto auto auto', gap:8, alignItems:'center', padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.06)'}}>
            <div>
              <div style={{fontWeight:600}}>{u.name || u.email}</div>
              <div style={{fontSize:12, opacity:0.8}}>{u.email} • {u.role || 'user'} • {u.emailVerified ? 'verified' : 'unverified'}</div>
            </div>
            <button
              disabled={busy}
              className="btn-secondary"
              style={{ padding:'6px 10px', fontSize:12 }}
              onClick={() => toggleActive(u._id, !u.active)}
            >
              {u.active ? 'Disable' : 'Enable'}
            </button>
            {!u.emailVerified ? (
              <button
                disabled={busy}
                className="btn-secondary"
                style={{ padding:'6px 10px', fontSize:12 }}
                onClick={() => resend(u._id)}
              >Resend Verify</button>
            ) : <div />}
            <button
              disabled={busy}
              className="btn-secondary"
              style={{ padding:'6px 10px', fontSize:12 }}
              onClick={() => resetPassword(u.email)}
            >Reset Password</button>
            <button
              disabled={busy}
              style={{background:'#7f1d1d', color:'#fff', padding:'6px 10px', fontSize:12, borderRadius:8}}
              onClick={() => { setConfirmUser(u); setConfirmOpen(true); }}
            >Delete</button>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete user?"
        message={confirmUser ? (
          <>
            Delete <b>{confirmUser.name || confirmUser.email}</b>?<br/>
            This action cannot be undone.
          </>
        ) : null}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => confirmUser && remove(confirmUser._id)}
        onClose={() => { setConfirmOpen(false); setConfirmUser(null); }}
      />
    </div>
  );
}
