#!/usr/bin/env node

/**
 * Bulk resend verification OTP emails to unverified users.
 *
 * Safe by default: runs in dry-run mode unless --send is provided.
 *
 * Usage examples:
 *   node scripts/bulk-resend-verification.js
 *   node scripts/bulk-resend-verification.js --send
 *   node scripts/bulk-resend-verification.js --send --limit=200 --delay-ms=400
 *   node scripts/bulk-resend-verification.js --send --email-filter=@gmail.com
 */

const fs = require('fs');
const path = require('path');
const dns = require('dns');
const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');

function parseArgs(argv) {
  const options = {
    send: false,
    limit: 0,
    delayMs: 350,
    emailFilter: '',
    appName: 'Make It Sell',
    dryRun: true,
  };

  for (const rawArg of argv) {
    const arg = String(rawArg || '').trim();

    if (arg === '--send') {
      options.send = true;
      options.dryRun = false;
      continue;
    }

    if (arg === '--dry-run') {
      options.send = false;
      options.dryRun = true;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const value = Number(arg.split('=')[1]);
      if (Number.isFinite(value) && value >= 0) {
        options.limit = Math.floor(value);
      }
      continue;
    }

    if (arg.startsWith('--delay-ms=')) {
      const value = Number(arg.split('=')[1]);
      if (Number.isFinite(value) && value >= 0) {
        options.delayMs = Math.floor(value);
      }
      continue;
    }

    if (arg.startsWith('--email-filter=')) {
      options.emailFilter = arg.split('=')[1] || '';
      continue;
    }

    if (arg.startsWith('--app-name=')) {
      options.appName = arg.split('=')[1] || options.appName;
      continue;
    }
  }

  return options;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function loadEnvironment() {
  const root = process.cwd();
  loadEnvFile(path.join(root, '.env'));
  loadEnvFile(path.join(root, '.env.local'));
}

function isSrvDnsError(error) {
  const message = String((error && error.message) || error || '');
  return (
    message.includes('querySrv ECONNREFUSED') ||
    message.includes('querySrv ENOTFOUND') ||
    message.includes('querySrv ETIMEOUT')
  );
}

function configureDnsForSrv() {
  const configuredDnsServers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredDnsServers.length > 0) {
    dns.setServers(configuredDnsServers);
    console.log(`Using DNS servers for MongoDB SRV lookup: ${configuredDnsServers.join(', ')}`);
  }
}

function extractSearchParams(parsedUri) {
  const params = new URLSearchParams(parsedUri.searchParams);
  if (!params.has('retryWrites')) params.set('retryWrites', 'true');
  if (!params.has('w')) params.set('w', 'majority');
  if (!params.has('tls')) params.set('tls', 'true');
  return params;
}

async function buildDirectUriFromSrv(srvUri) {
  const parsed = new URL(srvUri);
  const hostname = parsed.hostname;
  const dbName = parsed.pathname && parsed.pathname !== '/'
    ? parsed.pathname.replace(/^\//, '')
    : (process.env.MONGODB_DB_NAME || 'test');

  const resolver = new dns.promises.Resolver();
  const configuredDnsServers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredDnsServers.length > 0) {
    resolver.setServers(configuredDnsServers);
  }

  const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${hostname}`);
  if (!Array.isArray(srvRecords) || srvRecords.length === 0) {
    throw new Error('No MongoDB SRV records found for host');
  }

  const hosts = srvRecords
    .sort((a, b) => a.priority - b.priority)
    .map((record) => `${record.name}:${record.port}`)
    .join(',');

  const params = extractSearchParams(parsed);

  try {
    const txtRecords = await resolver.resolveTxt(hostname);
    if (Array.isArray(txtRecords) && txtRecords.length > 0) {
      const atlasTxt = txtRecords[0].join('');
      const atlasParams = new URLSearchParams(atlasTxt);
      atlasParams.forEach((value, key) => {
        if (!params.has(key)) params.set(key, value);
      });
    }
  } catch {
    // TXT lookup is optional.
  }

  const username = parsed.username ? encodeURIComponent(decodeURIComponent(parsed.username)) : '';
  const password = parsed.password ? encodeURIComponent(decodeURIComponent(parsed.password)) : '';
  const auth = username ? `${username}${password ? `:${password}` : ''}@` : '';

  return `mongodb://${auth}${hosts}/${dbName}?${params.toString()}`;
}

