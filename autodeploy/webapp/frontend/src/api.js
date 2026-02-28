const API_BASE = '/api';

export async function startDeploy(vmName, joinDomain) {
  const res = await fetch(`${API_BASE}/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vmName, joinDomain }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function startJob2() {
  const res = await fetch(`${API_BASE}/deploy/job2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getJobStatus(executionId) {
  const res = await fetch(`${API_BASE}/jobs/${executionId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getJobLog(executionId, offset = 0) {
  const res = await fetch(`${API_BASE}/jobs/${executionId}/log?offset=${offset}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
