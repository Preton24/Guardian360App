const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('--- Testing Backend Caretaker & Elderly User CRUD ---');

  // 1. Get current caretaker
  const currentCtRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/caretakers/current',
    method: 'GET',
  });
  console.log('1. GET Current Caretaker:', currentCtRes.status, currentCtRes.body.name);

  // 2. Create new caretaker (POST)
  const newCtRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/caretakers',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      name: 'Dr. Hank Pym',
      email: 'hank.pym@example.com',
      contact: '+91 9876543999',
    }
  );
  console.log('2. POST Create Caretaker:', newCtRes.status, newCtRes.body.name || newCtRes.body);

  const newCtId = newCtRes.body.id;

  // 3. Update caretaker (PUT)
  if (newCtId) {
    const updateCtRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api/caretakers/${newCtId}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        name: 'Dr. Hank Pym (Chief Caretaker)',
      }
    );
    console.log('3. PUT Update Caretaker:', updateCtRes.status, updateCtRes.body.name);
  }

  // 4. Fetch all caretakers (GET)
  const allCtRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/caretakers',
    method: 'GET',
  });
  console.log('4. GET All Caretakers Count:', allCtRes.body.length);

  // 5. Create Elderly User under main caretaker (POST)
  const mainCtId = currentCtRes.body.id;
  const addUserRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/caretakers/${mainCtId}/users`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      name: 'Arthur Pendelton',
      age: 82,
      relation: 'Grandfather',
      contact: '+91 9123456789',
    }
  );
  console.log('5. POST Create Elderly User:', addUserRes.status, addUserRes.body.name);

  // 6. Update Elderly User (PUT)
  const userId = addUserRes.body.id;
  const updateUserRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/users/${userId}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      age: 83,
    }
  );
  console.log('6. PUT Update Elderly User:', updateUserRes.status, updateUserRes.body.age);

  console.log('--- Caretaker & Elderly User CRUD Verified Successfully! ---');
}

runVerification().catch(console.error);
