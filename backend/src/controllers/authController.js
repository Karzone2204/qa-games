import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import { jwtConfig, allowedEmailDomain } from "../config/auth.js";
import { sendMail } from "../services/mailer.js";
import Settings from "../models/Settings.js";

/** exact or subdomain match */
function isAllowedDomainEmail(email) {
  const domain = (email?.split("@")[1] || "").toLowerCase();
  const allowed = (allowedEmailDomain || "").toLowerCase();
  return domain === allowed || domain.endsWith(`.${allowed}`);
}

export async function signup(req, res) {
  try {
    const { email, name, password, inviteCode } = req.body;
    if (!email || !name || !password) return res.status(400).json({ error: "Missing fields" });
    if (!email.includes("@")) return res.status(400).json({ error: "Invalid email" });

    if (!isAllowedDomainEmail(email)) {
      return res.status(403).json({ error: "Email domain not allowed" });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: "User exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const role = inviteCode === process.env.ADMIN_INVITE_CODE ? "admin" : "user";
    // Settings override > env var fallback
    const setDoc = await Settings.findOne({ key:'global' });
    const verifyOnSignup = (setDoc && typeof setDoc.emailVerifyOnSignup === 'boolean')
      ? setDoc.emailVerifyOnSignup
      : (process.env.EMAIL_VERIFY_ON_SIGNUP === '1');
    const user = await User.create({
      email: email.toLowerCase(),
      name,
      role,
      passwordHash,
      emailVerified: !verifyOnSignup
    });

    // Optionally send verification email
    if (verifyOnSignup) {
      const token = makeToken(24);
      user.verifyToken = token; user.verifyTokenExp = new Date(Date.now() + 1000*60*60*24);
      await user.save();
      const base = process.env.APP_BASE_URL || 'http://localhost:5173';
      const url = `${base}/?verifyToken=${token}&email=${encodeURIComponent(user.email)}`;
      sendMail({
        to: user.email,
        subject: 'Verify your email',
        text: `Verify your QA Games account: ${url}`,
        html: `<p>Verify your QA Games account:</p><p><a href="${url}">${url}</a></p>`
      }).catch(()=>({ ok:false }));
      // When verification is required, do NOT auto-login the user
      return res.json({ ok: true, pendingVerification: true });
    } else {
      // Friendly welcome (best-effort)
      sendMail({
        to: user.email,
        subject: 'Welcome to QA Games',
        text: `Hi ${user.name}, your account is ready.`,
        html: `<p>Hi ${user.name}, your account is ready.</p>`
      }).catch(()=>({ ok:false }));
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );
    res.json({ token, user: { id: user._id, email: user.email, role: user.role, name: user.name } });
  } catch (e) {
    res.status(500).json({ error: "Signup failed" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
  if (user.active === false) return res.status(403).json({ error: "Account Inactive. Please check with admin to enable it." });

    if (!isAllowedDomainEmail(user.email)) {
      return res.status(403).json({ error: "Email domain not allowed" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // Enforce verification on login if required
    const setDoc = await Settings.findOne({ key:'global' });
    const verifyOnSignup = (setDoc && typeof setDoc.emailVerifyOnSignup === 'boolean')
      ? setDoc.emailVerifyOnSignup
      : (process.env.EMAIL_VERIFY_ON_SIGNUP === '1');
    if (verifyOnSignup && user.emailVerified === false) {
      return res.status(403).json({ error: 'Email not verified. Please check your inbox for the verification link.' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );
    res.json({ token, user: { id: user._id, email: user.email, role: user.role, name: user.name } });
  } catch (e) {
    res.status(500).json({ error: "Login failed" });
  }
}

function makeToken(len = 32){ return crypto.randomBytes(len).toString('hex'); }

export async function forgotPassword(req, res){
  try{
    const email = String(req.body.email||'').trim().toLowerCase();
    if(!email) return res.status(400).json({ error: 'Email required' });
    const user = await User.findOne({ email });
    // Always respond 200 to avoid enumeration; send email only if user exists
    if (user){
      const token = makeToken(24);
      user.resetToken = token;
      user.resetTokenExp = new Date(Date.now() + 1000*60*30); // 30m
      await user.save();
      const base = process.env.APP_BASE_URL || 'http://localhost:5173';
      const resetUrl = `${base}/?resetToken=${token}&email=${encodeURIComponent(email)}`;
      await sendMail({
        to: email,
        subject: 'Reset your QA Games password',
        text: `Use this link to reset your password: ${resetUrl} (valid 30 minutes)`,
        html: `<p>Click to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Valid for 30 minutes.</p>`
      }).catch(()=>({ ok:false }));
    }
    return res.json({ ok: true });
  } catch(e){
    return res.status(500).json({ error: 'Request failed' });
  }
}

export async function resetPassword(req, res){
  try{
    const { email, token, newPassword } = req.body || {};
    if(!email || !token || !newPassword) return res.status(400).json({ error:'Missing fields' });
    const user = await User.findOne({ email: String(email).toLowerCase(), resetToken: token });
    if(!user || !user.resetTokenExp || user.resetTokenExp.getTime() < Date.now()){
      return res.status(400).json({ error:'Invalid or expired token' });
    }
    user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    user.resetToken = null; user.resetTokenExp = null;
    await user.save();
    return res.json({ ok: true });
  } catch(e){
    return res.status(500).json({ error: 'Reset failed' });
  }
}

export async function sendVerifyEmail(req, res){
  try{
    const email = String(req.body.email||'').trim().toLowerCase();
    if(!email) return res.status(400).json({ error:'Email required' });
    const user = await User.findOne({ email });
    if(!user) return res.json({ ok:true });
    const token = makeToken(24);
    user.verifyToken = token; user.verifyTokenExp = new Date(Date.now() + 1000*60*60*24);
    await user.save();
    const base = process.env.APP_BASE_URL || 'http://localhost:5173';
    const url = `${base}/?verifyToken=${token}&email=${encodeURIComponent(email)}`;
    await sendMail({ to: email, subject: 'Verify your email', text: `Verify: ${url}`, html: `<a href="${url}">${url}</a>` }).catch(()=>({ ok:false }));
    return res.json({ ok:true });
  } catch(e){ return res.status(500).json({ error:'Send failed' }); }
}

export async function verifyEmail(req, res){
  try{
    const { email, token } = req.body || {};
    if(!email || !token) return res.status(400).json({ error:'Missing fields' });
    const user = await User.findOne({ email: String(email).toLowerCase(), verifyToken: token });
    if(!user || !user.verifyTokenExp || user.verifyTokenExp.getTime() < Date.now()){
      return res.status(400).json({ error:'Invalid or expired token' });
    }
    user.emailVerified = true; user.verifyToken = null; user.verifyTokenExp = null;
    await user.save();
    return res.json({ ok:true });
  } catch(e){ return res.status(500).json({ error:'Verify failed' }); }
}
