#!/usr/bin/env node
// Prints a bcrypt hash for a password, to paste into VIEWER_PASSWORD_HASH or
// EDITOR_PASSWORD_HASH. Usage: npm run hash -- "the password"
//
// Base64-encoded, not the raw hash. A raw bcrypt hash looks like
// "$2b$12$...", and Next.js runs .env files through dotenv-expand, which
// treats "$2b" and "$12" as variable references and silently mangles the
// value. Base64 has no "$", so it survives untouched. src/lib/auth.ts decodes
// it back before comparing.

const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash -- "the password"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log(Buffer.from(hash, 'utf8').toString('base64'));
