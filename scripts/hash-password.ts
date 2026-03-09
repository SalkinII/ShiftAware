import { scryptSync, randomBytes } from "crypto";
import { createInterface } from "readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function main() {
  console.log("\nShiftAware Password Hash Generator\n");

  const password = await question("Enter password to hash: ");

  if (!password.trim()) {
    console.error("Password cannot be empty.");
    process.exit(1);
  }

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  const result = `${salt}:${hash}`;

  console.log("\nGenerated hash (copy this into your .env):\n");
  console.log(result);
  console.log("\nExample .env line:");
  console.log(`ADMIN_PASSWORD_HASH=${result}\n`);

  rl.close();
}

main();
