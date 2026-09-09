const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create Default Caretaker
  const caretaker = await prisma.caretaker.upsert({
    where: { email: 'steve.rogers@example.com' },
    update: {},
    create: {
      name: 'Steve Rogers',
      email: 'steve.rogers@example.com',
      contact: '+91 9876543210',
    },
  });
  console.log('✅ Caretaker created:', caretaker.name);

  // 2. Create Elderly Users
  let user1 = await prisma.elderlyUser.findFirst({
    where: { name: 'Tony Stark' },
  });
  if (!user1) {
    user1 = await prisma.elderlyUser.create({
      data: {
        name: 'Tony Stark',
        age: 78,
        relation: 'Father',
        contact: '+91 9876543211',
      },
    });
  }

  let user2 = await prisma.elderlyUser.findFirst({
    where: { name: 'Peggy Carter' },
  });
  if (!user2) {
    user2 = await prisma.elderlyUser.create({
      data: {
        name: 'Peggy Carter',
        age: 82,
        relation: 'Mother',
        contact: '+91 9876543212',
      },
    });
  }
  console.log('✅ Elderly users created:', user1.name, ',', user2.name);

  // 3. Link Caretaker to Elderly Users
  await prisma.caretakerUser.upsert({
    where: {
      caretakerId_userId: {
        caretakerId: caretaker.id,
        userId: user1.id,
      },
    },
    update: {},
    create: {
      caretakerId: caretaker.id,
      userId: user1.id,
    },
  });

  await prisma.caretakerUser.upsert({
    where: {
      caretakerId_userId: {
        caretakerId: caretaker.id,
        userId: user2.id,
      },
    },
    update: {},
    create: {
      caretakerId: caretaker.id,
      userId: user2.id,
    },
  });
  console.log('✅ Caretaker ↔ Elderly Users linked.');

  // 4. Seed Reminders for Tony Stark
  const reminderCount = await prisma.reminder.count({ where: { userId: user1.id } });
  if (reminderCount === 0) {
    await prisma.reminder.createMany({
      data: [
        {
          userId: user1.id,
          title: 'Morning Heart & BP Medication',
          notes: 'Take 1 pill of Aspirin after breakfast',
          date: new Date(),
          urgent: true,
          category: 'MEDS',
          repeat: 'Daily',
          completed: false,
        },
        {
          userId: user1.id,
          title: 'Evening Physical Therapy Walk',
          notes: 'Light 15-min walk in garden with support',
          date: new Date(),
          urgent: false,
          category: 'HABIT',
          repeat: 'Daily',
          completed: false,
        },
        {
          userId: user1.id,
          title: 'Doctor Appointment Checkup',
          notes: 'Dr. Banner consultation at City Hospital',
          date: new Date(Date.now() + 86400000),
          urgent: true,
          category: 'TASK',
          repeat: 'Never',
          completed: false,
        },
      ],
    });
    console.log('✅ Reminders created for', user1.name);
  }

  // 5. Seed Fall Risk Events
  const fallRiskCount = await prisma.fallRisk.count({ where: { userId: user1.id } });
  if (fallRiskCount === 0) {
    await prisma.fallRisk.create({
      data: {
        userId: user1.id,
        riskLevel: 'LOW',
        riskScore: 0.08,
        eventType: 'NORMAL',
      },
    });
    console.log('✅ Initial Fall Risk record created.');
  }

  console.log('🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
