const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

// Patch BigInt for JSON serialization
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

// Handle PostgreSQL pool background errors (e.g., Neon idle connection timeouts)
pool.on("error", (err) => {
  console.error("PostgreSQL Pool Error (Idle client dropped):", err.message || err);
});

// Prevent unhandled promise rejections or exceptions from terminating server process
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.use(cors());
app.use(express.json());

// Helper to seed/get active caretaker ("Steve Rogers")
async function getOrCreateDefaultCaretaker() {
  let caretaker = await prisma.caretaker.findFirst({
    where: { email: "steve.rogers@example.com" }
  });

  if (!caretaker) {
    caretaker = await prisma.caretaker.create({
      data: {
        name: "Steve Rogers",
        email: "steve.rogers@example.com",
        contact: "+91 9876543210"
      }
    });
    console.log("Seeded default caretaker: Steve Rogers");
  }

  return caretaker;
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Guardian360 backend is running 🚀" });
});

// ==========================================
// CARETAKER ENDPOINTS
// ==========================================

// Get all caretakers
app.get("/api/caretakers", async (req, res) => {
  try {
    const caretakers = await prisma.caretaker.findMany({
      orderBy: { createdAt: "asc" }
    });
    res.json(caretakers);
  } catch (error) {
    console.error("Error fetching caretakers:", error);
    res.status(500).json({ error: "Failed to fetch caretakers" });
  }
});

// Get current active caretaker
app.get("/api/caretakers/current", async (req, res) => {
  try {
    const caretaker = await getOrCreateDefaultCaretaker();
    res.json(caretaker);
  } catch (error) {
    console.error("Error fetching current caretaker:", error);
    res.status(500).json({ error: "Failed to fetch current caretaker" });
  }
});

// Create new caretaker
app.post("/api/caretakers", async (req, res) => {
  const { name, email, contact } = req.body;
  if (!name || !email || !contact) {
    return res.status(400).json({ error: "Name, email, and contact are required." });
  }

  try {
    const existing = await prisma.caretaker.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "A caretaker with this email already exists." });
    }

    const newCaretaker = await prisma.caretaker.create({
      data: { name, email, contact }
    });
    res.status(201).json(newCaretaker);
  } catch (error) {
    console.error("Error creating caretaker:", error);
    res.status(500).json({ error: "Failed to create caretaker" });
  }
});

// Update caretaker
app.put("/api/caretakers/:caretakerId", async (req, res) => {
  const { caretakerId } = req.params;
  const { name, email, contact } = req.body;

  try {
    const updated = await prisma.caretaker.update({
      where: { id: caretakerId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(contact && { contact })
      }
    });
    res.json(updated);
  } catch (error) {
    console.error("Error updating caretaker:", error);
    res.status(500).json({ error: "Failed to update caretaker" });
  }
});

// Delete caretaker
app.delete("/api/caretakers/:caretakerId", async (req, res) => {
  const { caretakerId } = req.params;
  try {
    await prisma.caretaker.delete({
      where: { id: caretakerId }
    });
    res.json({ success: true, message: "Caretaker deleted successfully" });
  } catch (error) {
    console.error("Error deleting caretaker:", error);
    res.status(500).json({ error: "Failed to delete caretaker" });
  }
});

// Get elderly users associated with a caretaker
app.get("/api/caretakers/:caretakerId/users", async (req, res) => {
  const { caretakerId } = req.params;
  try {
    const mappings = await prisma.caretakerUser.findMany({
      where: { caretakerId },
      include: {
        user: true
      },
      orderBy: { createdAt: "asc" }
    });

    const elderlyUsers = mappings.map((mapping) => mapping.user);
    res.json(elderlyUsers);
  } catch (error) {
    console.error("Error fetching caretaker users:", error);
    res.status(500).json({ error: "Failed to fetch elderly users" });
  }
});

// Create new elderly user and link to caretaker
app.post("/api/caretakers/:caretakerId/users", async (req, res) => {
  const { caretakerId } = req.params;
  const { name, age, relation, contact } = req.body;

  if (!name || age === undefined || !relation || !contact) {
    return res.status(400).json({ error: "Name, age, relation, and contact are required." });
  }

  try {
    const newElderlyUser = await prisma.elderlyUser.create({
      data: {
        name,
        age: parseInt(age, 10),
        relation,
        contact
      }
    });

    await prisma.caretakerUser.create({
      data: {
        caretakerId,
        userId: newElderlyUser.id
      }
    });

    res.status(201).json(newElderlyUser);
  } catch (error) {
    console.error("Error adding elderly user:", error);
    res.status(500).json({ error: "Failed to add elderly user" });
  }
});

// ==========================================
// ELDERLY USER ENDPOINTS
// ==========================================

