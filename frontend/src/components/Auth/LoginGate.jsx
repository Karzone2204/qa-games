import React from "react";

export default function LoginGate({ openAuth }) {
  return (
    <div className="content-section active">
      <div className="game-container active" style={{ maxWidth: 700, textAlign: "center" }}>
        <h2 style={{ marginBottom: 8 }}>🔐 Sign in to access <b>QA Tools</b></h2>
        <p style={{ opacity: 0.9, marginBottom: 18 }}>
          Generate test cases, sample data, and manage app links — all in one place.
        </p>

        <div className="season-stats" style={{ marginTop: 12 }}>
          <div className="stat-card">
            <div style={{ fontSize: "2.2rem" }}>🧩</div>
            <h4>Test Case Generator</h4>
            <p>Instant ideas for happy, edge & negative paths.</p>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: "2.2rem" }}>🧪</div>
            <h4>Data Generator</h4>
            <p>Fake, repeatable records for form testing.</p>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: "2.2rem" }}>🔗</div>
            <h4>App Links</h4>
            <p>Quick links to Dev/Test/Stage/Prod environments.</p>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <button onClick={() => openAuth?.("login")}>Login</button>
          <button onClick={() => openAuth?.("signup")} style={{ marginLeft: 8 }}>Sign Up</button>
        </div>

        <p style={{ marginTop: 10, opacity: 0.8 }}>
          Use your <b>innovation.group</b> email to join.
        </p>
      </div>
    </div>
  );
}
