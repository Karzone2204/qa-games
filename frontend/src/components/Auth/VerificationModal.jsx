import React from "react";

export default function VerificationModal({ open, onClose, onLogin }){
  if (!open) return null;
  return (
    <div style={backdrop} onClick={onClose}>
      <div className="game-container active" style={{ width: 420, background: "rgba(255,255,255,0.12)" }} onClick={e=>e.stopPropagation()}>
        <h2 style={{ textAlign: 'center' }}>✅ Email Verified</h2>
        <div style={{ padding: 16, color:'#e8fbe8' }}>
          Your email has been verified successfully. You can now log in.
          <div style={{ textAlign:'center', marginTop:12 }}>
            <button onClick={onLogin}>Go to login</button>
            <button style={{ marginLeft:8 }} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const backdrop = { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 };