async function connectMongoWithFallback(uri) {
  const baseOptions = { maxPoolSize: 20 };

  try {
    const client = new MongoClient(uri, baseOptions);
    await client.connect();
    return client;
  } catch (error) {
    if (uri.startsWith('mongodb+srv://') && isSrvDnsError(error)) {
      console.warn('SRV lookup failed; trying direct-host MongoDB URI fallback...');
      const directUri = await buildDirectUriFromSrv(uri);
      const fallbackClient = new MongoClient(directUri, baseOptions);
      await fallbackClient.connect();
      return fallbackClient;
    }

    throw error;
  }
}

function createTransportConfigs() {
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587');
  const secure = String(process.env.SMTP_SECURE || process.env.EMAIL_SECURE || '').toLowerCase() === 'true' || port === 465;

  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('Missing SMTP credentials. Set EMAIL_USER/EMAIL_PASS or SMTP_USER/SMTP_PASS.');
  }

  const baseConfig = {
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  };

  const fallback587 = {
    ...baseConfig,
    port: 587,
    secure: false,
  };

  return [baseConfig, fallback587].filter((config, index, arr) => {
    return arr.findIndex((x) => x.host === config.host && x.port === config.port && x.secure === config.secure) === index;
  });
}

async function createVerifiedTransporter() {
  const configs = createTransportConfigs();
  let lastError = null;

  for (const config of configs) {
    const transporter = nodemailer.createTransport(config);
    try {
      await transporter.verify();
      console.log(`SMTP verified on ${config.host}:${config.port} (secure=${config.secure})`);
      return transporter;
    } catch (error) {
      lastError = error;
      console.warn(`SMTP verify failed on ${config.host}:${config.port} (secure=${config.secure}): ${error.message || error}`);
    }
  }

  throw lastError || new Error('Unable to verify any SMTP transport configuration.');
}

function getFromAddress() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  const fromName = process.env.SMTP_FROM_NAME || 'Make It Sell';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.EMAIL_USER;
  return `"${fromName}" <${fromEmail}>`;
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildVerificationHtml({ appName, name, email, code }) {
  return `
  <div style="font-family: Segoe UI, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px;">
    <h2 style="margin: 0 0 12px 0; color: #111827;">Verify your email</h2>
    <p style="margin: 0 0 16px 0; color: #374151;">Hi ${escapeHtml(name || 'there')},</p>
    <p style="margin: 0 0 18px 0; color: #374151;">Use this 6-digit code to verify your ${escapeHtml(appName)} account:</p>
    <div style="font-family: Consolas, Menlo, monospace; font-size: 34px; letter-spacing: 8px; font-weight: 700; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 8px; text-align: center; padding: 14px 18px; color: #111827;">${escapeHtml(code)}</div>
    <p style="margin: 18px 0 0 0; color: #4b5563;">This code expires in 10 minutes.</p>
    <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 13px;">If you did not request this, you can ignore this email.</p>
    <p style="margin: 18px 0 0 0; color: #9ca3af; font-size: 12px;">Sent to ${escapeHtml(email)}</p>
  </div>`;
}

async function sendVerificationEmail({ transporter, to, name, code, appName }) {
  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject: `Your ${appName} verification code`,
    html: buildVerificationHtml({ appName, name, email: to, code }),
    text: `Hi ${name || 'there'}, your verification code is ${code}. It expires in 10 minutes.`,
    headers: {
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      'Auto-Submitted': 'auto-generated',
    },
  });
}

