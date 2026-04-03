try {
  const { prisma } = require("@tayyar/db");
  console.log("Successfully imported @tayyar/db");
  console.log("Prisma instance keys:", Object.keys(prisma));
} catch (err) {
  console.error("Failed to import @tayyar/db");
  console.error(err);
}
