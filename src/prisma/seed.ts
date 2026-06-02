import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@convera.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@1234!';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: Role.SYSTEM_ADMIN,
        isVerified: true,
        isActive: true,
      },
    });
    
    console.log(`✅ Created SYSTEM_ADMIN account: ${adminEmail}`);
  } else {
    // Optionally update the role/password to ensure it remains SYSTEM_ADMIN
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
    await prisma.user.update({
      where: { email: adminEmail },
      data: {
        passwordHash,
        role: Role.SYSTEM_ADMIN,
        isVerified: true,
        isActive: true,
      },
    });
    console.log(`✅ Updated existing SYSTEM_ADMIN account: ${adminEmail}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
