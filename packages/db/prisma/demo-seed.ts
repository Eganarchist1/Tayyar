import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Tayyar demo dataset...");
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync("Tayyar@123", salt, 64).toString("hex");
  const passwordHash = `${salt}:${derived}`;

  await prisma.orderStatusHistory.deleteMany();
  await prisma.breadcrumb.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.penalty.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customerLocationRequest.deleteMany();
  await prisma.customerAddressVault.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.heroAssignment.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.supervisorZone.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.merchantBrand.deleteMany();
  await prisma.heroProfile.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      id: "user-admin",
      email: "admin@tayyar.app",
      name: "Tayyar Admin",
      role: "ADMIN",
      phone: "+201000000001",
      passwordHash,
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      id: "user-supervisor",
      email: "supervisor@tayyar.app",
      name: "Mona Supervisor",
      role: "SUPERVISOR",
      phone: "+201000000002",
      passwordHash,
    },
  });

  const merchantOwner = await prisma.user.create({
    data: {
      id: "user-merchant-owner",
      email: "owner@merchant.com",
      name: "Karim Merchant",
      role: "MERCHANT_OWNER",
      phone: "+201000000003",
      passwordHash,
    },
  });

  const branchManager = await prisma.user.create({
    data: {
      id: "user-branch-manager",
      email: "branch.manager@tayyar.app",
      name: "Nour Branch",
      role: "BRANCH_MANAGER",
      phone: "+201000000006",
      passwordHash,
    },
  });

  const heroUserOne = await prisma.user.create({
    data: {
      id: "user-hero-1",
      email: "hero@tayyar.app",
      name: "Ahmed Pilot",
      role: "HERO",
      phone: "+201000000004",
      passwordHash,
    },
  });

  const heroUserTwo = await prisma.user.create({
    data: {
      id: "user-hero-2",
      email: "hero2@tayyar.app",
      name: "Sara Pilot",
      role: "HERO",
      phone: "+201000000005",
      passwordHash,
    },
  });

  const zoneDokki = await prisma.zone.create({
    data: {
      id: "zone-dokki",
      name: "Dokki Central",
      nameAr: "الدقي المركزية",
      boundaryWkt: "POLYGON((31.199 30.041,31.225 30.041,31.225 30.026,31.199 30.026,31.199 30.041))",
      city: "Giza",
      baseFee: 35,
      kmRate: 6,
    },
  });

  const zoneMaadi = await prisma.zone.create({
    data: {
      id: "zone-maadi",
      name: "Maadi Flight Corridor",
      nameAr: "ممر المعادي",
      boundaryWkt: "POLYGON((31.243 29.979,31.288 29.979,31.288 29.954,31.243 29.954,31.243 29.979))",
      city: "Cairo",
      baseFee: 40,
      kmRate: 7,
    },
  });

  await prisma.supervisorZone.createMany({
    data: [
      { supervisorId: supervisor.id, zoneId: zoneDokki.id },
      { supervisorId: supervisor.id, zoneId: zoneMaadi.id },
    ],
  });

  const merchant = await prisma.merchantBrand.create({
    data: {
      id: "merchant-default",
      name: "Sky Bites",
      nameAr: "سكاي بايتس",
      ownerId: merchantOwner.id,
      walletBalance: 18000,
    },
  });

  const branchDokki = await prisma.branch.create({
    data: {
      id: "branch-dokki",
      brandId: merchant.id,
      managerId: branchManager.id,
      name: "Dokki Command Kitchen",
      nameAr: "مطبخ الدقي",
      address: "12 Mossadak St, Dokki",
      lat: 30.0385,
      lng: 31.2107,
      phone: "+20211111111",
    },
  });

  const branchMaadi = await prisma.branch.create({
    data: {
      id: "branch-maadi",
      brandId: merchant.id,
      name: "Maadi Dispatch Hub",
      nameAr: "مركز المعادي",
      address: "Road 9, Maadi",
      lat: 29.9602,
      lng: 31.2569,
      phone: "+20222222222",
    },
  });

  const heroOne = await prisma.heroProfile.create({
    data: {
      id: "hero-profile-1",
      userId: heroUserOne.id,
      zoneId: zoneDokki.id,
      status: "ONLINE",
      currentLat: 30.0379,
      currentLng: 31.2121,
      lastPingAt: new Date(),
      bikeNumber: "DK-101",
      nationalId: "29801010101010",
      efficiencyScore: 94,
      ordersToday: 2,
      totalDeliveries: 148,
      lastOrderAt: new Date(),
      walletBalance: 920,
      totalEarnings: 12450,
      bloodType: "O_POS",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  const heroTwo = await prisma.heroProfile.create({
    data: {
      id: "hero-profile-2",
      userId: heroUserTwo.id,
      zoneId: zoneMaadi.id,
      status: "ON_DELIVERY",
      currentLat: 29.9615,
      currentLng: 31.2598,
      lastPingAt: new Date(),
      bikeNumber: "MD-202",
      nationalId: "29902020202020",
      efficiencyScore: 89,
      ordersToday: 3,
      totalDeliveries: 210,
      lastOrderAt: new Date(),
      walletBalance: 1140,
      totalEarnings: 18780,
      bloodType: "A_POS",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  await prisma.heroAssignment.createMany({
    data: [
      {
        id: "assignment-1",
        heroId: heroOne.id,
        branchId: branchDokki.id,
        model: "POOL",
        startDate: new Date("2026-03-01T09:00:00Z"),
      },
      {
        id: "assignment-2",
        heroId: heroTwo.id,
        branchId: branchMaadi.id,
        model: "POOL",
        startDate: new Date("2026-03-01T09:00:00Z"),
      },
    ],
  });

  const customerProfile = await prisma.customerProfile.create({
    data: {
      id: "customer-profile-1",
      phone: "+201155500001",
      name: "Laila Hassan",
      addresses: [],
      lastAddress: "Street 9, Maadi, Building 45",
      totalOrders: 3,
      merchantId: merchant.id,
    },
  });

  const customerAddress = await prisma.customerAddressVault.create({
    data: {
      id: "customer-address-1",
      branchId: branchMaadi.id,
      phone: customerProfile.phone,
      name: customerProfile.name,
      lat: 29.9584,
      lng: 31.2571,
      addressLabel: "Street 9, Maadi, Building 45",
      usageCount: 3,
      lastUsedAt: new Date(),
    },
  });

  const requestedAtOne = new Date("2026-03-16T08:40:00Z");
  const requestedAtTwo = new Date("2026-03-16T09:10:00Z");
  const requestedAtThree = new Date("2026-03-16T09:30:00Z");

  const orderOne = await prisma.order.create({
    data: {
      id: "order-1",
      orderNumber: "AG-2026-00001",
      branchId: branchDokki.id,
      heroId: heroOne.id,
      zoneId: zoneDokki.id,
      customerPhone: "+201122233344",
      customerName: "Nour Emad",
      deliveryLat: 30.0333,
      deliveryLng: 31.2144,
      deliveryAddress: "Tahrir St, Dokki",
      pickupLat: branchDokki.lat,
      pickupLng: branchDokki.lng,
      status: "DELIVERED",
      model: "POOL",
      trackingId: "track-00001",
      distanceKm: 2.4,
      deliveryFee: 42,
      heroPayout: 33.6,
      requestedAt: requestedAtOne,
      assignedAt: new Date("2026-03-16T08:44:00Z"),
      pickedUpAt: new Date("2026-03-16T08:55:00Z"),
      deliveredAt: new Date("2026-03-16T09:14:00Z"),
      otpVerifiedAt: new Date("2026-03-16T09:14:00Z"),
    },
  });

  const orderTwo = await prisma.order.create({
    data: {
      id: "order-2",
      orderNumber: "AG-2026-00002",
      branchId: branchMaadi.id,
      heroId: heroTwo.id,
      zoneId: zoneMaadi.id,
      customerAddressId: customerAddress.id,
      customerProfileId: customerProfile.id,
      customerPhone: customerProfile.phone,
      customerName: customerProfile.name,
      deliveryLat: customerAddress.lat,
      deliveryLng: customerAddress.lng,
      deliveryAddress: customerAddress.addressLabel,
      pickupLat: branchMaadi.lat,
      pickupLng: branchMaadi.lng,
      status: "ASSIGNED",
      model: "POOL",
      trackingId: "track-00002",
      distanceKm: 1.8,
      deliveryFee: 40,
      requestedAt: requestedAtTwo,
      assignedAt: new Date("2026-03-16T09:14:00Z"),
    },
  });

  const orderThree = await prisma.order.create({
    data: {
      id: "order-3",
      orderNumber: "AG-2026-00003",
      branchId: branchMaadi.id,
      zoneId: zoneMaadi.id,
      customerAddressId: customerAddress.id,
      customerProfileId: customerProfile.id,
      customerPhone: customerProfile.phone,
      customerName: customerProfile.name,
      deliveryLat: customerAddress.lat,
      deliveryLng: customerAddress.lng,
      deliveryAddress: customerAddress.addressLabel,
      pickupLat: branchMaadi.lat,
      pickupLng: branchMaadi.lng,
      status: "REQUESTED",
      model: "POOL",
      trackingId: "track-00003",
      requestedAt: requestedAtThree,
    },
  });

  await prisma.orderStatusHistory.createMany({
    data: [
      { orderId: orderOne.id, status: "REQUESTED", note: "Order created", createdAt: requestedAtOne },
      { orderId: orderOne.id, status: "ASSIGNED", note: "Auto-assigned to Ahmed Pilot", createdAt: new Date("2026-03-16T08:44:00Z") },
      { orderId: orderOne.id, status: "PICKED_UP", note: "Package picked up", createdAt: new Date("2026-03-16T08:55:00Z") },
      { orderId: orderOne.id, status: "ON_WAY", note: "Heading to customer", createdAt: new Date("2026-03-16T09:02:00Z") },
      { orderId: orderOne.id, status: "ARRIVED", note: "Hero arrived at destination", createdAt: new Date("2026-03-16T09:11:00Z") },
      { orderId: orderOne.id, status: "DELIVERED", note: "OTP verified and delivery completed", createdAt: new Date("2026-03-16T09:14:00Z") },
      { orderId: orderTwo.id, status: "REQUESTED", note: "Order created", createdAt: requestedAtTwo },
      { orderId: orderTwo.id, status: "ASSIGNED", note: "Assigned to Sara Pilot", createdAt: new Date("2026-03-16T09:14:00Z") },
      { orderId: orderThree.id, status: "REQUESTED", note: "Awaiting dispatch", createdAt: requestedAtThree },
    ],
  });

  await prisma.breadcrumb.createMany({
    data: [
      {
        heroId: heroOne.id,
        orderId: orderOne.id,
        lat: 30.0368,
        lng: 31.2127,
        speed: 22,
        reason: "MOVING_WITH_ORDER",
        battery: 84,
        createdAt: new Date("2026-03-16T09:05:00Z"),
      },
      {
        heroId: heroTwo.id,
        orderId: orderTwo.id,
        lat: 29.9608,
        lng: 31.2584,
        speed: 18,
        reason: "MOVING_WITH_ORDER",
        battery: 76,
        createdAt: new Date("2026-03-16T09:20:00Z"),
      },
    ],
  });

  await prisma.contract.create({
    data: {
      id: "contract-1",
      brandId: merchant.id,
      type: "PER_ORDER",
      value: 40,
      currency: "EGP",
      validFrom: new Date("2026-01-01T00:00:00Z"),
      isActive: true,
      notes: "Demo merchant pricing",
    },
  });

  await prisma.transaction.createMany({
    data: [
      {
        id: "tx-1",
        type: "TOPUP",
        status: "SUCCESS",
        amount: 20000,
        merchantId: merchant.id,
        description: "Initial merchant wallet funding",
        createdAt: new Date("2026-03-15T10:00:00Z"),
      },
      {
        id: "tx-2",
        type: "ORDER_FEE",
        status: "SUCCESS",
        amount: 42,
        merchantId: merchant.id,
        orderId: orderOne.id,
        description: "Delivery fee for AG-2026-00001",
        createdAt: new Date("2026-03-16T09:15:00Z"),
      },
      {
        id: "tx-3",
        type: "ORDER_PAYOUT",
        status: "SUCCESS",
        amount: 33.6,
        heroId: heroOne.id,
        orderId: orderOne.id,
        description: "Payout for AG-2026-00001",
        createdAt: new Date("2026-03-16T09:16:00Z"),
      },
      {
        id: "tx-4",
        type: "TOPUP",
        status: "SUCCESS",
        amount: 500,
        heroId: heroTwo.id,
        description: "Hero wallet adjustment",
        createdAt: new Date("2026-03-16T09:20:00Z"),
      },
    ],
  });

  await prisma.payout.create({
    data: {
      id: "payout-1",
      heroId: heroTwo.id,
      periodStart: new Date("2026-03-10T00:00:00Z"),
      periodEnd: new Date("2026-03-16T23:59:59Z"),
      totalAmount: 520,
      orderBonus: 120,
      status: "PENDING",
    },
  });

  console.log("Seed complete.");
  console.log("Admin: admin@tayyar.app");
  console.log("Supervisor: supervisor@tayyar.app");
  console.log("Merchant: owner@merchant.com");
  console.log("Hero: hero@tayyar.app");
  console.log(`Seed users created, admin id: ${admin.id}`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
