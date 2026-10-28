const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

const USER_ID = "a263f382-f9e2-4aba-b571-1c479d20a575"; // Tony Stark
const TAG = "seed:routine-history";
const ROUTINES = [
  { title: "Medicine 2", category: "MEDS", hour: 8, urgent: true },
  { title: "Park laughing club", category: "HABIT", hour: 6, urgent: false },
  { title: "Gym", category: "HABIT", hour: 18, urgent: false },
];

// Deterministic pseudo-random so reruns give the same calendar
let seed = 20261028;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  await prisma.reminder.deleteMany({ where: { userId: USER_ID, notes: TAG } });

  const rows = [];
  const summary = [];
  for (let day = 1; day < today; day++) {
    const dow = new Date(year, month, day).getDay();
    // Skip ~1-2 days a week so it's 5-6 active days: always skip one rest day, sometimes a second
    const restDay = dow === 0 || (dow === 3 && rand() < 0.35);
    if (restDay) continue;

    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    // Gym only on some days; meds and laughing club most days
    const todays = ROUTINES.filter((r) => r.title !== "Gym" || rand() < 0.7);
    // Pick how many of the day's tasks get done: full day ~35%, otherwise partial
    const roll = rand();
    let doneCount;
    if (roll < 0.35) doneCount = todays.length;
    else if (roll < 0.8) doneCount = Math.max(1, Math.round(todays.length * (0.34 + rand() * 0.4)));
    else doneCount = Math.min(1, todays.length - 1) || 1;
    if (doneCount >= todays.length && roll >= 0.35) doneCount = todays.length - 1;

    const order = [...todays].sort(() => rand() - 0.5);
    const doneSet = new Set(order.slice(0, doneCount).map((r) => r.title));
    summary.push(`${dateStr} ${doneCount}/${todays.length}`);

    for (const r of todays) {
      const done = doneSet.has(r.title);
      rows.push({
        userId: USER_ID,
        title: r.title,
        notes: TAG,
        date: new Date(`${dateStr}T00:00:00.000Z`),
        time: new Date(`1970-01-01T${String(r.hour).padStart(2, "0")}:00:00.000Z`),
        urgent: r.urgent,
        category: r.category,
        repeat: "Never",
        completed: done,
        createdAt: new Date(`${dateStr}T05:00:00.000Z`),
        updatedAt: new Date(`${dateStr}T${String(r.hour + 1).padStart(2, "0")}:00:00.000Z`),
      });
    }
  }

  await prisma.reminder.createMany({ data: rows });
  console.log(`Inserted ${rows.length} reminders over ${summary.length} days`);
  console.log(summary.join("\n"));
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
