const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

const USER_ID = "a263f382-f9e2-4aba-b571-1c479d20a575"; // Tony Stark
const TARGET_AVG = 1000;

// Deterministic pseudo-random so reruns give the same numbers
let seed = 1028;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const between = (min, max) => min + rand() * (max - min);

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const existing = await prisma.dailyHealthMetric.findMany({ where: { userId: USER_ID }, select: { date: true } });
  const have = new Set(existing.map((m) => m.date.toISOString().slice(0, 10)));

  const out = [];
  for (let day = 1; day < today; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (have.has(dateStr)) continue; // keep the screenshot-matched days untouched

    // Mostly 600-1400 steps, with the odd very quiet day and the odd busier one
    const roll = rand();
    let steps;
    if (roll < 0.15) steps = between(250, 500);
    else if (roll < 0.85) steps = between(650, 1350);
    else steps = between(1500, 1900);
    steps = Math.round(steps * (TARGET_AVG / 1000));

    await prisma.dailyHealthMetric.create({
      data: {
        userId: USER_ID,
        date: new Date(dateStr),
        steps,
        activeKcal: Math.round(steps * 0.043 * 10) / 10,
        restingKcal: Math.round(between(1380, 1450)),
        avgHeartRate: Math.round(between(67, 75)),
        avgSpo2: Math.round(between(97, 99)),
        avgCognitiveScore: Math.round(between(78, 84)),
      },
    });
    out.push({ dateStr, steps });
  }

  const avg = out.reduce((a, b) => a + b.steps, 0) / (out.length || 1);
  console.log(`Added ${out.length} days, average ${Math.round(avg)} steps`);
  console.log(out.map((o) => `${o.dateStr} ${o.steps}`).join("\n"));
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
