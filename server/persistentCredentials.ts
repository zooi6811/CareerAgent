import { spawn } from 'child_process';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { homedir } from 'os';
import path from 'path';
import type { ModelProvider } from './gemini.ts';

type EncryptedVault = { version: 1; keys: Partial<Record<ModelProvider, string>> };
const providerIds: ModelProvider[] = ['gemini', 'groq', 'openrouter'];
const vaultDirectory = path.join(process.env.APPDATA || path.join(homedir(), 'AppData', 'Roaming'), 'MeridianCareerAgent');
const vaultPath = path.join(vaultDirectory, 'api-keys.dpapi.json');
let savedStatus: Record<ModelProvider, boolean> = { gemini: false, groq: false, openrouter: false };

function protectWithWindowsDpapi(value: string, decrypt = false): Promise<string> {
  if (process.platform !== 'win32') return Promise.reject(new Error('Persistent API-key storage is currently available on Windows only.'));
  const script = decrypt
    ? "Add-Type -AssemblyName System.Security; $inputText=[Console]::In.ReadToEnd(); $bytes=[Convert]::FromBase64String($inputText); $plain=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($plain))"
    : "Add-Type -AssemblyName System.Security; $inputText=[Console]::In.ReadToEnd(); $bytes=[Text.Encoding]::UTF8.GetBytes($inputText); $cipher=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($cipher))";
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', () => reject(new Error('Windows secure storage could not be started.')));
    child.once('close', (code) => {
      if (code !== 0 || !stdout.trim()) return reject(new Error(stderr.trim() || 'Windows could not protect the API key.'));
      try { resolve(decrypt ? Buffer.from(stdout.trim(), 'base64').toString('utf8') : stdout.trim()); }
      catch { reject(new Error('The saved API key could not be decrypted for this Windows account.')); }
    });
    child.stdin.end(value);
  });
}

async function readVault(): Promise<EncryptedVault> {
  try {
    const value = JSON.parse(await readFile(vaultPath, 'utf8')) as Partial<EncryptedVault>;
    if (value.version !== 1 || !value.keys || typeof value.keys !== 'object') throw new Error('Invalid encrypted key vault.');
    return { version: 1, keys: value.keys };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, keys: {} };
    throw error;
  }
}

async function writeVault(vault: EncryptedVault): Promise<void> {
  await mkdir(vaultDirectory, { recursive: true });
  // The contents are DPAPI ciphertext; direct replacement also works with Windows ACL/sandbox configurations that reject rename.
  await writeFile(vaultPath, JSON.stringify(vault), { encoding: 'utf8', mode: 0o600 });
}

export function isApiKeySaved(provider: ModelProvider): boolean { return savedStatus[provider]; }

export async function loadPersistentApiKeys(): Promise<Partial<Record<ModelProvider, string>>> {
  const vault = await readVault();
  const keys: Partial<Record<ModelProvider, string>> = {};
  for (const provider of providerIds) {
    const encrypted = vault.keys[provider];
    savedStatus[provider] = Boolean(encrypted);
    if (encrypted) keys[provider] = await protectWithWindowsDpapi(encrypted, true);
  }
  return keys;
}

export async function savePersistentApiKey(provider: ModelProvider, apiKey: string, clear = false): Promise<void> {
  const vault = await readVault();
  if (clear || !apiKey.trim()) delete vault.keys[provider];
  else vault.keys[provider] = await protectWithWindowsDpapi(apiKey.trim());
  await writeVault(vault);
  savedStatus[provider] = Boolean(vault.keys[provider]);
}
