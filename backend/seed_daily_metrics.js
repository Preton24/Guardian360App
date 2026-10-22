const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedDailyMetrics() {
  console.log("🌱 [Seed Daily Metrics] Seeding Apple Health daily metrics data...");

  // Fetch Arthur Pendelton and Tony Stark
  const users = await prisma.elderlyUser.findMany({
    where: {
      OR: [
        { id: "9108650b-cd3f-423a-86c8-85dbe87c7bdc" },
        { id: "a263f382-f9e2-4aba-b571-1c479d20a575" },
      ],
    },
  });

  if (users.length === 0) {
    console.warn("No target users found to seed metrics for.");
    return;
  }

  // 7 Days of steps matching the exact Apple Health screenshot:
  // Fri 16 Oct: 3850
  // Sat 17 Oct: 6820
  // Sun 18 Oct: 5480
  // Mon 19 Oct: 320
  // Tue 20 Oct: 7040
  // Wed 21 Oct: 310
  // Thu 22 Oct (Today): 468
  const weekData = [
    { dateStr: "2026-10-16", steps: 3850, activeKcal: 165.4, restingKcal: 1420, hr: 72, spo2: 98, cog: 80 },
    { dateStr: "2026-10-17", steps: 6820, activeKcal: 290.8, restingKcal: 1440, hr: 75, spo2: 97, cog: 82 },
    { dateStr: "2026-10-18", steps: 5480, activeKcal: 230.1, restingKcal: 1410, hr: 70, spo2: 98, cog: 81 },
    { dateStr: "2026-10-19", steps: 320,  activeKcal: 14.5,  restingKcal: 1390, hr: 68, spo2: 99, cog: 83 },
    { dateStr: "2026-10-20", steps: 7040, activeKcal: 310.2, restingKcal: 1450, hr: 74, spo2: 97, cog: 82 },
    { dateStr: "2026-10-21", steps: 310,  activeKcal: 13.8,  restingKcal: 1400, hr: 69, spo2: 98, cog: 79 },
    { dateStr: "2026-10-22", steps: 468,  activeKcal: 12.6,  restingKcal: 899,  hr: 71, spo2: 98, cog: 82 },
  ];

  // Hourly cumulative steps for Today (up to 3 PM = 468) vs Average (up to 3 PM = 887, end of day = 3658)
  const hourlyData = {
    todayHourly: [0, 0, 0, 0, 0, 15, 35, 60, 110, 160, 210, 280, 340, 395, 440, 468],
    todayCumulative: [0, 0, 0, 0, 0, 15, 50, 110, 220, 380, 590, 870, 1210, 1605, 2045, 2513], // normalized
    todayActualAt3PM: 468,
    averageAt3PM: 887,
    weekAverage: 3347,
    sevenDayAverage: 3658,
  };

  for (const user of users) {
    for (const d of weekData) {
      await prisma.dailyHealthMetric.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date: new Date(d.dateStr),
          },
        },
        create: {
          userId: user.id,
          date: new Date(d.dateStr),
          steps: d.steps,
          activeKcal: d.activeKcal,
          restingKcal: d.restingKcal,
          avgHeartRate: d.hr,
          avgSpo2: d.spo2,
          avgCognitiveScore: d.cog,
          hourlyData: d.dateStr === "2026-10-22" ? hourlyData : null,
        },
        update: {
          steps: d.steps,
          activeKcal: d.activeKcal,
          restingKcal: d.restingKcal,
          avgHeartRate: d.hr,
          avgSpo2: d.spo2,
          avgCognitiveScore: d.cog,
          hourlyData: d.dateStr === "2026-10-22" ? hourlyData : null,
        },
      });
    }
    console.log(`✅ Seeded 7 days of Apple Health metrics for ${user.name} (${user.id})`);
  }

  await prisma.$disconnect();
  console.log("🎉 [Seed Daily Metrics Complete] All metrics seeded successfully.");
}

seedDailyMetrics().catch((err) => {
  console.error("Error seeding daily metrics:", err);
  process.exit(1);
});
