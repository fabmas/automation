/**
 * Rundeck API client — wraps fetch calls to Rundeck REST API.
 */

const RUNDECK_URL = process.env.RUNDECK_URL || 'http://10.0.0.5:4440';
const RUNDECK_TOKEN = process.env.RUNDECK_TOKEN;

async function rundeckFetch(path, options = {}) {
  const url = `${RUNDECK_URL}/api/46${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Rundeck-Auth-Token': RUNDECK_TOKEN,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Rundeck ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Run a Rundeck job by UUID, passing options as key-value pairs.
 * Returns the execution object { id, href, status, ... }.
 */
async function runJob(jobId, optionsMap = {}) {
  return rundeckFetch(`/job/${jobId}/run`, {
    method: 'POST',
    body: JSON.stringify({ options: optionsMap }),
  });
}

/**
 * Get execution status by execution ID.
 */
async function getExecution(executionId) {
  return rundeckFetch(`/execution/${executionId}`);
}

/**
 * Get execution log output (text).
 */
async function getExecutionOutput(executionId, offset = 0) {
  return rundeckFetch(`/execution/${executionId}/output?offset=${offset}&format=json`);
}

module.exports = { runJob, getExecution, getExecutionOutput };
