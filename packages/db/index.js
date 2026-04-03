// Re-export everything from Prisma Client for the monorepo
const { PrismaClient } = require("@prisma/client");

// Re-export all enums and types from Prisma
const prismaClientExports = require("@prisma/client");

// Create a shared prisma instance
const prisma = new PrismaClient();

module.exports = {
  ...prismaClientExports,
  PrismaClient,
  prisma,
};
