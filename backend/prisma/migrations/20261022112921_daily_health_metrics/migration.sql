-- CreateTable
CREATE TABLE "DailyHealthMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "activeKcal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "restingKcal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgHeartRate" DOUBLE PRECISION,
    "avgSpo2" DOUBLE PRECISION,
    "avgCognitiveScore" DOUBLE PRECISION,
    "hourlyData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyHealthMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyHealthMetric_userId_date_idx" ON "DailyHealthMetric"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyHealthMetric_userId_date_key" ON "DailyHealthMetric"("userId", "date");

-- AddForeignKey
ALTER TABLE "DailyHealthMetric" ADD CONSTRAINT "DailyHealthMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ElderlyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
