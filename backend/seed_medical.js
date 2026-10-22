require("./dns-resolver");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedMedicalData() {
  console.log("🌱 [Seed Medical] Seeding Medical History Vault & Doctor Summary demo data...");

  // 1. Get or create Caretaker
  let caretaker = await prisma.caretaker.findFirst({
    where: { email: "steve.rogers@example.com" },
  });

  if (!caretaker) {
    caretaker = await prisma.caretaker.create({
      data: {
        name: "Steve Rogers",
        email: "steve.rogers@example.com",
        contact: "+91 9876543210",
      },
    });
  }

  // 2. Get or create Demo Elderly User: Arthur Pendelton
  let user = await prisma.elderlyUser.findFirst({
    where: { name: "Arthur Pendelton" },
  });

  const birthDate = new Date("1944-04-12");

  if (!user) {
    user = await prisma.elderlyUser.create({
      data: {
        name: "Arthur Pendelton",
        age: 82,
        relation: "Grandfather",
        contact: "+91 9123456789",
        gender: "Male",
        dateOfBirth: birthDate,
        chronicConditions: ["Hypertension", "Type 2 Diabetes", "Mild Osteoarthritis"],
      },
    });
  } else {
    user = await prisma.elderlyUser.update({
      where: { id: user.id },
      data: {
        gender: "Male",
        dateOfBirth: birthDate,
        chronicConditions: ["Hypertension", "Type 2 Diabetes", "Mild Osteoarthritis"],
      },
    });
  }

  // 3. Link Caretaker and User
  await prisma.caretakerUser.upsert({
    where: {
      caretakerId_userId: {
        caretakerId: caretaker.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      caretakerId: caretaker.id,
      userId: user.id,
    },
  });

  console.log(`✅ Caretaker linked to Demo User: ${user.name} (${user.id})`);

  // Clear existing sample medical records, allergies, and summaries for idempotent seeding
  await prisma.healthSummary.deleteMany({ where: { userId: user.id } });
  await prisma.medicalRecord.deleteMany({ where: { userId: user.id } });
  await prisma.allergy.deleteMany({ where: { userId: user.id } });

  // 4. Seed Allergy
  const allergy = await prisma.allergy.create({
    data: {
      userId: user.id,
      substance: "Penicillin",
      reaction: "Cutaneous hives, facial erythema, and mild dyspnea",
    },
  });
  console.log(`✅ Allergy seeded: ${allergy.substance}`);

  const now = new Date();
  const dayMs = 86400000;

  // 5. Seed 3 Consultations with 2 doctors over 3 months
  // Consultation 1: 85 days ago - Dr. Anita Rao (Cardiology)
  const date1 = new Date(now.getTime() - 85 * dayMs);
  const rec1 = await prisma.medicalRecord.create({
    data: {
      userId: user.id,
      type: "CONSULTATION",
      recordDate: date1,
      doctorName: "Dr. Anita Rao",
      specialty: "Cardiology",
      facility: "Apollo Specialty Clinic",
      diagnosis: "Essential Hypertension - Baseline Staging",
      complaints: "Intermittent morning occipital headaches and mild exertional fatigue",
      notes: "Initiated angiotensin II receptor blocker monotherapy. Recommended daily sodium restriction (<2g/day).",
      vitals: { bp: "148/92 mmHg", pulse: 76, weight: "72.4 kg" },
      followUpDate: new Date(now.getTime() - 45 * dayMs),
      medications: {
        create: [
          {
            userId: user.id,
            name: "Telma 40",
            genericName: "Telmisartan",
            strength: "40 mg",
            dosePattern: "1-0-0",
            timing: "morning before food",
            durationDays: 90,
            startDate: date1,
            endDate: null, // ongoing
          },
        ],
      },
    },
  });

  // Prescription 1: 85 days ago
  await prisma.medicalRecord.create({
    data: {
      userId: user.id,
      type: "PRESCRIPTION",
      recordDate: date1,
      doctorName: "Dr. Anita Rao",
      specialty: "Cardiology",
      facility: "Apollo Specialty Clinic",
      diagnosis: "Hypertension Pharmacotherapy Order",
      notes: "Sample prescription slip for Telmisartan 40mg once daily in morning.",
      medications: {
        create: [
          {
            userId: user.id,
            name: "Telma 40",
            genericName: "Telmisartan",
            strength: "40 mg",
            dosePattern: "1-0-0",
            timing: "morning before food",
            durationDays: 90,
            startDate: date1,
          },
        ],
      },
    },
  });

  // Consultation 2: 42 days ago - Dr. Rajesh Verma (General Physician) - adds new BP drug Amlodipine
  const date2 = new Date(now.getTime() - 42 * dayMs);
  const rec2 = await prisma.medicalRecord.create({
    data: {
      userId: user.id,
      type: "CONSULTATION",
      recordDate: date2,
      doctorName: "Dr. Rajesh Verma",
      specialty: "General Physician",
      facility: "Metro Health Care Center",
      diagnosis: "Uncontrolled Hypertension & Bilateral Knee Osteoarthritis",
      complaints: "Sustained elevated home BP readings and right knee mechanical stiffness",
      notes: "Added calcium channel blocker (Amlodipine 5mg) to control morning systolic spikes. Advised gentle mobilization.",
      vitals: { bp: "152/94 mmHg", pulse: 80, weight: "71.8 kg" },
      followUpDate: new Date(now.getTime() - 10 * dayMs),
      medications: {
        create: [
          {
            userId: user.id,
            name: "Amlokind 5",
            genericName: "Amlodipine",
            strength: "5 mg",
            dosePattern: "0-0-1",
            timing: "night after food",
            durationDays: 60,
            startDate: date2,
            endDate: null, // ongoing
          },
        ],
      },
    },
  });

  // Prescription 2: 42 days ago - adds Amlodipine 5mg
  await prisma.medicalRecord.create({
    data: {
      userId: user.id,
      type: "PRESCRIPTION",
      recordDate: date2,
      doctorName: "Dr. Rajesh Verma",
      specialty: "General Physician",
      facility: "Metro Health Care Center",
      diagnosis: "Antihypertensive Combination Regimen",
      notes: "Prescribed Amlodipine 5mg at bedtime.",
      medications: {
        create: [
          {
            userId: user.id,
            name: "Amlokind 5",
            genericName: "Amlodipine",
            strength: "5 mg",
            dosePattern: "0-0-1",
            timing: "night after food",
            durationDays: 60,
            startDate: date2,
          },
        ],
      },
    },
  });

  // Lab Report: 28 days ago
  const dateLab = new Date(now.getTime() - 28 * dayMs);
  await prisma.medicalRecord.create({
    data: {
      userId: user.id,
      type: "LAB_REPORT",
      recordDate: dateLab,
      doctorName: "Dr. Rajesh Verma",
      specialty: "Clinical Pathology",
      facility: "Metropolis Diagnostics",
      diagnosis: "Routine Metabolic & Renal Safety Screen",
      notes: "Renal markers stable. Fasting blood glucose 118 mg/dL, HbA1c 6.8%, Serum Creatinine 1.08 mg/dL, eGFR 72 mL/min.",
      vitals: { fbs: "118 mg/dL", hba1c: "6.8%", creatinine: "1.08 mg/dL" },
    },
  });

  // Consultation 3: 10 days ago - Dr. Anita Rao (Cardiology) - Review post drug change
  const date3 = new Date(now.getTime() - 10 * dayMs);
  await prisma.medicalRecord.create({
    data: {
      userId: user.id,
      type: "CONSULTATION",
      recordDate: date3,
      doctorName: "Dr. Anita Rao",
      specialty: "Cardiology",
      facility: "Apollo Specialty Clinic",
      diagnosis: "Hypertension Review & Postural Instability Surveillance",
      complaints: "BP normalized, but patient experienced two episodes of dizziness and near-fall on waking",
      notes: "Dual therapy achieved target BP (126/80 mmHg). Patient reported lightheadedness upon rapid postural transition. Advised slow standing.",
      vitals: { bp: "126/80 mmHg", pulse: 70, weight: "71.2 kg" },
      followUpDate: new Date(now.getTime() + 30 * dayMs),
    },
  });

  // Also seed a stopped past medication to verify active vs stopped filtering
  const datePast = new Date(now.getTime() - 100 * dayMs);
  const dateStopped = new Date(now.getTime() - 50 * dayMs);
  await prisma.medicalRecord.create({
    data: {
      userId: user.id,
      type: "PRESCRIPTION",
      recordDate: datePast,
      doctorName: "Dr. Rajesh Verma",
      specialty: "General Physician",
      facility: "City Care Clinic",
      diagnosis: "Past Gastritis Treatment",
      notes: "Course completed and discontinued.",
      medications: {
        create: [
          {
            userId: user.id,
            name: "Pantocid 40",
            genericName: "Pantoprazole",
            strength: "40 mg",
            dosePattern: "1-0-0",
            timing: "morning before breakfast",
            durationDays: 30,
            startDate: datePast,
            endDate: dateStopped,
            stoppedAt: dateStopped,
          },
        ],
      },
    },
  });

  console.log("✅ Seeded 3 consultations, 2 prescriptions, 1 lab report, active and stopped medications.");

  // 6. Seed Falls (FALL_DETECTED) after the drug change
  await prisma.fallRisk.deleteMany({ where: { userId: user.id } });
  const fallDates = [
    new Date(now.getTime() - 25 * dayMs),
    new Date(now.getTime() - 14 * dayMs),
  ];

  for (const fDate of fallDates) {
    await prisma.fallRisk.create({
      data: {
        userId: user.id,
        timestamp: fDate,
        riskLevel: "CRITICAL",
        riskScore: 0.94,
        eventType: "FALL_DETECTED",
      },
    });
  }
  console.log(`✅ Seeded ${fallDates.length} FALL_DETECTED events occurring after BP medication escalation.`);

  // 7. Seed Sensor Readings with heart rate and SpO2
  await prisma.sensorReading.deleteMany({ where: { userId: user.id } });
  const readingsToCreate = [];

  // Previous 30 days (days 31 to 60): HR ~78 bpm, SpO2 ~98%
  for (let d = 31; d <= 60; d += 2) {
    readingsToCreate.push({
      userId: user.id,
      timestamp: new Date(now.getTime() - d * dayMs),
      ax: 0.05,
      ay: -0.02,
      az: 9.81,
      gx: 0.1,
      gy: -0.1,
      gz: 0.0,
      heartRate: 77.5 + ((d % 3) - 1) * 1.5,
      spo2: 98.0,
    });
  }

  // Last 30 days (days 1 to 30): HR ~71 bpm, SpO2 ~96.5%
  for (let d = 1; d <= 30; d += 2) {
    readingsToCreate.push({
      userId: user.id,
      timestamp: new Date(now.getTime() - d * dayMs),
      ax: 0.08,
      ay: -0.04,
      az: 9.79,
      gx: 0.2,
      gy: -0.1,
      gz: 0.1,
      heartRate: 71.0 + ((d % 4) - 1.5) * 1.2,
      spo2: 96.5 + (d % 2 ? 0.5 : -0.5),
    });
  }

  await prisma.sensorReading.createMany({
    data: readingsToCreate,
  });
  console.log(`✅ Seeded ${readingsToCreate.length} sensor readings with Heart Rate & SpO2 vitals.`);

  // 8. Seed Reminders for MEDS with some missed in the last 30 days
  await prisma.reminder.deleteMany({ where: { userId: user.id, category: "MEDS" } });
  const remindersToCreate = [];

  for (let d = 1; d <= 30; d++) {
    // 24 completed, 6 missed -> ~80% completion rate
    const isCompleted = d % 5 !== 0;
    const rDate = new Date(now.getTime() - d * dayMs);
    remindersToCreate.push({
      userId: user.id,
      title: "Telma 40 (Morning)",
      notes: "Take 1 tablet before breakfast",
      date: rDate,
      time: rDate,
      urgent: true,
      category: "MEDS",
      repeat: "Daily",
      completed: isCompleted,
    });
  }

  await prisma.reminder.createMany({
    data: remindersToCreate,
  });
  console.log(`✅ Seeded 30 MEDS reminders with 24 completed (~80% adherence).`);

  // 9. Append historical voice analysis records to CSV for Arthur Pendelton
  const CSV_FILE_PATH = path.join(__dirname, "voice_analysis_reports.csv");
  const voiceLines = [];
  // Trend showing mild score decrease post drug change
  const scores = [88.5, 87.0, 85.5, 84.0, 81.2, 79.5, 78.0];
  scores.forEach((sc, idx) => {
    const daysAgo = (scores.length - idx) * 8;
    const ts = new Date(now.getTime() - daysAgo * dayMs).toISOString();
    const repId = `VAR-ART-${idx + 1}`;
    const status = sc >= 80 ? "NORMAL" : "MILD_COGNITIVE_IMPAIRMENT_RISK";
    voiceLines.push(`${repId},${user.id},${ts},132,1.4,32.0,1.2,8.4,${sc.toFixed(1)},${status},0.91`);
  });

  if (fs.existsSync(CSV_FILE_PATH)) {
    fs.appendFileSync(CSV_FILE_PATH, "\n" + voiceLines.join("\n") + "\n", "utf-8");
    console.log(`✅ Appended ${scores.length} cognitive trend voice records to voice_analysis_reports.csv.`);
  }

  console.log("\n🎉 [Seed Medical Complete] Successfully seeded comprehensive medical history for Arthur Pendelton.");
  console.log(`Demo User ID: ${user.id}`);
  console.log(`Caretaker ID: ${caretaker.id}`);
}

seedMedicalData()
  .catch((err) => {
    console.error("❌ Seed Medical failed:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
