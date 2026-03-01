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
  const data = await res.json();
  // Flatten: backend returns { job1: { executionId } }
  return { executionId: data.job1.executionId };
}

export async function startJob2(vmName) {
  const res = await fetch(`${API_BASE}/deploy/job2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vmName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  // Flatten: backend returns { job2: { executionId } }
  return { executionId: data.job2.executionId };
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

export async function startJob3(vmName) {
  const res = await fetch(`${API_BASE}/deploy/job3`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vmName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return { executionId: data.job3.executionId };
}

export async function startJob4(vmName) {
  const res = await fetch(`${API_BASE}/deploy/job4`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vmName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return { executionId: data.job4.executionId };
}

/* ---- Cluster jobs ---- */

export async function startJob5(vmName) {
  const res = await fetch(`${API_BASE}/deploy/job5`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vmName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return { executionId: data.job5.executionId };
}

export async function startJob6(vmName) {
  const res = await fetch(`${API_BASE}/deploy/job6`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vmName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return { executionId: data.job6.executionId };
}

export async function startJob8(vmName) {
  const res = await fetch(`${API_BASE}/deploy/job8`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vmName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return { executionId: data.job8.executionId };
}

export async function startJob7({ node1Name, node2Name, clusterName, clusterIp, agName, listenerName }) {
  const res = await fetch(`${API_BASE}/deploy/job7`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ node1Name, node2Name, clusterName, clusterIp, agName, listenerName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return { executionId: data.job7.executionId };
}
