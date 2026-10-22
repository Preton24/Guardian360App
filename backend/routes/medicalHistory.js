const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { z } = require("zod");
const { generateDoctorSummary } = require("../services/doctorSummary");

// Ensure upload storage directory exists
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "records");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `rec-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only images (JPEG, PNG, WEBP) and PDFs are allowed."));
    }
  },
});

// Zod schemas
const RecordTypeEnum = z.enum([
  "CONSULTATION",
  "PRESCRIPTION",
  "LAB_REPORT",
  "IMAGING",
  "DISCHARGE",
  "VACCINATION",
  "OTHER",
]);

const MedicationSchema = z.object({
  name: z.string().min(1, "Medication name is required"),
  genericName: z.string().optional().nullable(),
  strength: z.string().optional().nullable(),
  dosePattern: z.string().optional().nullable(),
  timing: z.string().optional().nullable(),
  durationDays: z.number().int().positive().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  stoppedAt: z.string().optional().nullable(),
});

const CreateRecordSchema = z.object({
  type: RecordTypeEnum,
  recordDate: z.string().min(1, "Record date is required"),
  doctorName: z.string().optional().nullable(),
  specialty: z.string().optional().nullable(),
  facility: z.string().optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  complaints: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  vitals: z.any().optional().nullable(),
  followUpDate: z.string().optional().nullable(),
  medications: z.array(MedicationSchema).optional().default([]),
});

const UpdateRecordSchema = CreateRecordSchema.partial();

const CreateAllergySchema = z.object({
  substance: z.string().min(1, "Substance is required"),
  reaction: z.string().optional().nullable(),
});

function createMedicalHistoryRouter(prisma) {
  const router = express.Router();

  // Authentication Middleware
  async function authenticateCaretaker(req, res, next) {
    const authHeader = req.headers.authorization;
    const caretakerHeader = req.headers["x-caretaker-id"];
    let caretakerId = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      caretakerId = authHeader.substring(7).trim();
    } else if (caretakerHeader) {
      caretakerId = caretakerHeader.trim();
    }

    if (!caretakerId) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication credentials" });
    }

    try {
      const caretaker = await prisma.caretaker.findUnique({
        where: { id: caretakerId },
      });

      if (!caretaker) {
        return res.status(401).json({ error: "Unauthorized: Invalid caretaker credentials" });
      }

      req.caretaker = caretaker;
      next();
    } catch (err) {
      console.error("Auth middleware error:", err);
      return res.status(500).json({ error: "Authentication check failed" });
    }
  }

  // Ownership Authorization: Verify caretaker is linked to user
  async function requireUserAccess(req, res, next) {
    const userId = req.params.userId || req.body?.userId;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId parameter" });
    }

    try {
      const user = await prisma.elderlyUser.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ error: "Elderly user not found" });
      }

      const link = await prisma.caretakerUser.findUnique({
        where: {
          caretakerId_userId: {
            caretakerId: req.caretaker.id,
            userId,
          },
        },
      });

      if (!link) {
        return res.status(403).json({ error: "Forbidden: Caretaker is not linked to this elderly user" });
      }

      req.targetUser = user;
      next();
    } catch (err) {
      console.error("Ownership middleware error:", err);
      return res.status(500).json({ error: "Authorization check failed" });
    }
  }

  // Ownership Authorization for single record
  async function requireRecordAccess(req, res, next) {
    const { recordId } = req.params;
    if (!recordId) {
      return res.status(400).json({ error: "Missing recordId" });
    }

    try {
      const record = await prisma.medicalRecord.findUnique({
        where: { id: recordId },
        include: {
          medications: true,
          files: true,
        },
      });

      if (!record) {
        return res.status(404).json({ error: "Medical record not found" });
      }

      const link = await prisma.caretakerUser.findUnique({
        where: {
          caretakerId_userId: {
            caretakerId: req.caretaker.id,
            userId: record.userId,
          },
        },
      });

      if (!link) {
        return res.status(403).json({ error: "Forbidden: Caretaker is not authorized for this record's user" });
      }

      req.medicalRecord = record;
      next();
    } catch (err) {
      console.error("Record access error:", err);
    }
  }

  // Combined middlewares for medical history routes
  const authUser = [authenticateCaretaker, requireUserAccess];
  const authRecord = [authenticateCaretaker, requireRecordAccess];

  // ==========================================
  // 1. RECORDS TIMELINE (GET /api/users/:userId/records)
  // ==========================================
  router.get("/users/:userId/records", authUser, async (req, res) => {
    const { userId } = req.params;
    const { type, from, to } = req.query;

    try {
      const where = { userId };

      if (type && RecordTypeEnum.safeParse(type).success) {
        where.type = type;
      }

      if (from || to) {
        where.recordDate = {};
        if (from) where.recordDate.gte = new Date(from);
        if (to) where.recordDate.lte = new Date(to);
      }

      const records = await prisma.medicalRecord.findMany({
        where,
        orderBy: { recordDate: "desc" },
        include: {
          medications: {
            orderBy: { name: "asc" },
          },
          files: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      res.json(records);
    } catch (error) {
      console.error("Error fetching medical records:", error);
      res.status(500).json({ error: "Failed to fetch medical records" });
    }
  });

  // ==========================================
  // 2. CREATE RECORD (POST /api/users/:userId/records)
  // ==========================================
  router.post("/users/:userId/records", authUser, async (req, res) => {
    const { userId } = req.params;

    const validation = CreateRecordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation error",
        details: validation.error.issues,
      });
    }

    const data = validation.data;

    try {
      const recordDate = new Date(data.recordDate);
      const followUpDate = data.followUpDate ? new Date(data.followUpDate) : null;

      const created = await prisma.$transaction(async (tx) => {
        const record = await tx.medicalRecord.create({
          data: {
            userId,
            type: data.type,
            recordDate,
            doctorName: data.doctorName || null,
            specialty: data.specialty || null,
            facility: data.facility || null,
            diagnosis: data.diagnosis || null,
            complaints: data.complaints || null,
            notes: data.notes || null,
            vitals: data.vitals || null,
            followUpDate,
          },
        });

        if (data.medications && data.medications.length > 0) {
          const medData = data.medications.map((m) => ({
            recordId: record.id,
            userId,
            name: m.name,
            genericName: m.genericName || null,
            strength: m.strength || null,
            dosePattern: m.dosePattern || null,
            timing: m.timing || null,
            durationDays: m.durationDays || null,
            startDate: m.startDate ? new Date(m.startDate) : recordDate,
            endDate: m.endDate ? new Date(m.endDate) : null,
            stoppedAt: m.stoppedAt ? new Date(m.stoppedAt) : null,
          }));

          await tx.medication.createMany({
            data: medData,
          });
        }

        return tx.medicalRecord.findUnique({
          where: { id: record.id },
          include: {
            medications: true,
            files: true,
          },
        });
      });

      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating medical record:", error);
      res.status(500).json({ error: "Failed to create medical record" });
    }
  });

  // ==========================================
  // 3. READ SINGLE RECORD (GET /api/records/:recordId)
  // ==========================================
  router.get("/records/:recordId", authRecord, async (req, res) => {
    res.json(req.medicalRecord);
  });

  // ==========================================
  // 4. UPDATE RECORD (PUT /api/records/:recordId)
  // ==========================================
  router.put("/records/:recordId", authRecord, async (req, res) => {
    const { recordId } = req.params;
    const existing = req.medicalRecord;

    const validation = UpdateRecordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation error",
        details: validation.error.issues,
      });
    }

    const data = validation.data;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const updatePayload = {};
        if (data.type !== undefined) updatePayload.type = data.type;
        if (data.recordDate !== undefined) updatePayload.recordDate = new Date(data.recordDate);
        if (data.doctorName !== undefined) updatePayload.doctorName = data.doctorName;
        if (data.specialty !== undefined) updatePayload.specialty = data.specialty;
        if (data.facility !== undefined) updatePayload.facility = data.facility;
        if (data.diagnosis !== undefined) updatePayload.diagnosis = data.diagnosis;
        if (data.complaints !== undefined) updatePayload.complaints = data.complaints;
        if (data.notes !== undefined) updatePayload.notes = data.notes;
        if (data.vitals !== undefined) updatePayload.vitals = data.vitals;
        if (data.followUpDate !== undefined) {
          updatePayload.followUpDate = data.followUpDate ? new Date(data.followUpDate) : null;
        }

        await tx.medicalRecord.update({
          where: { id: recordId },
          data: updatePayload,
        });

        // If medications array is provided, replace medications
        if (data.medications !== undefined) {
          await tx.medication.deleteMany({
            where: { recordId },
          });

          if (data.medications.length > 0) {
            const medData = data.medications.map((m) => ({
              recordId,
              userId: existing.userId,
              name: m.name,
              genericName: m.genericName || null,
              strength: m.strength || null,
              dosePattern: m.dosePattern || null,
              timing: m.timing || null,
              durationDays: m.durationDays || null,
              startDate: m.startDate
                ? new Date(m.startDate)
                : updatePayload.recordDate || existing.recordDate,
              endDate: m.endDate ? new Date(m.endDate) : null,
              stoppedAt: m.stoppedAt ? new Date(m.stoppedAt) : null,
            }));

            await tx.medication.createMany({
              data: medData,
            });
          }
        }

        return tx.medicalRecord.findUnique({
          where: { id: recordId },
          include: {
            medications: true,
            files: true,
          },
        });
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating medical record:", error);
      res.status(500).json({ error: "Failed to update medical record" });
    }
  });

  // ==========================================
  // 5. DELETE RECORD (DELETE /api/records/:recordId)
  // ==========================================
  router.delete("/records/:recordId", authRecord, async (req, res) => {
    const { recordId } = req.params;
    const existing = req.medicalRecord;

    try {
      // Remove any uploaded files on disk
      if (existing.files && existing.files.length > 0) {
        for (const f of existing.files) {
          const filePath = path.join(UPLOAD_DIR, f.storageKey);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (unlinkErr) {
              console.warn("Could not remove record file on disk:", unlinkErr.message);
            }
          }
        }
      }

      await prisma.medicalRecord.delete({
        where: { id: recordId },
      });

      res.json({ success: true, message: "Medical record deleted successfully" });
    } catch (error) {
      console.error("Error deleting medical record:", error);
      res.status(500).json({ error: "Failed to delete medical record" });
    }
  });

  // ==========================================
  // 6. UPLOAD FILE TO RECORD (POST /api/records/:recordId/files)
  // ==========================================
  router.post(
    "/records/:recordId/files",
    authRecord,
    upload.single("file"),
    async (req, res) => {
      const { recordId } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded. Expected 'file' field." });
      }

      try {
        const fileRow = await prisma.recordFile.create({
          data: {
            recordId,
            storageKey: req.file.filename,
            mimeType: req.file.mimetype,
          },
        });

        res.status(201).json(fileRow);
      } catch (error) {
        console.error("Error saving record file:", error);
        res.status(500).json({ error: "Failed to save file metadata" });
      }
    }
  );

  // Authenticated file retrieval (GET /api/records/:recordId/files/:fileId)
  router.get("/records/:recordId/files/:fileId", authRecord, async (req, res) => {
    const { recordId, fileId } = req.params;

    try {
      const fileRow = await prisma.recordFile.findFirst({
        where: { id: fileId, recordId },
      });

      if (!fileRow) {
        return res.status(404).json({ error: "File record not found" });
      }

      const filePath = path.join(UPLOAD_DIR, fileRow.storageKey);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found on storage" });
      }

      res.setHeader("Content-Type", fileRow.mimeType);
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      console.error("Error reading file:", error);
      res.status(500).json({ error: "Failed to retrieve file" });
    }
  });

  // ==========================================
  // 7. ACTIVE MEDICATIONS (GET /api/users/:userId/medications/active)
  // ==========================================
  router.get("/users/:userId/medications/active", authUser, async (req, res) => {
    const { userId } = req.params;
    const now = new Date();
    const today = new Date(now.toISOString().split("T")[0]);

    try {
      const activeMeds = await prisma.medication.findMany({
        where: {
          userId,
          stoppedAt: null,
          OR: [{ endDate: null }, { endDate: { gte: today } }],
        },
        include: {
          record: {
            select: {
              id: true,
              type: true,
              doctorName: true,
              specialty: true,
              facility: true,
              recordDate: true,
            },
          },
        },
        orderBy: { startDate: "desc" },
      });

      res.json(activeMeds);
    } catch (error) {
      console.error("Error fetching active medications:", error);
      res.status(500).json({ error: "Failed to fetch active medications" });
    }
  });

  // ==========================================
  // 8. ALLERGIES (GET / POST / DELETE /api/users/:userId/allergies)
  // ==========================================
  router.get("/users/:userId/allergies", authUser, async (req, res) => {
    const { userId } = req.params;
    try {
      const allergies = await prisma.allergy.findMany({
        where: { userId },
        orderBy: { substance: "asc" },
      });
      res.json(allergies);
    } catch (error) {
      console.error("Error fetching allergies:", error);
      res.status(500).json({ error: "Failed to fetch allergies" });
    }
  });

  router.post("/users/:userId/allergies", authUser, async (req, res) => {
    const { userId } = req.params;
    const validation = CreateAllergySchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Validation error",
        details: validation.error.issues,
      });
    }

    const { substance, reaction } = validation.data;

    try {
      const newAllergy = await prisma.allergy.create({
        data: {
          userId,
          substance,
          reaction: reaction || null,
        },
      });

      res.status(201).json(newAllergy);
    } catch (error) {
      console.error("Error adding allergy:", error);
      res.status(500).json({ error: "Failed to add allergy" });
    }
  });

  router.delete("/users/:userId/allergies/:allergyId", authUser, async (req, res) => {
    const { userId, allergyId } = req.params;

    try {
      const existing = await prisma.allergy.findFirst({
        where: { id: allergyId, userId },
      });

      if (!existing) {
        return res.status(404).json({ error: "Allergy not found" });
      }

      await prisma.allergy.delete({
        where: { id: allergyId },
      });

      res.json({ success: true, message: "Allergy removed successfully" });
    } catch (error) {
      console.error("Error deleting allergy:", error);
      res.status(500).json({ error: "Failed to delete allergy" });
    }
  });

  // ==========================================
  // 9. DOCTOR SUMMARY (POST /api/users/:userId/summary)
  // ==========================================
  router.post("/users/:userId/summary", authUser, async (req, res) => {
    const { userId } = req.params;

    try {
      const summary = await generateDoctorSummary(userId, prisma);
      res.json(summary);
    } catch (error) {
      console.error("Error in doctor summary pipeline:", error);
      const status = error.statusCode || 500;
      res.status(status).json({
        error: error.message || "Failed to generate doctor summary",
      });
    }
  });

  // Past summaries (GET /api/users/:userId/summaries)
  router.get("/users/:userId/summaries", authUser, async (req, res) => {
    const { userId } = req.params;

    try {
      const summaries = await prisma.healthSummary.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      res.json(summaries);
    } catch (error) {
      console.error("Error fetching summaries:", error);
      res.status(500).json({ error: "Failed to fetch past summaries" });
    }
  });

  // ==========================================
  // 10. CREATE REMINDERS FROM RECORD (POST /api/records/:recordId/create-reminders)
  // ==========================================
  router.post("/records/:recordId/create-reminders", authRecord, async (req, res) => {
    const record = req.medicalRecord;

    try {
      const medications = record.medications || [];
      if (medications.length === 0) {
        return res.status(400).json({ error: "No medications in this record to create reminders for." });
      }

      const createdReminders = [];

      for (const med of medications) {
        const pattern = (med.dosePattern || "").trim();
        // E.g. "1-0-1" -> morning and evening
        // "1-1-1" -> morning, noon, night
        // "1-0-0" -> morning
        // "0-0-1" -> night
        const parts = pattern.includes("-") ? pattern.split("-") : [pattern];
        const times = [];

        if (parts.length === 3) {
          if (parts[0] !== "0") times.push({ label: "Morning", hours: 8, minutes: 0 });
          if (parts[1] !== "0") times.push({ label: "Afternoon", hours: 13, minutes: 0 });
          if (parts[2] !== "0") times.push({ label: "Night", hours: 20, minutes: 0 });
        } else if (parts.length === 2) {
          if (parts[0] !== "0") times.push({ label: "Morning", hours: 8, minutes: 0 });
          if (parts[1] !== "0") times.push({ label: "Night", hours: 20, minutes: 0 });
        } else {
          times.push({ label: "Daily", hours: 9, minutes: 0 });
        }

        for (const t of times) {
          const now = new Date();
          const remTime = new Date();
          remTime.setHours(t.hours, t.minutes, 0, 0);

          const title = `${med.name}${med.strength ? ` ${med.strength}` : ""} (${t.label})`;
          const notes = `${med.timing || "As prescribed"} - Prescribed by ${record.doctorName || "physician"}`;

          const reminder = await prisma.reminder.create({
            data: {
              userId: record.userId,
              title,
              notes,
              date: med.startDate || record.recordDate || now,
              time: remTime,
              urgent: true,
              category: "MEDS",
              repeat: med.durationDays ? `For ${med.durationDays} days` : "Daily",
              completed: false,
            },
          });

          createdReminders.push(reminder);
        }
      }

      res.status(201).json({
        success: true,
        message: `Created ${createdReminders.length} reminder(s) from record medications.`,
        reminders: createdReminders,
      });
    } catch (error) {
      console.error("Error creating reminders from record:", error);
      res.status(500).json({ error: "Failed to create reminders from record" });
    }
  });

  return router;
}

module.exports = { createMedicalHistoryRouter };
