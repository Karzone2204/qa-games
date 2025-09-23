import React from "react";

export default function ConfirmDialog({ open, title = "Confirm", message, confirmText = "Confirm", cancelText = "Cancel", onConfirm, onClose }){
  if (!open) return null;
  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000 }}
      onClick={onClose}
    >
      <div className="game-container active" style={{ width: 420, background: 'rgba(255,255,255,0.12)' }} onClick={(e)=>e.stopPropagation()}>
        <h2 style={{ textAlign:'center' }}>{title}</h2>
        <div style={{ padding:16, lineHeight:1.5, textAlign:'center' }}>
          {typeof message === 'string' ? <div>{message}</div> : message}
          <div style={{ marginTop:18, display:'flex', justifyContent:'center', gap:10 }}>
            <button onClick={onConfirm} className="btn-danger" style={{ padding:'8px 14px' }}>{confirmText}</button>
            <button onClick={onClose} className="btn-secondary" style={{ padding:'8px 14px' }}>{cancelText}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
