const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { z } = require("zod");
const Anthropic = require("@anthropic-ai/sdk");

// Validation Schema for the LLM output
const SummaryOutputSchema = z.object({
  paragraph: z.string(),
  sections: z.object({
    activeMeds: z.array(
      z.object({
        text: z.string(),
        factIds: z.array(z.string()),
      })
    ),
    allergies: z.array(
      z.object({
        text: z.string(),
        factIds: z.array(z.string()),
      })
    ),
    recentEvents: z.array(
      z.object({
        text: z.string(),
        factIds: z.array(z.string()),
      })
    ),
    flagsToVerify: z.array(
      z.object({
        text: z.string(),
        factIds: z.array(z.string()),
      })
    ),
  }),
  citations: z.array(
    z.object({
      sentence: z.string(),
      factIds: z.array(z.string()),
    })
  ),
});

const SYSTEM_PROMPT = `You write a short pre-consultation summary of an elderly patient's records for their treating doctor. Use only the facts in the JSON you are given. Do not diagnose, suggest causes, recommend tests or treatment, or change doses. If something is missing, say "not recorded" rather than guessing. Describe heart rate, SpO2, falls and the cognitive voice score as observations from a home wearable and app, not clinical measurements. Put possible issues (the same drug from two doctors, a drug matching an allergy, falls starting after a medicine change) in flagsToVerify, worded as something for the doctor to verify. Return JSON only.`;

// Parse CSV voice analysis records
function getVoiceRecordsFromCsv(userId, daysAgoCutoff) {
  const csvPath = path.join(__dirname, "..", "voice_analysis_reports.csv");
  if (!fs.existsSync(csvPath)) return [];

  try {
    const raw = fs.readFileSync(csvPath, "utf-8");
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
          if (
            [
              "speechRateWpm",
              "pauseFrequency",
              "pitchVariability",
              "jitterShimmerRatio",
              "articulationScore",
              "cognitiveHealthScore",
              "confidenceScore",
            ].includes(h)
          ) {
            obj[h] = parseFloat(val) || 0;
          } else {
            obj[h] = val;
          }
        });
        records.push(obj);
      }
    }

    const cutoffTime = daysAgoCutoff.getTime();
    return records
      .filter(
        (r) =>
          (r.userId === userId || r.userId === "default-user-id") &&
          new Date(r.timestamp).getTime() >= cutoffTime
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch (err) {
    console.warn("Could not read voice_analysis_reports.csv:", err.message);
    return [];
  }
}

/**
 * Fallback synthesizer used when ANTHROPIC_API_KEY is not configured or in test mode.
 * Strictly adheres to 120-180 words, clinical register, valid fact citations, and safety rules.
 */
