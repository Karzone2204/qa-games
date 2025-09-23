import 'dotenv/config.js';
import sgMail from '@sendgrid/mail';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// TLS/SSL and proxy handling for corporate environments
// - USE_WIN_CA=1: load Windows root store into Node (fixes corporate MITM certs)
// - EMAIL_TLS_INSECURE=1: disable TLS verification (DEV ONLY)
// - HTTPS_PROXY / HTTP_PROXY: route outbound HTTPS via corporate proxy
if (process.platform === 'win32') {
  try {
    if (process.env.USE_WIN_CA === '1') {
      await import('win-ca');
      console.log('[TLS] Loaded Windows root certificates via win-ca (mailer)');
    }
  } catch (e) {
    console.warn('[TLS] Failed to load win-ca in mailer:', e?.message || e);
  }
}
if (process.env.EMAIL_TLS_INSECURE === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn('[TLS] WARNING: TLS verification disabled (EMAIL_TLS_INSECURE=1) – mailer scope');
}
try {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) {
    const { bootstrap } = await import('global-agent');
    process.env.GLOBAL_AGENT_HTTP_PROXY = proxyUrl;
    bootstrap();
    console.log('[Proxy] Enabled global proxy via global-agent (mailer)');
  }
} catch {
  // ignore if global-agent not installed
}

// Configure SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export function isSendGridConfigured(){ return !!process.env.SENDGRID_API_KEY; }

export async function sendMail({ to, subject, html, text }){
  const from = process.env.MAIL_FROM || 'QA Games <no-reply@localhost>';
  
  // Try SendGrid if configured
  if (process.env.SENDGRID_API_KEY) {
    try {
      const msg = {
        to,
        from,
        subject,
        text: text || '',
        html: html || text || ''
      };
      
      console.log('[mailer] Attempting to send via SendGrid...');
      const response = await sgMail.send(msg);
      console.log('[mailer] ✅ Email sent via SendGrid successfully');
      return { ok: true, provider: 'sendgrid', id: response[0]?.headers?.['x-message-id'] };
    } catch (err) {
      console.error('[mailer] ❌ SendGrid failed:', err?.response?.body || err?.message || err);
      // Fall through to console fallback
    }
  }

  // Optional: PowerShell fallback using SendGrid HTTP API (bypasses Node TLS, uses Windows trust like C#)
  if (process.env.SENDGRID_USE_POWERSHELL === '1' && process.env.SENDGRID_API_KEY) {
    try {
      const ok = sendViaPowerShell({ from, to, subject, text, html });
      if (ok) {
        console.log('[mailer] ✅ Email sent via PowerShell/SendGrid');
        return { ok: true, provider: 'sendgrid-powershell' };
      }
      console.error('[mailer] ❌ PowerShell/SendGrid fallback failed');
    } catch (e) {
      console.error('[mailer] ❌ PowerShell error:', e?.message || e);
    }
  }
  
  // Fallback: print to console for development
  console.warn('[mailer] ⚠️ SendGrid not configured or failed; printing email to console.');
  console.log('--- EMAIL START ---');
  console.log('From:', from);
  console.log('To:', to);
  console.log('Subject:', subject);
  console.log('Text:', text || '(none)');
  if (html) console.log('HTML:', html);
  console.log('--- EMAIL END ---');
  return { ok: true, provider: 'console', mocked: true };
}

function parseFrom(fromStr){
  // Accepts "Name <email@x>" or plain email
  const m = fromStr.match(/^(.*)\s*<([^>]+)>\s*$/);
  if (m) return { email: m[2], name: m[1].trim() };
  return { email: fromStr, name: undefined };
}

function buildSendGridPayload({ from, to, subject, text, html }){
  const fromObj = parseFrom(from);
  const content = html
    ? [{ type: 'text/html', value: html }]
    : [{ type: 'text/plain', value: text || '' }];
  return {
    personalizations: [
      {
        to: [{ email: to }],
        subject
      }
    ],
    from: fromObj.name ? { email: fromObj.email, name: fromObj.name } : { email: fromObj.email },
    content
  };
}

function sendViaPowerShell({ from, to, subject, text, html }){
  if (process.platform !== 'win32') return false;
  const payload = buildSendGridPayload({ from, to, subject, text, html });
  const json = JSON.stringify(payload);
  const tmpDir = os.tmpdir();
  const jsonPath = path.join(tmpDir, `sg_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  const psPath = path.join(tmpDir, `sg_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`);
  const apiKey = process.env.SENDGRID_API_KEY;
  const baseUrl = process.env.SENDGRID_BASE_URL || 'https://api.sendgrid.com';
  const url = `${baseUrl}/v3/mail/send`;
  try {
    fs.writeFileSync(jsonPath, json, { encoding: 'utf8' });
    const psScript = `
$ErrorActionPreference = 'Stop'
$headers = @{ Authorization = "Bearer ${apiKey}"; 'Content-Type' = 'application/json' }
$body = Get-Content -Raw -LiteralPath '${jsonPath}'
Invoke-RestMethod -Uri '${url}' -Method Post -Headers $headers -Body $body | Out-Null
`;
    fs.writeFileSync(psPath, psScript, { encoding: 'utf8' });
    const shell = process.env.ComSpec ? undefined : 'pwsh.exe'; // let spawn resolve if not Windows shell
    const exe = 'pwsh.exe';
    let res = spawnSync(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', psPath], { encoding: 'utf8' });
    if (res.error) {
      // fallback to Windows PowerShell
      res = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', psPath], { encoding: 'utf8' });
    }
    const success = res.status === 0;
    if (!success) {
      console.error('[mailer] PowerShell stderr:', res.stderr?.trim());
    }
    return success;
  } finally {
    try { fs.unlinkSync(jsonPath); } catch {}
    try { fs.unlinkSync(psPath); } catch {}
  }
}