// Get single elderly user
app.get("/api/users/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await prisma.elderlyUser.findUnique({
      where: { id: userId }
    });
    if (!user) {
      return res.status(404).json({ error: "Elderly user not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching elderly user:", error);
    res.status(500).json({ error: "Failed to fetch elderly user" });
  }
});

// Update elderly user
app.put("/api/users/:userId", async (req, res) => {
  const { userId } = req.params;
  const { name, age, relation, contact } = req.body;

  try {
    const updatedUser = await prisma.elderlyUser.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(age !== undefined && { age: parseInt(age, 10) }),
        ...(relation && { relation }),
        ...(contact && { contact })
      }
    });
    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating elderly user:", error);
    res.status(500).json({ error: "Failed to update elderly user" });
  }
});

// Delete elderly user
app.delete("/api/users/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    await prisma.elderlyUser.delete({
      where: { id: userId }
    });
    res.json({ success: true, message: "Elderly user deleted successfully" });
  } catch (error) {
    console.error("Error deleting elderly user:", error);
    res.status(500).json({ error: "Failed to delete elderly user" });
  }
});

// ==========================================
// REMINDERS ENDPOINTS
// ==========================================

// Get reminders for a user
app.get("/api/users/:userId/reminders", async (req, res) => {
  const { userId } = req.params;
  try {
    const reminders = await prisma.reminder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    res.json(reminders);
  } catch (error) {
    console.error("Error fetching reminders:", error);
    res.status(500).json({ error: "Failed to fetch reminders" });
  }
});

// Create reminder for a user
app.post("/api/users/:userId/reminders", async (req, res) => {
  const { userId } = req.params;
  const { title, notes, date, time, urgent, category } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Title is required for reminder" });
  }

  try {
    // Parse Date safely
    let reminderDate = new Date();
    if (date) {
      const parsedD = new Date(date);
      if (!isNaN(parsedD.getTime())) {
        reminderDate = parsedD;
      }
    }

    // Parse Time safely
    let reminderTime = null;
    if (time) {
      const parsedT = new Date(time);
      if (!isNaN(parsedT.getTime())) {
        reminderTime = parsedT;
      } else if (typeof time === "string") {
        // Parse "09:00 AM" or "14:30" format
        const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (match) {
          let hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const ampm = match[3];
          if (ampm) {
            if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
            if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
          }
          const tDate = new Date();
          tDate.setHours(hours, minutes, 0, 0);
          reminderTime = tDate;
        }
      }
    }

    const reminderCategory = category || "TASK";

    const reminder = await prisma.reminder.create({
      data: {
        userId,
        title,
        notes: notes || null,
        date: reminderDate,
        time: reminderTime,
        urgent: Boolean(urgent),
        category: reminderCategory,
        completed: false
      }
    });

    const formattedReminder = {
      ...reminder,
      id: reminder.id.toString(),
    };

    res.status(201).json(formattedReminder);
  } catch (error) {
    console.error("Error creating reminder:", error);
    res.status(500).json({ error: error.message || "Failed to create reminder" });
  }
});

// Update/patch a reminder
app.patch("/api/reminders/:reminderId", async (req, res) => {
  const { reminderId } = req.params;
  const { completed, title, notes, urgent, category } = req.body;

  try {
    const reminder = await prisma.reminder.update({
      where: { id: BigInt(reminderId) },
      data: {
        ...(completed !== undefined && { completed: Boolean(completed) }),
        ...(title && { title }),
        ...(notes !== undefined && { notes }),
        ...(urgent !== undefined && { urgent: Boolean(urgent) }),
        ...(category && { category })
      }
    });
    res.json(reminder);
  } catch (error) {
    console.error("Error updating reminder:", error);
    res.status(500).json({ error: "Failed to update reminder" });
  }
});

// Delete a reminder
app.delete("/api/reminders/:reminderId", async (req, res) => {
  const { reminderId } = req.params;
  try {
    await prisma.reminder.delete({
      where: { id: BigInt(reminderId) }
    });
    res.json({ success: true, message: "Reminder deleted" });
  } catch (error) {
    console.error("Error deleting reminder:", error);
    res.status(500).json({ error: "Failed to delete reminder" });
  }
});

// ==========================================
// FALL RISK & GAIT EVENTS ENDPOINTS
// ==========================================

// Get fall risk events for a user
app.get("/api/users/:userId/fall-risks", async (req, res) => {
  const { userId } = req.params;
  try {
    const fallRisks = await prisma.fallRisk.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: 20
    });
    res.json(fallRisks);
  } catch (error) {
    console.error("Error fetching fall risks:", error);
    res.status(500).json({ error: "Failed to fetch fall risks" });
  }
});

