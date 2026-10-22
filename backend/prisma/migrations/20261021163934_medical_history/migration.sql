-- CreateEnum
CREATE TYPE "RecordType" AS ENUM ('CONSULTATION', 'PRESCRIPTION', 'LAB_REPORT', 'IMAGING', 'DISCHARGE', 'VACCINATION', 'OTHER');

-- AlterTable
ALTER TABLE "ElderlyUser" ADD COLUMN     "chronicConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "gender" TEXT;

-- AlterTable
ALTER TABLE "SensorReading" ADD COLUMN     "heartRate" DOUBLE PRECISION,
ADD COLUMN     "spo2" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "MedicalRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "RecordType" NOT NULL,
    "recordDate" DATE NOT NULL,
    "doctorName" TEXT,
    "specialty" TEXT,
    "facility" TEXT,
    "diagnosis" TEXT,
    "complaints" TEXT,
    "notes" TEXT,
    "vitals" JSONB,
    "followUpDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "strength" TEXT,
    "dosePattern" TEXT,
    "timing" TEXT,
    "durationDays" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "stoppedAt" DATE,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordFile" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "substance" TEXT NOT NULL,
    "reaction" TEXT,

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paragraph" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicalRecord_userId_recordDate_idx" ON "MedicalRecord"("userId", "recordDate");

-- CreateIndex
CREATE INDEX "Medication_userId_endDate_idx" ON "Medication"("userId", "endDate");

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ElderlyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordFile" ADD CONSTRAINT "RecordFile_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ElderlyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthSummary" ADD CONSTRAINT "HealthSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ElderlyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
