import React, { useState } from "react";
import { api } from "../../services/api.js";
export default function Login(){
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  async function onSubmit(e){ e.preventDefault(); await api.login(email,password); }
  return (<form onSubmit={onSubmit}><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password"/><button>Login</button></form>);
}