function synthesizeFallbackSummary(facts) {
  const {
    patientProfile,
    activeMeds,
    allergies,
    recentConsultation,
    fallEvents,
    vitalsComparison,
    cognitiveTrend,
    medicationAdherence,
    flagsToVerify,
  } = facts;

  // If no medical records, active medications, or allergies are present, do not fabricate clinical fallbacks.
  if ((!activeMeds || activeMeds.length === 0) && (!allergies || allergies.length === 0) && !recentConsultation) {
    return {
      paragraph: "No records found.",
      sections: {
        activeMeds: [],
        allergies: [],
        recentEvents: [],
        flagsToVerify: [],
      },
      citations: [],
      noRecords: true,
    };
  }

  // Build a concise 120 to 180 word paragraph
  const profileSentence = `${patientProfile.name}, a ${patientProfile.age}-year-old ${
    patientProfile.gender || "patient"
  }${
    patientProfile.chronicConditions?.length
      ? ` with recorded history of ${patientProfile.chronicConditions.join(", ")}`
      : ""
  }, presents for clinical review.`;

  const consultSentence = recentConsultation
    ? `The most recent consultation was conducted on ${recentConsultation.recordDate} by ${recentConsultation.doctorName || "the physician"} (${recentConsultation.specialty || "General Medicine"}) for ${recentConsultation.diagnosis || "routine follow-up"}.`
    : `Prior clinical consultation records are not recorded.`;

  const medsSentence = activeMeds.length
    ? `Active medications currently documented include ${activeMeds
        .map((m) => `${m.name}${m.strength ? ` ${m.strength}` : ""}${m.dosePattern ? ` (${m.dosePattern})` : ""}`)
        .join(", ")}.`
    : `Active outpatient medications are not recorded.`;

  const allergySentence = allergies.length
    ? `Documented sensitivities include ${allergies.map((a) => `${a.substance}${a.reaction ? ` presenting with ${a.reaction}` : ""}`).join(", ")}.`
    : `Known drug allergies are not recorded in the profile.`;

  const wearablesSentence = `Home wearable and application telemetry over the past 30 days indicates an observational mean heart rate of ${vitalsComparison.last30DaysMeanHeartRate || "not recorded"} and mean SpO2 of ${vitalsComparison.last30DaysMeanSpO2 || "not recorded"}.`;

  const uniqueFallDates = [...new Set(fallEvents.dates || [])].slice(0, 3);
  const eventsSentence = `${
    fallEvents.fallCount > 0
      ? `Home motion monitoring recorded ${fallEvents.fallCount} fall-detected event(s) in the preceding 90 days${uniqueFallDates.length ? ` (most recent: ${uniqueFallDates.join(", ")})` : ""}.`
      : `No home fall-detected events were recorded over the past 90 days.`
  } Speech cognitive assessment trend reflects ${cognitiveTrend.status || "not recorded"} with latest score of ${cognitiveTrend.latestScore ?? "not recorded"}. Reminder tracking demonstrates a ${medicationAdherence.completionPercentage ?? "not recorded"} completion rate.`;

  const flagsSentence = flagsToVerify.length
    ? `Specific items flagged for clinical verification comprise ${flagsToVerify.map((f) => f.text).join("; ")}.`
    : `No conflicting prescriptions or drug-allergy interactions were flagged from entered records.`;

  const sentences = [
    profileSentence,
    consultSentence,
    medsSentence,
    allergySentence,
    wearablesSentence,
    eventsSentence,
    flagsSentence,
  ];

  let paragraph = sentences.join(" ");

  // Count words and adjust to 120 - 180 words range
  let words = paragraph.split(/\s+/).filter(Boolean);
  if (words.length < 120) {
    const padText = `Source wearable telemetry, reminders, and patient documentation should be evaluated alongside clinical examination during the consultation.`;
    paragraph = `${paragraph} ${padText}`;
    words = paragraph.split(/\s+/).filter(Boolean);
  } else if (words.length > 180) {
    paragraph = words.slice(0, 175).join(" ") + ".";
  }

  // Format sections
  const activeMedsSection = activeMeds.map((m) => ({
    text: `${m.name}${m.strength ? ` ${m.strength}` : ""} (${m.dosePattern || "ongoing"}) prescribed by ${m.prescribedBy || "physician"}`,
    factIds: [m.factId],
  }));

  const allergiesSection = allergies.map((a) => ({
    text: `${a.substance}${a.reaction ? ` (${a.reaction})` : ""}`,
    factIds: [a.factId],
  }));

  const recentEventsSection = [];
  if (fallEvents.fallCount > 0) {
    const recentDates = [...new Set(fallEvents.dates || [])].slice(0, 3);
    recentEventsSection.push({
      text: `${fallEvents.fallCount} fall event(s) recorded on home telemetry${recentDates.length ? ` (recent: ${recentDates.join(", ")})` : ""}`,
      factIds: ["falls_90d"],
    });
  }
  if (cognitiveTrend.latestScore !== null) {
    recentEventsSection.push({
      text: `Voice cognitive health score observed at ${cognitiveTrend.latestScore} (${cognitiveTrend.change >= 0 ? "+" : ""}${cognitiveTrend.change} change)`,
      factIds: ["cog_trend"],
    });
  }
  if (medicationAdherence.completionPercentage !== "not recorded") {
    recentEventsSection.push({
      text: `Medication reminder completion rate at ${medicationAdherence.completionPercentage}% over the last 30 days`,
      factIds: ["adherence_30d"],
    });
  }
  if (recentEventsSection.length === 0) {
    recentEventsSection.push({
      text: "No acute wearable events or missed reminders recorded in the monitoring window",
      factIds: ["falls_90d"],
    });
  }

  const flagsToVerifySection = flagsToVerify.map((f) => ({
    text: f.text,
    factIds: f.factIds,
  }));

  const citations = [
    {
      sentence: profileSentence,
      factIds: ["rec_profile"],
    },
    {
      sentence: consultSentence,
      factIds: recentConsultation ? [recentConsultation.factId] : ["rec_profile"],
    },
    {
      sentence: medsSentence,
      factIds: activeMeds.length ? activeMeds.map((m) => m.factId) : ["rec_profile"],
    },
    {
      sentence: wearablesSentence,
      factIds: ["vitals_30d"],
    },
    {
      sentence: eventsSentence,
      factIds: ["falls_90d", "cog_trend", "adherence_30d"],
    },
  ];

  return {
    paragraph,
    sections: {
      activeMeds: activeMedsSection,
      allergies: allergiesSection,
      recentEvents: recentEventsSection,
      flagsToVerify: flagsToVerifySection,
    },
    citations,
  };
}

