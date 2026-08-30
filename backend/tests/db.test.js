const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB, getDatabaseStatus } = require('../src/config/db');
const { Organization } = require('../src/models');

describe('MongoDB Connection and Configuration Tests', () => {
  const TEST_DB_URI = 'mongodb://127.0.0.1:27017/securework_verify_test';

  before(async () => {
    // Ensure clean state before starting
    await disconnectDB();
  });

  after(async () => {
    // Clean up test collection and disconnect
    try {
      if (Organization.db.readyState === 1) {
        await Organization.deleteMany({ code: /^TEST_ORG_/ });
      }
    } catch {
      // Ignore cleanup error if not connected
    }
    await disconnectDB();
  });

  test('connectDB successfully connects to local MongoDB instance', async () => {
    const conn = await connectDB(TEST_DB_URI);
    assert.ok(conn, 'connectDB must return connection object when MongoDB is running');

    const status = getDatabaseStatus();
    assert.strictEqual(status.isConnected, true);
    assert.strictEqual(status.status, 'connected');
    assert.ok(status.host, 'Database status must include host');
    assert.ok(status.name, 'Database status must include db name');
    assert.strictEqual(status.error, null);
  });

  test('can persist and query a document using model foundation', async () => {
    const testCode = `TEST_ORG_${Date.now()}`;
    const org = await Organization.create({
      name: 'Verification Test Org',
      code: testCode,
      type: 'VERIFIER_ORG',
      status: 'ACTIVE',
      contactEmail: 'verify@testorg.local'
    });

    assert.ok(org, 'Organization should be created');
    assert.ok(org._id, 'Mongoose document must have _id');

    // Test toJSON transform
    const json = org.toJSON();
    assert.ok(json.id, 'toJSON must contain transformed "id" string');
    assert.strictEqual(json._id, undefined, 'toJSON must omit raw "_id"');
    assert.strictEqual(json.__v, undefined, 'toJSON must omit "__v"');
    assert.ok(json.createdAt, 'Timestamps must be generated');

    // Query back from DB
    const found = await Organization.findOne({ code: testCode });
    assert.ok(found, 'Should find created organization');
    assert.strictEqual(found.name, 'Verification Test Org');
  });

  test('disconnectDB gracefully shuts down connection', async () => {
    await disconnectDB();

    const status = getDatabaseStatus();
    assert.strictEqual(status.isConnected, false);
    assert.strictEqual(status.status, 'disconnected');
  });
});
