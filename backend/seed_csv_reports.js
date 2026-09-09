const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CSV_FILE_PATH = path.join(__dirname, 'voice_analysis_reports.csv');

const CSV_HEADER = 'id,userId,timestamp,speechRateWpm,pauseFrequency,pitchVariability,jitterShimmerRatio,articulationScore,cognitiveHealthScore,cognitiveStatus,confidenceScore\n';

async function seedCsvReports() {
  console.log('📊 Seeding voice_analysis_reports.csv...');

  let users = await prisma.elderlyUser.findMany();
  if (users.length === 0) {
    console.log('No users found in DB, using fallback IDs');
    users = [{ id: 'default-user-id', name: 'Tony Stark' }];
  }

  let csvContent = CSV_HEADER;
  let reportIdCounter = 1;

  const now = Date.now();
  const DAY_MS = 86400000;

  for (const user of users) {
    // Generate 12 past trend points (every 3 days over the last month)
    const baseScores = [74.5, 76.0, 78.2, 77.5, 80.1, 82.4, 85.0, 84.2, 87.6, 89.1, 91.0, 93.5];
    
    baseScores.forEach((score, index) => {
      const daysAgo = (12 - index) * 3;
      const timestamp = new Date(now - daysAgo * DAY_MS).toISOString();
      const reportId = `VAR-${reportIdCounter++}`;
      
      const speechRate = Math.round(110 + (score / 100) * 45);
      const pauseFreq = ( (100 - score) / 10 ).toFixed(1);
      const pitchVar = (20 + (score / 100) * 25).toFixed(1);
      const jitterRatio = ( (100 - score) / 35 ).toFixed(2);
      const articulation = (5.5 + (score / 100) * 4.0).toFixed(1);
      
      let status = 'NORMAL';
      if (score < 60) status = 'HIGH_RISK';
      else if (score < 80) status = 'MILD_COGNITIVE_IMPAIRMENT_RISK';
      
      const confidence = (0.88 + (index % 5) * 0.02).toFixed(2);

      csvContent += `${reportId},${user.id},${timestamp},${speechRate},${pauseFreq},${pitchVar},${jitterRatio},${articulation},${score.toFixed(1)},${status},${confidence}\n`;
    });
  }

  // Also include fallback user entries so default-user-id always has historical trend data
  if (!users.find((u) => u.id === 'default-user-id')) {
    const baseScores = [72.0, 74.0, 76.5, 78.0, 81.0, 83.5, 86.0, 87.5, 88.0, 90.5, 92.0, 94.0];
    baseScores.forEach((score, index) => {
      const daysAgo = (12 - index) * 3;
      const timestamp = new Date(now - daysAgo * DAY_MS).toISOString();
      const reportId = `VAR-${reportIdCounter++}`;

      const speechRate = Math.round(110 + (score / 100) * 45);
      const pauseFreq = ((100 - score) / 10).toFixed(1);
      const pitchVar = (20 + (score / 100) * 25).toFixed(1);
      const jitterRatio = ((100 - score) / 35).toFixed(2);
      const articulation = (5.5 + (score / 100) * 4.0).toFixed(1);

      let status = 'NORMAL';
      if (score < 60) status = 'HIGH_RISK';
      else if (score < 80) status = 'MILD_COGNITIVE_IMPAIRMENT_RISK';

      const confidence = (0.88 + (index % 5) * 0.02).toFixed(2);

      csvContent += `${reportId},default-user-id,${timestamp},${speechRate},${pauseFreq},${pitchVar},${jitterRatio},${articulation},${score.toFixed(1)},${status},${confidence}\n`;
    });
  }

  fs.writeFileSync(CSV_FILE_PATH, csvContent, 'utf-8');
  console.log(`✅ CSV generated successfully at ${CSV_FILE_PATH}`);
}

seedCsvReports()
  .catch((err) => console.error('Error generating CSV reports:', err))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
