import React, { useState } from "react";
import { api } from "../../services/api.js";
export default function Signup(){
  const [email,setEmail]=useState(""); const [name,setName]=useState(""); const [password,setPassword]=useState("");
  async function onSubmit(e){ e.preventDefault(); await api.signup(email,name,password); }
  return (<form onSubmit={onSubmit}><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email"/><input value={name} onChange={e=>setName(e.target.value)} placeholder="name"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password"/><button>Signup</button></form>);
}
