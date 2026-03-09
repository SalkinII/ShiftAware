#!/usr/bin/env node
/**
 * Check if environment variables are loaded correctly
 * Reads .env.local or .env directly
 */

const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

const env = fs.existsSync(envLocalPath) 
  ? parseEnvFile(envLocalPath)
  : fs.existsSync(envPath)
  ? parseEnvFile(envPath)
  : {};

console.log('\nEnvironment Variables Check:');
console.log('Using:', fs.existsSync(envLocalPath) ? '.env.local' : fs.existsSync(envPath) ? '.env' : 'none found');

const adminPassword = env.ADMIN_PASSWORD?.trim();
const adminHash = env.ADMIN_PASSWORD_HASH?.trim();
const sessionSecret = env.SESSION_SECRET?.trim();
const sessionTimeout = env.SESSION_TIMEOUT_MINUTES?.trim();
const dbUrl = env.DATABASE_URL?.trim();

console.log('\nADMIN_PASSWORD_HASH:');
console.log('  exists:', !!adminHash);
if (adminHash) {
  console.log('  format:', adminHash.includes(':') ? 'valid (salt:hash)' : '⚠ INVALID (missing colon separator)');
}

console.log('\nSESSION_SECRET:');
console.log('  exists:', !!sessionSecret);
console.log('  length:', sessionSecret?.length || 0);
if (sessionSecret && sessionSecret.length < 32) {
  console.log('  ⚠ WARNING: SESSION_SECRET should be at least 32 characters');
}

if (!adminHash && adminPassword) {
  console.log('\n⚠ WARNING: Using plain-text ADMIN_PASSWORD.');
  console.log('  For production, run: npx tsx scripts/hash-password.ts');
  console.log('  Then set ADMIN_PASSWORD_HASH and remove ADMIN_PASSWORD.');
}

console.log('\nSESSION_TIMEOUT_MINUTES:');
console.log('  exists:', !!sessionTimeout);
console.log('  value:', sessionTimeout || '60 (default)');


console.log('\nDATABASE_URL:');
console.log('  exists:', !!dbUrl);
console.log('  value:', dbUrl ? dbUrl.replace(/:[^:@]+@/, ':****@') : 'NOT SET');

console.log('');

