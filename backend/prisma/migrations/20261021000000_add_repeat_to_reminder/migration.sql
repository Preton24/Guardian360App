-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "repeat" VARCHAR(50) DEFAULT 'Never';
