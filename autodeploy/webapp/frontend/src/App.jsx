import { useState, useCallback, useRef } from 'react';
import DeployForm from './components/DeployForm';
import JobStatus from './components/JobStatus';
import { startDeploy, startJob2, startJob3, startJob4 } from './api';
import './index.css';

/*
  Workflow (sequential):
  1. Job 1 — Terraform provisioning (always)
  2. Job 2 — Domain join           (if joinDomain)
  3. Job 3 — Install IIS           (if installIIS)
  4. Job 4 — Install 7-Zip         (if install7Zip)
*/

export default function App() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [steps, setSteps] = useState([]);

  // Keep a queue of pending jobs to trigger after the current one completes
  const queueRef = useRef([]);
  const vmNameRef = useRef('');

  const triggerNext = useCallback(async () => {
    if (queueRef.current.length === 0) {
      setBusy(false);
      return;
    }
    const next = queueRef.current.shift();
    try {
      const { executionId } = await next.fn();
      setSteps((prev) => [...prev, { executionId, label: next.label }]);
    } catch (err) {
      setError(`${next.label} trigger failed: ${err.message}`);
      setBusy(false);
    }
  }, []);

  const handleDeploy = useCallback(async ({ vmName, joinDomain, installIIS, install7Zip }) => {
    setBusy(true);
    setError('');
    setSteps([]);
    const sanitized = vmName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    vmNameRef.current = sanitized;

    // Build the queue of follow-up jobs
    const queue = [];
    if (joinDomain) {
      queue.push({
        label: 'Job 2 — Post-config (DNS + Domain Join)',
        fn: () => startJob2(sanitized),
      });
    }
    if (installIIS) {
      queue.push({
        label: 'Job 3 — Installa IIS',
        fn: () => startJob3(sanitized),
      });
    }
    if (install7Zip) {
      queue.push({
        label: 'Job 4 — Installa 7-Zip',
        fn: () => startJob4(sanitized),
      });
    }
    queueRef.current = queue;

    try {
      const { executionId } = await startDeploy(vmName, joinDomain);
      setSteps([{ executionId, label: `Job 1 — Provision VM "${sanitized}"` }]);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }, []);

  const handleStepComplete = useCallback(
    async (_index, result) => {
      if (result === 'succeeded') {
        await triggerNext();
      } else {
        // Job failed/aborted — stop the chain
        queueRef.current = [];
        setBusy(false);
      }
    },
    [triggerNext],
  );

  return (
    <div className="app">
      <h1>AutoDeploy</h1>
      <p className="subtitle">
        Self-service Windows VM provisioning &amp; domain join
      </p>

      {error && <div className="error-banner">{error}</div>}

      <DeployForm onDeploy={handleDeploy} disabled={busy} />

      <div className="status-section">
        {steps.map((step, i) => (
          <JobStatus
            key={step.executionId}
            executionId={step.executionId}
            label={step.label}
            onComplete={(result) => handleStepComplete(i, result)}
          />
        ))}
      </div>
    </div>
  );
}
