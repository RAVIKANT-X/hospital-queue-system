const bcrypt = require('bcryptjs');

async function main() {
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('Set ADMIN_INITIAL_PASSWORD to a password with at least 12 characters');
  }

  process.stdout.write(`${await bcrypt.hash(password, 12)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