// Post a fall risk event
app.post("/api/users/:userId/fall-risks", async (req, res) => {
  const { userId } = req.params;
  const { riskLevel, riskScore, eventType } = req.body;

  try {
    const fallRisk = await prisma.fallRisk.create({
      data: {
        userId,
        riskLevel: riskLevel || "LOW",
        riskScore: riskScore || 0.05,
        eventType: eventType || "NORMAL"
      }
    });
    res.status(201).json(fallRisk);
  } catch (error) {
    console.error("Error creating fall risk event:", error);
    res.status(500).json({ error: "Failed to create fall risk event" });
  }
});

// ==========================================
// SENSOR READINGS ENDPOINTS
// ==========================================

// Get sensor readings for a user
app.get("/api/users/:userId/sensor-readings", async (req, res) => {
  const { userId } = req.params;
  try {
    const readings = await prisma.sensorReading.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: 50
    });
    res.json(readings);
  } catch (error) {
    console.error("Error fetching sensor readings:", error);
    res.status(500).json({ error: "Failed to fetch sensor readings" });
  }
});

// Post a sensor reading
app.post("/api/users/:userId/sensor-readings", async (req, res) => {
  const { userId } = req.params;
  const { ax, ay, az, gx, gy, gz } = req.body;

  try {
    const reading = await prisma.sensorReading.create({
      data: {
        userId,
        ax: parseFloat(ax || 0),
        ay: parseFloat(ay || 0),
        az: parseFloat(az || 0),
        gx: parseFloat(gx || 0),
        gy: parseFloat(gy || 0),
        gz: parseFloat(gz || 0)
      }
    });
    res.status(201).json(reading);
  } catch (error) {
    console.error("Error creating sensor reading:", error);
    res.status(500).json({ error: "Failed to create sensor reading" });
  }
});

// ==========================================
// ESP32 SENSOR DATA ENDPOINTS (/data & /api/data)
// ==========================================

let latestSensorReading = {
  ax: 0.0,
  ay: 0.0,
  az: 9.81,
  gx: 0.0,
  gy: 0.0,
  gz: 0.0,
  heartRate: null,
  spo2: null,
  ir: null,
  red: null,
  fallDetected: false,
  timestamp: new Date().toISOString()
};

function parseNum(val, fallback = null) {
  if (val === undefined || val === null || val === "") return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}

const handlePostData = async (req, res) => {
  try {
    const body = req.body || {};
    if (typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ error: "Invalid JSON body. Expected object." });
    }

    const ax = parseNum(body.ax, 0);
    const ay = parseNum(body.ay, 0);
    const az = parseNum(body.az, 0);
    const gx = parseNum(body.gx, 0);
    const gy = parseNum(body.gy, 0);
    const gz = parseNum(body.gz, 0);

    const heartRate = parseNum(body.heartRate, null);
    const spo2 = parseNum(body.spo2, null);
    const ir = parseNum(body.ir, null);
    const red = parseNum(body.red, null);
    const fallDetected = Boolean(body.fallDetected === true || body.fallDetected === "true");

    latestSensorReading = {
      ax,
      ay,
      az,
      gx,
      gy,
      gz,
      heartRate,
      spo2,
      ir,
      red,
      fallDetected,
      timestamp: new Date().toISOString()
    };

    // Optionally record MPU6050 reading in DB for active default user if DB is available
    try {
      const defaultCaretaker = await prisma.caretaker.findFirst({
        include: { users: { include: { user: true } } }
      });
      const user = defaultCaretaker?.users?.[0]?.user || await prisma.elderlyUser.findFirst();
      if (user) {
        await prisma.sensorReading.create({
          data: {
            userId: user.id,
            ax,
            ay,
            az,
            gx,
            gy,
            gz
          }
        });

        if (fallDetected) {
          await prisma.fallRisk.create({
            data: {
              userId: user.id,
              riskLevel: "CRITICAL",
              riskScore: 0.95,
              eventType: "FALL_DETECTED"
            }
          });
          console.log(`⚠️ FALL DETECTED event saved for user ${user.id}`);
        }
      }
    } catch (dbErr) {
      console.warn("Notice: Could not persist MPU6050 reading to database:", dbErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Sensor reading stored successfully",
      data: latestSensorReading
    });
  } catch (err) {
    console.error("Error handling POST /data:", err);
    return res.status(500).json({ error: "Failed to process sensor reading" });
  }
};

const handleGetData = (req, res) => {
  res.json(latestSensorReading);
};

app.post("/data", handlePostData);
app.post("/api/data", handlePostData);

app.get("/data", handleGetData);
app.get("/api/data", handleGetData);

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT} and listening on 0.0.0.0:${PORT}`);
});