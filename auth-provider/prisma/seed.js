require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const crypto = require('crypto');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sso_db?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('🌱 Starting database seeding...');
  // buat admin
  const adminPasswordHash = hashPassword('admin123');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@sso.local' },
    update: {
      name: 'Admin Master',
      password_hash: adminPasswordHash,
      status: 'active',
    },
    create: {
      name: 'Admin Master',
      email: 'admin@sso.local',
      password_hash: adminPasswordHash,
      status: 'active',
    },
  });
  console.log(`✅ User Admin created/updated: ${adminUser.email}`);
  // buat grup dasar
  const groupData = [
    { name: 'administrators', description: 'System Administrators with full access' },
    { name: 'app-a-users', description: 'Users allowed to access App A' },
    { name: 'app-b-users', description: 'Users allowed to access App B' },
  ];
  const groups = {};
  for (const g of groupData) {
    const group = await prisma.group.upsert({
      where: { name: g.name },
      update: { description: g.description },
      create: { name: g.name, description: g.description },
    });
    groups[g.name] = group;
    console.log(`✅ Group created/updated: ${group.name}`);
  }
  // assign admin ke seluruh grup
  for (const groupName of Object.keys(groups)) {
    await prisma.userGroup.upsert({
      where: {
        user_id_group_id: {
          user_id: adminUser.id,
          group_id: groups[groupName].id,
        },
      },
      update: {},
      create: {
        user_id: adminUser.id,
        group_id: groups[groupName].id,
      },
    });
  }
  console.log(`✅ Admin user assigned to all default groups`);
  // daftarkan app A
  const appA = await prisma.application.upsert({
    where: { client_id: 'app-a' },
    update: {
      name: 'App A',
      status: 'active',
      launch_url: 'http://localhost:3001',
      logout_notification_url: 'http://localhost:3001/internal/logout',
    },
    create: {
      name: 'App A',
      client_id: 'app-a',
      status: 'active',
      launch_url: 'http://localhost:3001',
      logout_notification_url: 'http://localhost:3001/internal/logout',
    },
  });
  console.log(`✅ Application App A created/updated: ${appA.client_id}`);
  // redirect uri app a
  const appARedirectUris = ['http://localhost:3001/callback', 'http://localhost:3001/api/auth/callback'];
  for (const uri of appARedirectUris) {
    const existing = await prisma.applicationRedirectUri.findFirst({
      where: { application_id: appA.id, redirect_uri: uri },
    });
    if (!existing) {
      await prisma.applicationRedirectUri.create({
        data: { application_id: appA.id, redirect_uri: uri },
      });
    }
  }
  // policies app a
  const appAGroups = ['administrators', 'app-a-users'];
  for (const groupName of appAGroups) {
    await prisma.applicationGroupPolicy.upsert({
      where: {
        application_id_group_id_effect: {
          application_id: appA.id,
          group_id: groups[groupName].id,
          effect: 'allow',
        },
      },
      update: {},
      create: {
        application_id: appA.id,
        group_id: groups[groupName].id,
        effect: 'allow',
      },
    });
  }
  // daftarkan app B
  const appB = await prisma.application.upsert({
    where: { client_id: 'app-b' },
    update: {
      name: 'App B',
      status: 'active',
      launch_url: 'http://localhost:3002',
      logout_notification_url: 'http://localhost:3002/internal/logout',
    },
    create: {
      name: 'App B',
      client_id: 'app-b',
      status: 'active',
      launch_url: 'http://localhost:3002',
      logout_notification_url: 'http://localhost:3002/internal/logout',
    },
  });
  console.log(`✅ Application App B created/updated: ${appB.client_id}`);
  // redirect uri app b
  const appBRedirectUris = ['http://localhost:3002/callback', 'http://localhost:3002/api/auth/callback'];
  for (const uri of appBRedirectUris) {
    const existing = await prisma.applicationRedirectUri.findFirst({
      where: { application_id: appB.id, redirect_uri: uri },
    });
    if (!existing) {
      await prisma.applicationRedirectUri.create({
        data: { application_id: appB.id, redirect_uri: uri },
      });
    }
  }
  // policies app b
  const appBGroups = ['administrators', 'app-b-users'];
  for (const groupName of appBGroups) {
    await prisma.applicationGroupPolicy.upsert({
      where: {
        application_id_group_id_effect: {
          application_id: appB.id,
          group_id: groups[groupName].id,
          effect: 'allow',
        },
      },
      update: {},
      create: {
        application_id: appB.id,
        group_id: groups[groupName].id,
        effect: 'allow',
      },
    });
  }

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
