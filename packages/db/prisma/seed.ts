import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with default accounts...');
  const passwordHash = await bcrypt.hash('Tayyar@123', 10);

  // 1. Create Users first
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@antigravity.local' },
    update: {},
    create: {
      email: 'admin@antigravity.local',
      name: 'System Admin',
      role: 'ADMIN',
      isActive: true,
      passwordHash,
    },
  });

  const merchantOwner = await prisma.user.upsert({
    where: { email: 'merchant@antigravity.local' },
    update: {},
    create: {
      email: 'merchant@antigravity.local',
      name: 'Dokki Dispatcher',
      role: 'MERCHANT_OWNER',
      isActive: true,
      passwordHash,
    },
  });

  const supervisorUser = await prisma.user.upsert({
    where: { email: 'supervisor@antigravity.local' },
    update: {},
    create: {
      email: 'supervisor@antigravity.local',
      name: 'Zone Supervisor',
      role: 'SUPERVISOR',
      isActive: true,
      passwordHash,
    },
  });

  // 2. Create Zone and Brand using predefined IDs
  const mainZone = await prisma.zone.upsert({
    where: { id: 'default-zone-id' },
    update: {},
    create: {
      id: 'default-zone-id',
      name: 'Dokki Central',
      nameAr: 'وسط الدقي',
      boundaryWkt: 'POLYGON((31.19 30.05, 31.21 30.05, 31.21 30.03, 31.19 30.03, 31.19 30.05))',
      city: 'Giza',
      isActive: true,
    },
  });

  const theBrand = await prisma.merchantBrand.upsert({
    where: { ownerId: merchantOwner.id },
    update: {},
    create: {
      id: 'default-brand-id',
      name: 'Tayyar Default Merchant',
      ownerId: merchantOwner.id,
      isActive: true,
    },
  });

  const mainBranch = await prisma.branch.upsert({
    where: { id: 'default-branch-id' },
    update: {},
    create: {
      id: 'default-branch-id',
      brandId: theBrand.id,
      managerId: merchantOwner.id,
      name: 'Dokki Branch',
      address: '123 Fake Street',
      lat: 30.038,
      lng: 31.211,
      isActive: true,
    },
  });

  // Assign Supervisor to Zone
  await prisma.supervisorZone.upsert({
     where: { supervisorId_zoneId: { supervisorId: supervisorUser.id, zoneId: mainZone.id } },
     update: {},
     create: { supervisorId: supervisorUser.id, zoneId: mainZone.id }
  });

  // Assign Supervisor to Zone
  await prisma.supervisorZone.upsert({
     where: { supervisorId_zoneId: { supervisorId: supervisorUser.id, zoneId: mainZone.id } },
     update: {},
     create: { supervisorId: supervisorUser.id, zoneId: mainZone.id }
  });

  console.log('✅ Seeding complete!');
  console.log('----------------------------------------------------');
  console.log('Admin Login:      admin@antigravity.local / ag_password');
  console.log('Merchant Login:   merchant@antigravity.local / ag_password');
  console.log('Supervisor Login: supervisor@antigravity.local / ag_password');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