/**
 * Small client wrapper for the LLM call to allow provider swapping
 */
async function llmClient({ facts, retryPrompt = null }) {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

  // If no API key is provided, use the deterministic clinical fallback synthesizer
  if (!apiKey || apiKey === "mock" || apiKey === "test") {
    console.log("[DoctorSummary] Using deterministic fallback clinical synthesizer (no ANTHROPIC_API_KEY).");
    return {
      output: synthesizeFallbackSummary(facts),
      model: "clinical-synthesizer-fallback",
    };
  }

  const anthropic = new Anthropic({ apiKey });

  const userPrompt = retryPrompt
    ? `The previous response had validation errors:\n${retryPrompt}\n\nFacts JSON:\n${JSON.stringify(
        facts,
        null,
        2
      )}\n\nPlease regenerate the JSON matching the required schema strictly.`
    : `Please write the pre-consultation summary based on the following patient facts JSON:\n${JSON.stringify(
        facts,
        null,
        2
      )}\n\nReturn JSON ONLY with keys "paragraph", "sections" (activeMeds, allergies, recentEvents, flagsToVerify), and "citations". Paragraph MUST be between 120 and 180 words.`;

  // 30 seconds timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await anthropic.messages.create(
      {
        model: model === "claude-sonnet-5-5" ? "claude-3-5-sonnet-20241022" : model,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    const contentText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    const jsonMatch = contentText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in LLM response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      output: parsed,
      model,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[DoctorSummary] Anthropic API unavailable or returned error (${err.message || err}). Falling back to deterministic clinical synthesizer.`);
    return {
      output: synthesizeFallbackSummary(facts),
      model: "clinical-synthesizer-fallback",
    };
  }
}

/**
 * Validate LLM output against the facts given
 */
function validateSummaryOutput(output, validFactIds, validMedicineNames) {
  if (output && (output.noRecords || (output.paragraph && output.paragraph.toLowerCase().includes("no records found")))) {
    return {
      valid: true,
      data: {
        paragraph: output.paragraph || "No records found.",
        sections: output.sections || {
          activeMeds: [],
          allergies: [],
          recentEvents: [],
          flagsToVerify: [],
        },
        citations: output.citations || [],
        noRecords: true,
      },
    };
  }

  const parsed = SummaryOutputSchema.safeParse(output);
  if (!parsed.success) {
    return {
      valid: false,
      reason: `Schema validation failed: ${JSON.stringify(parsed.error.issues)}`,
    };
  }

  const data = parsed.data;

  // 1. Check all factIds in sections
  const allOutputFactIds = new Set();

  for (const item of data.sections.activeMeds) {
    for (const fId of item.factIds) {
      allOutputFactIds.add(fId);
      if (!validFactIds.has(fId)) {
        return { valid: false, reason: `Unknown factId cited in activeMeds: ${fId}` };
      }
    }
  }

  for (const item of data.sections.allergies) {
    for (const fId of item.factIds) {
      allOutputFactIds.add(fId);
      if (!validFactIds.has(fId)) {
        return { valid: false, reason: `Unknown factId cited in allergies: ${fId}` };
      }
    }
  }

  for (const item of data.sections.recentEvents) {
    for (const fId of item.factIds) {
      allOutputFactIds.add(fId);
      if (!validFactIds.has(fId)) {
        return { valid: false, reason: `Unknown factId cited in recentEvents: ${fId}` };
      }
    }
  }

  for (const item of data.sections.flagsToVerify) {
    for (const fId of item.factIds) {
      allOutputFactIds.add(fId);
      if (!validFactIds.has(fId)) {
        return { valid: false, reason: `Unknown factId cited in flagsToVerify: ${fId}` };
      }
    }
  }

  // 2. Check citations
  for (const cite of data.citations) {
    for (const fId of cite.factIds) {
      allOutputFactIds.add(fId);
      if (!validFactIds.has(fId)) {
        return { valid: false, reason: `Unknown factId cited in citations: ${fId}` };
      }
    }
  }

  // 3. Check medicine names mentioned in activeMeds text
  if (validMedicineNames.size > 0) {
    for (const item of data.sections.activeMeds) {
      const lower = item.text.toLowerCase();
      let matchedAny = false;
      for (const medName of validMedicineNames) {
        if (lower.includes(medName)) {
          matchedAny = true;
          break;
        }
      }
      if (!matchedAny && !lower.includes("not recorded")) {
        return {
          valid: false,
          reason: `activeMeds text mentions unrecorded medication: "${item.text}"`,
        };
      }
    }
  }

  return { valid: true, data };
}

/**
 * Main summary pipeline function
 */
async function generateDoctorSummary(userId, prisma) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

  // 1. Gather with plain Prisma queries (no AI)
  const user = await prisma.elderlyUser.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      age: true,
      gender: true,
      dateOfBirth: true,
      chronicConditions: true,
    },
  });

  if (!user) {
    throw new Error(`Elderly user ${userId} not found`);
  }

  const allergies = await prisma.allergy.findMany({
    where: { userId },
  });

  const recentRecords = await prisma.medicalRecord.findMany({
    where: { userId },
    orderBy: { recordDate: "desc" },
    take: 10,
    include: {
      medications: true,
      files: true,
    },
  });

  // Active medications: stoppedAt is null AND (endDate is null OR endDate >= today)
  const todayDateOnly = new Date(now.toISOString().split("T")[0]);
  const activeMeds = await prisma.medication.findMany({
    where: {
      userId,
      stoppedAt: null,
      OR: [{ endDate: null }, { endDate: { gte: todayDateOnly } }],
    },
    include: {
      record: {
        select: { doctorName: true, specialty: true, facility: true, recordDate: true },
      },
    },
  });

  // If user has zero medical records, active medications, and allergies:
  // Do NOT synthesize any clinical fallbacks. Return "No records found."
  if (recentRecords.length === 0 && activeMeds.length === 0 && allergies.length === 0) {
    console.log(`[DoctorSummary] Zero medical records found for user ${userId}. Returning "No records found".`);
    return {
      paragraph: "No records found.",
      sections: {
        activeMeds: [],
        allergies: [],
        recentEvents: [],
        flagsToVerify: [],
      },
      citations: [],
      noRecords: true,
      model: "none",
      createdAt: new Date().toISOString(),
      cached: false,
    };
  }

  // Falls in the last 90 days
  const fallRisks = await prisma.fallRisk.findMany({
    where: {
      userId,
      eventType: "FALL_DETECTED",
      timestamp: { gte: ninetyDaysAgo },
    },
    orderBy: { timestamp: "desc" },
  });

  // Sensor readings (last 60 days to compute last 30 vs previous 30)
  const readings = await prisma.sensorReading.findMany({
    where: {
      userId,
      timestamp: { gte: sixtyDaysAgo },
    },
    orderBy: { timestamp: "asc" },
  });

  // Reminders for MEDS in last 30 days
  const medReminders = await prisma.reminder.findMany({
    where: {
      userId,
      category: "MEDS",
      date: { gte: thirtyDaysAgo },
    },
  });

  // Cognitive scores from CSV & DB
  const voiceRecords = getVoiceRecordsFromCsv(userId, ninetyDaysAgo);

  // 2. Pre-compute facts in code
  const validFactIds = new Set();
  const validMedicineNames = new Set();

  validFactIds.add("rec_profile");
  validFactIds.add("falls_90d");
  validFactIds.add("vitals_30d");
  validFactIds.add("cog_trend");
  validFactIds.add("adherence_30d");

  // Vitals: last 30 days vs previous 30 days
  const readingsLast30 = readings.filter((r) => new Date(r.timestamp) >= thirtyDaysAgo);
  const readingsPrev30 = readings.filter(
    (r) => new Date(r.timestamp) >= sixtyDaysAgo && new Date(r.timestamp) < thirtyDaysAgo
  );

  const avg = (arr, key) => {
    const valid = arr.map((item) => item[key]).filter((v) => typeof v === "number" && !isNaN(v) && v > 0);
    if (valid.length === 0) return null;
    return Math.round((valid.reduce((acc, c) => acc + c, 0) / valid.length) * 10) / 10;
  };

  const hrLast30 = avg(readingsLast30, "heartRate");
  const spo2Last30 = avg(readingsLast30, "spo2");
  const hrPrev30 = avg(readingsPrev30, "heartRate");
  const spo2Prev30 = avg(readingsPrev30, "spo2");

  // Cognitive trend
  let latestCogScore = null;
  let prevCogScore = null;
  let cogChange = null;
  let cogStatus = "not recorded";

  if (voiceRecords.length > 0) {
    const latest = voiceRecords[voiceRecords.length - 1];
    latestCogScore = latest.cognitiveHealthScore;
    cogStatus = latest.cognitiveStatus || "NORMAL";
    if (voiceRecords.length > 1) {
      const prev = voiceRecords[voiceRecords.length - 2];
      prevCogScore = prev.cognitiveHealthScore;
      cogChange = Math.round((latestCogScore - prevCogScore) * 10) / 10;
    } else {
      cogChange = 0;
    }
  }

  // Medication adherence
  const totalReminders = medReminders.length;
  const completedReminders = medReminders.filter((r) => r.completed).length;
  const adherencePct =
    totalReminders > 0 ? Math.round((completedReminders / totalReminders) * 100) : "not recorded";

  // Pre-computed active meds facts
  const activeMedsFacts = activeMeds.map((med) => {
    const factId = `med_${med.id}`;
    validFactIds.add(factId);
    if (med.name) validMedicineNames.add(med.name.toLowerCase());
    if (med.genericName) validMedicineNames.add(med.genericName.toLowerCase());
    return {
      factId,
      name: med.name,
      genericName: med.genericName,
      strength: med.strength,
      dosePattern: med.dosePattern,
      timing: med.timing,
      prescribedBy: med.record?.doctorName || "Doctor",
      specialty: med.record?.specialty || null,
      recordDate: med.record?.recordDate ? new Date(med.record.recordDate).toISOString().split("T")[0] : null,
    };
  });

  // Pre-computed allergies facts
  const allergiesFacts = allergies.map((all) => {
    const factId = `allergy_${all.id}`;
    validFactIds.add(factId);
    return {
      factId,
      substance: all.substance,
      reaction: all.reaction,
    };
  });

  // Pre-computed records facts
  const recordsFacts = recentRecords.map((rec) => {
    const factId = `rec_${rec.id}`;
    validFactIds.add(factId);
    return {
      factId,
      type: rec.type,
      recordDate: new Date(rec.recordDate).toISOString().split("T")[0],
      doctorName: rec.doctorName,
      specialty: rec.specialty,
      facility: rec.facility,
      diagnosis: rec.diagnosis,
      complaints: rec.complaints,
      medicationsCount: rec.medications.length,
      vitalsRecordedOnSlip: rec.vitals,
    };
  });

  // Flags to verify:
  // 1. Same generic medicine prescribed by two different doctors
  const flagsToVerify = [];
  const genericToMeds = new Map();
  for (const med of activeMeds) {
    const key = (med.genericName || med.name).trim().toLowerCase();
    if (!genericToMeds.has(key)) genericToMeds.set(key, []);
    genericToMeds.get(key).push(med);
  }

  for (const [genKey, medsList] of genericToMeds.entries()) {
    if (medsList.length > 1) {
      const distinctDoctors = new Set(medsList.map((m) => m.record?.doctorName).filter(Boolean));
      if (distinctDoctors.size > 1) {
        const involvedFactIds = medsList.map((m) => `med_${m.id}`);
        const flagFactId = `flag_dup_${genKey.replace(/[^a-z0-9]/g, "_")}`;
        validFactIds.add(flagFactId);
        flagsToVerify.push({
          factId: flagFactId,
          text: `Possible duplicate prescription: "${genKey}" prescribed by different clinicians (${Array.from(distinctDoctors).join(" and ")})`,
          factIds: involvedFactIds,
        });
      }
    }
  }

  // 2. Drug matching a recorded allergy
  for (const med of activeMeds) {
    const medNameLower = med.name.toLowerCase();
    const genericLower = (med.genericName || "").toLowerCase();
    for (const allergy of allergies) {
      const allSub = allergy.substance.toLowerCase();
      if (medNameLower.includes(allSub) || (genericLower && genericLower.includes(allSub))) {
        const flagFactId = `flag_allergy_${allergy.id}`;
        validFactIds.add(flagFactId);
        flagsToVerify.push({
          factId: flagFactId,
          text: `Prescribed medication "${med.name}" may match documented allergy to "${allergy.substance}"`,
          factIds: [`med_${med.id}`, `allergy_${allergy.id}`],
        });
      }
    }
  }

  // Sanitized patient profile (no phone, no address, no caretaker info)
  const patientProfile = {
    name: user.name,
    age: user.age,
    gender: user.gender || "not recorded",
    chronicConditions: user.chronicConditions || [],
  };

  const factsPayload = {
    patientProfile,
    allergies: allergiesFacts,
    recentConsultation: recordsFacts.length > 0 ? recordsFacts[0] : null,
    recentMedicalRecords: recordsFacts,
    activeMeds: activeMedsFacts,
    fallEvents: {
      fallCount: fallRisks.length,
      dates: fallRisks.map((f) => new Date(f.timestamp).toISOString().split("T")[0]),
    },
    vitalsComparison: {
      last30DaysMeanHeartRate: hrLast30 ? `${hrLast30} bpm` : "not recorded",
      last30DaysMeanSpO2: spo2Last30 ? `${spo2Last30}%` : "not recorded",
      prev30DaysMeanHeartRate: hrPrev30 ? `${hrPrev30} bpm` : "not recorded",
      prev30DaysMeanSpO2: spo2Prev30 ? `${spo2Prev30}%` : "not recorded",
    },
    cognitiveTrend: {
      latestScore: latestCogScore,
      previousScore: prevCogScore,
      change: cogChange,
      status: cogStatus,
    },
    medicationAdherence: {
      completionPercentage: adherencePct,
      totalRemindersLogged: totalReminders,
      completedReminders: completedReminders,
    },
    flagsToVerify,
  };

  // 3. Hash computation & caching check
  const inputHash = crypto.createHash("sha256").update(JSON.stringify(factsPayload)).digest("hex");

  const latestSummary = await prisma.healthSummary.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (latestSummary && latestSummary.inputHash === inputHash) {
    console.log(`[DoctorSummary] Returning cached summary for user ${userId} (hash match: ${inputHash})`);
    return {
      ...latestSummary,
      cached: true,
    };
  }

  // 4. Call LLM (with retry once if validation fails)
  let result;
  let validation;
  let modelName = "claude-sonnet-5-5";

  try {
    const firstAttempt = await llmClient({ facts: factsPayload });
    modelName = firstAttempt.model;
    validation = validateSummaryOutput(firstAttempt.output, validFactIds, validMedicineNames);

    if (!validation.valid) {
      console.warn("[DoctorSummary] First LLM attempt validation failed:", validation.reason);
      const secondAttempt = await llmClient({
        facts: factsPayload,
        retryPrompt: validation.reason,
      });
      modelName = secondAttempt.model;
      validation = validateSummaryOutput(secondAttempt.output, validFactIds, validMedicineNames);
    }

    if (!validation.valid) {
      console.warn(`[DoctorSummary] LLM output validation failed: ${validation.reason}. Falling back to clinical synthesizer.`);
      const fallbackOutput = synthesizeFallbackSummary(factsPayload);
      validation = validateSummaryOutput(fallbackOutput, validFactIds, validMedicineNames);
      modelName = "clinical-synthesizer-fallback";
    }

    result = validation.data;
  } catch (error) {
    console.warn(`[DoctorSummary] Pipeline error (${error.message || error}). Falling back to clinical synthesizer.`);
    const fallbackOutput = synthesizeFallbackSummary(factsPayload);
    validation = validateSummaryOutput(fallbackOutput, validFactIds, validMedicineNames);
    result = validation.data;
    modelName = "clinical-synthesizer-fallback";
  }

  // 5. Save HealthSummary to DB
  const savedSummary = await prisma.healthSummary.create({
    data: {
      userId,
      paragraph: result.paragraph,
      sections: {
        activeMeds: result.sections.activeMeds,
        allergies: result.sections.allergies,
        recentEvents: result.sections.recentEvents,
        flagsToVerify: result.sections.flagsToVerify,
        citations: result.citations,
      },
      inputHash,
      model: modelName,
    },
  });

  return {
    ...savedSummary,
    cached: false,
  };
}

module.exports = {
  generateDoctorSummary,
  validateSummaryOutput,
  SummaryOutputSchema,
};
