import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

export default async function crmRoutes(server: FastifyInstance) {
  // Search customers by phone or name
  server.get("/customers/search", async (request, reply) => {
    const { q } = request.query as { q: string };
    
    const customers = await prisma.customerProfile.findMany({
      where: {
        OR: [
          { phone: { contains: q } },
          { name: { contains: q, mode: 'insensitive' } }
        ]
      },
      take: 5
    });
    
    return customers;
  });

  // Get customer history
  server.get("/customers/:id/history", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const orders = await prisma.order.findMany({
      where: { customerProfileId: id },
      orderBy: { requestedAt: "desc" },
      take: 10
    });
    
    return orders;
  });
}
