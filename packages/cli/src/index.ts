#!/usr/bin/env node
import { canonicalize, hashCanonical, generateKeyPair } from '@saw/core';

function printHelp() {
  console.log(`SAW CLI (early scaffold)\nCommands:\n  canon <json>   Canonicalize inline JSON string\n  hash <json>    Canonicalize + SHA256 hash\n  help           Show help`);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    return;
  }
  const inputRaw = rest.join(' ');
  try {
    switch (cmd) {
      case 'canon': {
        const value = JSON.parse(inputRaw);
        console.log(canonicalize(value));
        break;
      }
      case 'hash': {
        const value = JSON.parse(inputRaw);
        const { canonical, sha256 } = hashCanonical(value);
        console.log(canonical + '\n' + sha256);
        break;
      }
      case 'keygen': {
        const kp = generateKeyPair();
        console.log('# SAW Ed25519 Key Pair (DON\'T COMMIT SECRET)');
        console.log('PUBLIC_KEY=' + Buffer.from(kp.publicKey).toString('base64'));
        console.log('SECRET_KEY=' + Buffer.from(kp.secretKey).toString('base64'));
        break;
      }
      default:
        console.error('Unknown command: ' + cmd);
        printHelp();
        process.exit(1);
    }
  } catch (e: any) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
