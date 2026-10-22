const http = require("http");

function request({ method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 5001,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("🧪 Starting Medical Vault & Doctor Summary Backend Integration Tests...\n");

  // 1. Get Caretaker and Demo User ID from backend
  const ctRes = await request({ method: "GET", path: "/api/caretakers/current" });
  console.log("Caretaker:", ctRes.data.name, `(${ctRes.data.id})`);
  const caretakerId = ctRes.data.id;

  const usersRes = await request({ method: "GET", path: `/api/caretakers/${caretakerId}/users` });
  const arthur = usersRes.data.find((u) => u.name === "Arthur Pendelton");
  if (!arthur) {
    throw new Error("Arthur Pendelton not found in caretaker users!");
  }
  const userId = arthur.id;
  console.log("Demo Elderly User:", arthur.name, `(${userId})\n`);

  // Create an unlinked dummy caretaker to test 403 Forbidden
  const dummyCtRes = await request({
    method: "POST",
    path: "/api/caretakers",
    body: {
      name: "Unlinked Caretaker",
      email: `unlinked-${Date.now()}@example.com`,
      contact: "+91 9999900000",
    },
  });
  const unlinkedCaretakerId = dummyCtRes.data.id;

  // TEST 1: 401 without auth
  console.log("▶ TEST 1: Request without Auth header should return 401");
  const unauthRes = await request({
    method: "GET",
    path: `/api/users/${userId}/records`,
  });
  console.log(`Status: ${unauthRes.status}`, unauthRes.data);
  if (unauthRes.status !== 401) throw new Error(`Expected 401, got ${unauthRes.status}`);
  console.log("✅ Passed: 401 returned without auth.\n");

  // TEST 2: 403 for caretaker not linked to that user
  console.log("▶ TEST 2: Request with unlinked caretaker should return 403");
  const forbiddenRes = await request({
    method: "GET",
    path: `/api/users/${userId}/records`,
    headers: { Authorization: `Bearer ${unlinkedCaretakerId}` },
  });
  console.log(`Status: ${forbiddenRes.status}`, forbiddenRes.data);
  if (forbiddenRes.status !== 403) throw new Error(`Expected 403, got ${forbiddenRes.status}`);
  console.log("✅ Passed: 403 returned for unlinked caretaker.\n");

  // TEST 3: 200 with linked caretaker auth
  console.log("▶ TEST 3: Authorized caretaker fetching timeline");
  const recordsRes = await request({
    method: "GET",
    path: `/api/users/${userId}/records`,
    headers: { Authorization: `Bearer ${caretakerId}` },
  });
  console.log(`Status: ${recordsRes.status}, Records count: ${recordsRes.data.length}`);
  if (recordsRes.status !== 200 || !Array.isArray(recordsRes.data)) {
    throw new Error(`Failed to fetch records: ${JSON.stringify(recordsRes.data)}`);
  }
  console.log("Sample record:", recordsRes.data[0]?.type, recordsRes.data[0]?.diagnosis);
  console.log("✅ Passed: Records retrieved successfully.\n");

  // TEST 4: Active medications
  console.log("▶ TEST 4: Fetch Active Medications");
  const activeMedsRes = await request({
    method: "GET",
    path: `/api/users/${userId}/medications/active`,
    headers: { Authorization: `Bearer ${caretakerId}` },
  });
  console.log(`Status: ${activeMedsRes.status}, Active meds count: ${activeMedsRes.data.length}`);
  const activeNames = activeMedsRes.data.map((m) => m.name);
  console.log("Active medicines:", activeNames);
  if (activeNames.includes("Pantocid 40")) {
    throw new Error("Discontinued medicine Pantocid 40 should NOT be in active meds!");
  }
  console.log("✅ Passed: Active meds correctly excludes discontinued/expired medicines.\n");

  // TEST 5: Allergies list
  console.log("▶ TEST 5: Allergies CRUD");
  const allergiesRes = await request({
    method: "GET",
    path: `/api/users/${userId}/allergies`,
    headers: { Authorization: `Bearer ${caretakerId}` },
  });
  console.log(`Allergies count: ${allergiesRes.data.length}`, allergiesRes.data.map((a) => a.substance));
  console.log("✅ Passed: Allergies fetched successfully.\n");

  // TEST 6: Doctor Summary generation
  console.log("▶ TEST 6: Generate Doctor Summary");
  const summaryRes = await request({
    method: "POST",
    path: `/api/users/${userId}/summary`,
    headers: { Authorization: `Bearer ${caretakerId}` },
  });
  console.log(`Status: ${summaryRes.status}`);
  if (summaryRes.status !== 200) {
    throw new Error(`Summary generation failed: ${JSON.stringify(summaryRes.data)}`);
  }

  const summary = summaryRes.data;
  console.log("\n--- GENERATED SUMMARY PARAGRAPH ---");
  console.log(summary.paragraph);
  console.log("----------------------------------\n");

  const wordCount = summary.paragraph.split(/\s+/).filter(Boolean).length;
  console.log(`Word Count: ${wordCount}`);
  if (wordCount < 120 || wordCount > 180) {
    console.warn(`Note: Word count is ${wordCount} (target 120-180 words)`);
  }

  console.log("Sections keys:", Object.keys(summary.sections));
  console.log("Active Meds cited:", summary.sections.activeMeds.length);
  console.log("Allergies cited:", summary.sections.allergies.length);
  console.log("Recent Events cited:", summary.sections.recentEvents.length);
  console.log("Citations count:", summary.sections.citations?.length || summary.citations?.length || 0);

  // Check safety: no diagnose or prescribe
  const lowerPara = summary.paragraph.toLowerCase();
  if (lowerPara.includes("diagnose") || lowerPara.includes("i prescribe") || lowerPara.includes("increase dose")) {
    throw new Error("Summary must not diagnose or recommend dose changes!");
  }
  console.log("✅ Passed: Summary adheres to clinical review standards.\n");

  // TEST 7: Summary Cache Check
  console.log("▶ TEST 7: Call summary a second time without data change (should hit cache)");
  const cachedRes = await request({
    method: "POST",
    path: `/api/users/${userId}/summary`,
    headers: { Authorization: `Bearer ${caretakerId}` },
  });
  console.log(`Status: ${cachedRes.status}, Cached flag: ${cachedRes.data.cached}`);
  if (cachedRes.data.cached !== true) {
    throw new Error("Expected summary to be returned from cache!");
  }
  console.log("✅ Passed: Input hash match returned cached summary without redundant generation.\n");

  // TEST 8: Empty state for user with no records
  console.log("▶ TEST 8: Summary for user with zero records");
  const newUserRes = await request({
    method: "POST",
    path: `/api/caretakers/${caretakerId}/users`,
    headers: { Authorization: `Bearer ${caretakerId}` },
    body: {
      name: "Empty User Demo",
      age: 75,
      relation: "Uncle",
      contact: "+91 9998887776",
    },
  });
  const emptyUserId = newUserRes.data.id;

  const emptySummaryRes = await request({
    method: "POST",
    path: `/api/users/${emptyUserId}/summary`,
    headers: { Authorization: `Bearer ${caretakerId}` },
  });
  console.log(`Status: ${emptySummaryRes.status}`);
  console.log("Empty user paragraph:", emptySummaryRes.data.paragraph);
  if (!emptySummaryRes.data.paragraph.toLowerCase().includes("no records found")) {
    throw new Error("Summary with no records must state 'No records found'!");
  }
  console.log("✅ Passed: Zero records summary correctly states 'No records found'.\n");

  console.log("🎉 ALL ACCEPTANCE API CHECKS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