async function main() {
  loadEnvironment();

  const options = parseArgs(process.argv.slice(2));
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing. Add it to .env.local or environment variables.');
  }

  if (mongoUri.startsWith('mongodb+srv://')) {
    configureDnsForSrv();
  }

  const expiryMs = 10 * 60 * 1000;

  const startLabel = options.send ? 'LIVE SEND' : 'DRY RUN';
  console.log(`\n=== Bulk Verification Resend (${startLabel}) ===`);
  console.log(`Filter: ${options.emailFilter || '(none)'}`);
  console.log(`Limit: ${options.limit || 'all'}`);
  console.log(`Delay: ${options.delayMs}ms\n`);

  let transporter = null;
  if (options.send) {
    transporter = await createVerifiedTransporter();
  }

  const client = await connectMongoWithFallback(mongoUri);

  try {
    const dbFromUri = (() => {
      const clean = mongoUri.split('?')[0];
      const slashIndex = clean.lastIndexOf('/');
      const maybeName = slashIndex >= 0 ? clean.slice(slashIndex + 1) : '';
      return maybeName || process.env.MONGODB_DB_NAME || 'test';
    })();

    const db = client.db(dbFromUri);
    const users = db.collection('users');

    const query = {
      email: { $type: 'string', $ne: '' },
      $or: [{ isEmailVerified: false }, { isEmailVerified: { $exists: false } }],
    };

    if (options.emailFilter) {
      query.email = { $regex: options.emailFilter, $options: 'i' };
    }

    const cursor = users.find(query, {
      projection: {
        _id: 1,
        email: 1,
        name: 1,
        displayName: 1,
        isEmailVerified: 1,
      },
      sort: { createdAt: 1, _id: 1 },
    });

    if (options.limit > 0) {
      cursor.limit(options.limit);
    }

    const candidates = await cursor.toArray();

    console.log(`Found ${candidates.length} unverified user(s) matching criteria.`);

    if (candidates.length === 0) {
      console.log('Nothing to process.');
      return;
    }

    if (options.dryRun) {
      console.log('\nDry-run sample:');
      for (const row of candidates.slice(0, 20)) {
        console.log(`- ${row.email}`);
      }
      if (candidates.length > 20) {
        console.log(`... and ${candidates.length - 20} more`);
      }
      console.log('\nRe-run with --send to actually send emails.');
      return;
    }

    let sent = 0;
    let failed = 0;
    const failures = [];

    for (let i = 0; i < candidates.length; i += 1) {
      const user = candidates[i];
      const code = generateCode();
      const expiresAt = new Date(Date.now() + expiryMs);

      try {
        await users.updateOne(
          { _id: user._id },
          {
            $set: {
              isEmailVerified: false,
              emailVerificationToken: code,
              emailVerificationTokenExpiry: expiresAt,
              otp_code: code,
              otp_expiry: expiresAt,
              otp_last_sent_at: new Date(),
              updatedAt: new Date(),
            },
          }
        );

        await sendVerificationEmail({
          transporter,
          to: user.email,
          name: user.name || user.displayName || 'User',
          code,
          appName: options.appName,
        });

        sent += 1;
        console.log(`[${i + 1}/${candidates.length}] SENT ${user.email}`);
      } catch (error) {
        failed += 1;
        failures.push({ email: user.email, error: error.message || String(error) });
        console.log(`[${i + 1}/${candidates.length}] FAIL ${user.email} -> ${error.message || String(error)}`);
      }

      if (i < candidates.length - 1 && options.delayMs > 0) {
        await sleep(options.delayMs);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Sent: ${sent}`);
    console.log(`Failed: ${failed}`);

    if (failures.length > 0) {
      console.log('\nFailed recipients:');
      for (const item of failures) {
        console.log(`- ${item.email}: ${item.error}`);
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('\nBulk resend failed:', error.message || error);
  process.exit(1);
});
