try {
  console.log("Starting import check...");
  require('dotenv').config();
  console.log("1. dotenv loaded");
  require('fastify');
  console.log("2. fastify loaded");
  require('@fastify/cors');
  console.log("3. @fastify/cors loaded");
  require('@fastify/helmet');
  console.log("4. @fastify/helmet loaded");
  require('@fastify/jwt');
  console.log("5. @fastify/jwt loaded");
  require('@fastify/rate-limit');
  console.log("6. @fastify/rate-limit loaded");
  require('@fastify/swagger');
  console.log("7. @fastify/swagger loaded");
  require('@fastify/swagger-ui');
  console.log("8. @fastify/swagger-ui loaded");
  
  // Now local files
  console.log("Checking local files...");
  require('./src/config');
  console.log("9. src/config loaded");
  require('./src/plugins/socket');
  console.log("10. src/plugins/socket loaded");
  require('./src/orders/pod');
  console.log("11. src/orders/pod loaded");
  
  console.log("All imports successful!");
} catch (err) {
  console.error("Import failed:");
  console.error(err);
  process.exit(1);
}
