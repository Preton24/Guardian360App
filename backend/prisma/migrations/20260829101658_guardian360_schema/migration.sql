/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('NORMAL', 'ABNORMAL_GAIT', 'FALL_RISK', 'FALL_DETECTED');

-- CreateEnum
CREATE TYPE "ReminderCategory" AS ENUM ('MEDS', 'TASK', 'HABIT');

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "Caretaker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Caretaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElderlyUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "relation" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElderlyUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaretakerUser" (
    "id" TEXT NOT NULL,
    "caretakerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaretakerUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ax" DOUBLE PRECISION NOT NULL,
    "ay" DOUBLE PRECISION NOT NULL,
    "az" DOUBLE PRECISION NOT NULL,
    "gx" DOUBLE PRECISION NOT NULL,
    "gy" DOUBLE PRECISION NOT NULL,
    "gz" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FallRisk" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riskLevel" "RiskLevel" NOT NULL,
    "riskScore" DECIMAL(5,4) NOT NULL,
    "eventType" "EventType" NOT NULL,

    CONSTRAINT "FallRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "notes" TEXT,
    "date" DATE NOT NULL,
    "time" TIME,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "category" "ReminderCategory" NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Caretaker_email_key" ON "Caretaker"("email");

-- CreateIndex
CREATE INDEX "CaretakerUser_caretakerId_idx" ON "CaretakerUser"("caretakerId");

-- CreateIndex
CREATE INDEX "CaretakerUser_userId_idx" ON "CaretakerUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CaretakerUser_caretakerId_userId_key" ON "CaretakerUser"("caretakerId", "userId");

-- CreateIndex
CREATE INDEX "SensorReading_userId_timestamp_idx" ON "SensorReading"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "FallRisk_userId_timestamp_idx" ON "FallRisk"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "Reminder_userId_date_idx" ON "Reminder"("userId", "date");

-- AddForeignKey
ALTER TABLE "CaretakerUser" ADD CONSTRAINT "CaretakerUser_caretakerId_fkey" FOREIGN KEY ("caretakerId") REFERENCES "Caretaker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaretakerUser" ADD CONSTRAINT "CaretakerUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ElderlyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ElderlyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FallRisk" ADD CONSTRAINT "FallRisk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ElderlyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ElderlyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
