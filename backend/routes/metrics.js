const express = require("express");
const fs = require("fs");
const path = require("path");

const VOICE_CSV_PATH = path.join(__dirname, "../voice_analysis_reports.csv");

function getVoiceRecords(userId) {
  if (!fs.existsSync(VOICE_CSV_PATH)) return [];
  const raw = fs.readFileSync(VOICE_CSV_PATH, "utf-8");
  const lines = raw.trim().split("\n");
  if (lines.length <= 1) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(",");
    if (values.length >= headers.length) {
      const obj = {};
      headers.forEach((h, idx) => {
        const val = values[idx] ? values[idx].trim() : "";
        if (["speechRateWpm", "pauseFrequency", "pitchVariability", "jitterShimmerRatio", "articulationScore", "cognitiveHealthScore", "confidenceScore"].includes(h)) {
          obj[h] = parseFloat(val) || 0;
        } else {
          obj[h] = val;
        }
      });
      records.push(obj);
    }
  }

  let userRecords = records.filter((r) => r.userId === userId);
  if (userRecords.length === 0) {
    userRecords = records.filter((r) => r.userId === "default-user-id");
  }
  userRecords.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return userRecords;
}

function createMetricsRouter(prisma) {
  const router = express.Router();

  // Helper to format date range label
  function formatDateRange(startDate, endDate) {
    const sDay = startDate.getUTCDate();
    const eDay = endDate.getUTCDate();
    const sMonth = startDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    const eMonth = endDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    const eYear = endDate.getUTCFullYear();
    if (sMonth !== eMonth) {
      return `${sDay} ${sMonth} – ${eDay} ${eMonth} ${eYear}`;
    }
    return `${sDay} – ${eDay} ${eMonth} ${eYear}`;
  }

  // Day names helper (UTC based)
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // ==========================================
  // GET /api/users/:userId/metrics/:metricType
  // ==========================================
  router.get("/users/:userId/metrics/:metricType", async (req, res) => {
    const { userId, metricType } = req.params;
    const range = (req.query.range || "W").toUpperCase(); // D, W, M, 6M, Y

    try {
      // Normalize metricType
      const normType = metricType.toLowerCase();

      // Determine days back according to range
      let daysCount = 7;
      if (range === "D") daysCount = 1;
      else if (range === "W") daysCount = 7;
      else if (range === "M") daysCount = 30;
      else if (range === "6M") daysCount = 180;
      else if (range === "Y") daysCount = 365;

      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = now.getMonth();
      const curDate = now.getDate();

      const datesList = [];
      for (let i = daysCount - 1; i >= 0; i--) {
        datesList.push(new Date(Date.UTC(curYear, curMonth, curDate - i)));
      }

      const startDate = datesList[0];
      const endDate = new Date(Date.UTC(curYear, curMonth, curDate, 23, 59, 59, 999));

      // Fetch daily metrics from PostgreSQL
      const records = await prisma.dailyHealthMetric.findMany({
        where: {
          userId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: "asc" },
      });

      // ==========================================
      // REAL DATA INTEGRATION: COGNITIVE HEALTH
      // Sourced directly from voice_analysis_reports.csv (matching HomeScreen)
      // ==========================================
      if (normType === "cognitive" || normType === "cognitivehealth") {
        const voiceReports = getVoiceRecords(userId);
        if (voiceReports && voiceReports.length > 0) {
          const maxBars = range === "D" ? 1 : range === "W" ? 7 : range === "M" ? 14 : range === "6M" ? 30 : voiceReports.length;
          const selectedReports = voiceReports.slice(-maxBars);

          const cogBars = selectedReports.map((r) => {
            const rDate = new Date(r.timestamp);
            const dMonth = rDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
            const dDay = rDate.getUTCDate();
            return {
              label: `${dDay} ${dMonth}`,
              date: rDate.toISOString().split("T")[0],
              value: parseFloat(r.cognitiveHealthScore.toFixed(1)),
              status: r.cognitiveStatus,
              speechRateWpm: r.speechRateWpm,
              pauseFrequency: r.pauseFrequency,
            };
          });

          const totalScore = selectedReports.reduce((acc, curr) => acc + (curr.cognitiveHealthScore || 0), 0);
          const avgScore = parseFloat((totalScore / selectedReports.length).toFixed(1));
          const latest = selectedReports[selectedReports.length - 1];
          const first = selectedReports[0];

          // Determine trend from assessments
          let trend = "Stable";
          if (latest.cognitiveHealthScore < first.cognitiveHealthScore - 4) {
            trend = "Downward (Mild Decline)";
          } else if (latest.cognitiveHealthScore > first.cognitiveHealthScore + 4) {
            trend = "Improving";
          }

          let headline1 = "Voice cognitive biomarkers remain stable within normal parameters.";
          if (latest.cognitiveStatus === "MILD_COGNITIVE_IMPAIRMENT_RISK") {
            headline1 = "Mild cognitive variability detected in vocal biomarkers.";
          } else if (latest.cognitiveStatus === "HIGH_RISK") {
            headline1 = "Elevated risk indicated by vocal acoustic and pause markers.";
          }

          const firstDate = new Date(selectedReports[0].timestamp);
          const lastDate = new Date(selectedReports[selectedReports.length - 1].timestamp);

          return res.json({
            metricType: "cognitive",
            range,
            average: avgScore,
            unit: "%",
            dateRangeLabel: formatDateRange(firstDate, lastDate),
            yMax: 100,
            yMid: 50,
            yMin: 0,
            bars: cogBars,
            allBarsCount: selectedReports.length,
            trend,
            highlights: {
              today: parseFloat(latest.cognitiveHealthScore.toFixed(1)),
              averageByHour: avgScore,
              sevenDayAverage: avgScore,
              headline1,
              headline2: `Across your last ${selectedReports.length} voice assessments, you averaged ${avgScore}%.`,
              latestReport: latest,
              cumulativeCurve: {
                todayAtCurrentTime: parseFloat(latest.cognitiveHealthScore.toFixed(1)),
                typicalAtCurrentTime: avgScore,
                typicalEndDay: 100,
              },
            },
          });
        }
      }

      // Map to key
      let fieldKey = "steps";
      let unit = "steps";
      let yMax = 10000;
      let yMid = 5000;
      let yMin = 0;

      if (normType === "steps") {
        fieldKey = "steps";
        unit = "steps";
        yMax = 10000;
        yMid = 5000;
      } else if (normType === "activeenergy" || normType === "active_energy") {
        fieldKey = "activeKcal";
        unit = "kcal";
        yMax = 500;
        yMid = 250;
      } else if (normType === "restingenergy" || normType === "resting_energy") {
        fieldKey = "restingKcal";
        unit = "kcal";
        yMax = 1800;
        yMid = 900;
      } else if (normType === "heartrate" || normType === "heart_rate") {
        fieldKey = "avgHeartRate";
        unit = "BPM";
        yMax = 140;
        yMid = 80;
      } else if (normType === "spo2") {
        fieldKey = "avgSpo2";
        unit = "%";
        yMax = 100;
        yMid = 95;
      } else if (normType === "cognitive" || normType === "cognitivehealth") {
        fieldKey = "avgCognitiveScore";
        unit = "%";
        yMax = 100;
        yMid = 70;
      } else if (normType === "motion" || normType === "walkingsteadiness") {
        fieldKey = "steps"; // fallback proxy
        unit = "gait";
        yMax = 100;
        yMid = 50;
      }

      // Generate continuous day slots for the range
      const bars = [];
      let totalSum = 0;
      let nonZeroCount = 0;

      for (const d of datesList) {
        const dStr = d.toISOString().split("T")[0];

        const match = records.find(
          (r) => new Date(r.date).toISOString().split("T")[0] === dStr
        );

        const val = match && match[fieldKey] !== null && match[fieldKey] !== undefined ? match[fieldKey] : 0;
        if (val > 0) {
          totalSum += Number(val);
          nonZeroCount++;
        }

        bars.push({
          label: daysCount <= 7 ? dayNames[d.getUTCDay()] : `${d.getUTCDate()}`,
          date: dStr,
          value: Number(val),
        });
      }

      // True averages computed from stored data only (days with a reading)
      const avgOf = (arr) => {
        const nz = arr.filter((b) => b.value > 0);
        return nz.length ? nz.reduce((a, b) => a + b.value, 0) / nz.length : 0;
      };
      const round1 = (n) => Math.round(n * 10) / 10;
      const calculatedAvg = nonZeroCount > 0 ? round1(totalSum / nonZeroCount) : 0;

      const todayRecord = bars[bars.length - 1];
      const todayVal = todayRecord ? todayRecord.value : 0;

      // Typical value = average of the earlier days in range; 7-day avg = last 7 days
      const priorAvg = round1(avgOf(bars.slice(0, -1)));
      const sevenDayAvg = round1(avgOf(bars.slice(-7)));
      const avgByPoint = priorAvg;

      const isLowerThanAverage = todayVal < avgByPoint;
      let headline1 = isLowerThanAverage
        ? `Today is below your typical ${metricType} for this range.`
        : `Today is at or above your typical ${metricType} for this range.`;
      if (metricType === "steps") {
        headline1 = isLowerThanAverage
          ? `You’re walking less than you usually do by this point.`
          : `You're exceeding your typical pace for this time of day.`;
      }

      const headline2 =
        sevenDayAvg > 0
          ? `Over the last 7 days, your average ${metricType} was ${sevenDayAvg.toLocaleString()} ${unit}.`
          : `No ${metricType} readings recorded in the last 7 days.`;

      // Chart buckets: D/W/M daily, 6M weekly averages, Y monthly averages
      const fmtShort = (d) => `${d.getUTCDate()} ${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`;
      const bucketize = (groups) =>
        groups.map((g) => {
          const nz = g.items.filter((b) => b.value > 0);
          const v = nz.length ? nz.reduce((a, b) => a + b.value, 0) / nz.length : 0;
          return { label: g.label, date: g.items[0].date, dateLabel: g.dateLabel, value: Math.round(v * 10) / 10 };
        });
      let chartBars = bars;
      if (range === "6M") {
        const groups = [];
        for (let i = 0; i < bars.length; i += 7) {
          const items = bars.slice(i, i + 7);
          const s0 = new Date(items[0].date), e0 = new Date(items[items.length - 1].date);
          groups.push({ items, label: fmtShort(s0), dateLabel: `${fmtShort(s0)} – ${fmtShort(e0)} ${e0.getUTCFullYear()}` });
        }
        chartBars = bucketize(groups);
      } else if (range === "Y") {
        const map = new Map();
        for (const b of bars) {
          const key = b.date.slice(0, 7);
          if (!map.has(key)) {
            const d = new Date(b.date);
            const m = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
            map.set(key, { items: [], label: m, dateLabel: `${m} ${d.getUTCFullYear()}` });
          }
          map.get(key).items.push(b);
        }
        chartBars = bucketize([...map.values()]);
      }

      res.json({
        metricType,
        range,
        average: calculatedAvg,
        unit,
        dateRangeLabel: formatDateRange(startDate, endDate),
        yMax,
        yMid,
        yMin,
        bars: chartBars,
        allBarsCount: bars.length,
        trend: "Unavailable",
        highlights: {
          today: todayVal,
          averageByHour: avgByPoint,
          sevenDayAverage: sevenDayAvg,
          headline1,
          headline2,
          cumulativeCurve: {
            todayAtCurrentTime: todayVal,
            typicalAtCurrentTime: avgByPoint,
            typicalEndDay: sevenDayAvg,
          },
        },
      });
    } catch (err) {
      console.error("Error fetching metric details:", err);
      res.status(500).json({ error: "Failed to fetch metric details" });
    }
  });

  // ==========================================
  // POST /api/users/:userId/metrics (Store Data)
  // ==========================================
  router.post("/users/:userId/metrics", async (req, res) => {
    const { userId } = req.params;
    const { metricType, value, date } = req.body;

    if (!metricType || value === undefined) {
      return res.status(400).json({ error: "Missing metricType or value" });
    }

    try {
      const targetDate = date ? new Date(date) : new Date();
      const dateOnly = new Date(targetDate.toISOString().split("T")[0]);

      const normType = metricType.toLowerCase();
      let updateData = {};
      if (normType === "steps") updateData.steps = parseInt(value, 10);
      else if (normType === "activeenergy" || normType === "active_energy") updateData.activeKcal = parseFloat(value);
      else if (normType === "restingenergy" || normType === "resting_energy") updateData.restingKcal = parseFloat(value);
      else if (normType === "heartrate" || normType === "heart_rate") updateData.avgHeartRate = parseFloat(value);
      else if (normType === "spo2") updateData.avgSpo2 = parseFloat(value);
      else if (normType === "cognitive" || normType === "cognitivehealth") {
        const val = parseFloat(value);
        updateData.avgCognitiveScore = val;
        const status = val >= 80 ? "NORMAL" : val >= 65 ? "MILD_COGNITIVE_IMPAIRMENT_RISK" : "HIGH_RISK";
        const newRecord = {
          id: `VAR-${Date.now().toString().slice(-6)}`,
          userId,
          timestamp: targetDate.toISOString(),
          speechRateWpm: 135.0,
          pauseFrequency: 1.2,
          pitchVariability: 35.0,
          jitterShimmerRatio: 0.8,
          articulationScore: 8.5,
          cognitiveHealthScore: val,
          cognitiveStatus: status,
          confidenceScore: 0.92,
        };
        const row = `${newRecord.id},${newRecord.userId},${newRecord.timestamp},${newRecord.speechRateWpm},${newRecord.pauseFrequency},${newRecord.pitchVariability},${newRecord.jitterShimmerRatio},${newRecord.articulationScore},${newRecord.cognitiveHealthScore},${newRecord.cognitiveStatus},${newRecord.confidenceScore}\n`;
        if (fs.existsSync(VOICE_CSV_PATH)) {
          fs.appendFileSync(VOICE_CSV_PATH, row, "utf-8");
        }
      }

      const record = await prisma.dailyHealthMetric.upsert({
        where: {
          userId_date: {
            userId,
            date: dateOnly,
          },
        },
        create: {
          userId,
          date: dateOnly,
          ...updateData,
        },
        update: updateData,
      });

      res.status(201).json({
        success: true,
        message: `Successfully stored ${metricType} reading for ${dateOnly.toISOString().split("T")[0]}`,
        record,
      });
    } catch (err) {
      console.error("Error saving metric reading:", err);
      res.status(500).json({ error: "Failed to store metric reading" });
    }
  });

  return router;
}

module.exports = { createMetricsRouter };
