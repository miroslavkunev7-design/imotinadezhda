// SPDX-License-Identifier: MIT
// Persistent agent host id (ext_agent_host_id). Opaque, contains no user data, is not a credential.

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const HOST_FILE = 'realgpt-host.json';
const VALID = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Returns the saved id, creating it once per installation. Only a missing or unusable file leads to a new id.
export async function getHostId(dataDir) {
  const file = path.join(dataDir, HOST_FILE);
  let raw = null;
  try {
    raw = await readFile(file, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  if (raw !== null) {
    try {
      const saved = JSON.parse(raw).ext_agent_host_id;
      if (typeof saved === 'string' && VALID.test(saved)) return saved;
    } catch {
      // corrupt file: replaced below
    }
  }
  const id = `urn:uuid:${randomUUID()}`;
  await mkdir(dataDir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ ext_agent_host_id: id, created_at: new Date().toISOString() }), {
    mode: 0o600,
  });
  await rename(tmp, file);
  return id;
}
