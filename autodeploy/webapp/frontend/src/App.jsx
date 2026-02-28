import { useState, useCallback, useRef } from 'react';
import DeployForm from './components/DeployForm';
import JobStatus from './components/JobStatus';
import { startDeploy, startJob2, startJob3, startJob4 } from './api';
import './index.css';

/*
  Workflow:
  1. Job 1 — Terraform provisioning         (always, sequential)
  2. Job 2 — Domain join                    (if joinDomain, sequential)
  3. Job 3 + Job 4 — IIS / 7-Zip            (parallel if both selected)

  Queue items are either:
    { type: 'single', label, fn }
    { type: 'parallel', items: [{ label, fn }, ...] }
*/

export default function App() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // steps: { executionId, label, parallel?: boolean }
  const [steps, setSteps] = useState([]);

  const queueRef = useRef([]);
  const vmNameRef = useRef('');
  // Track how many parallel jobs are still running
  const pendingParallelRef = useRef(0);

  const triggerNext = useCallback(async () => {
    if (queueRef.current.length === 0) {
      setBusy(false);
      return;
    }
    const next = queueRef.current.shift();

    if (next.type === 'parallel') {
      // Launch all items in parallel
      pendingParallelRef.current = next.items.length;
      const results = await Promise.allSettled(
        next.items.map((item) => item.fn()),
      );
      const newSteps = [];
      let anyFailed = false;
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled') {
          newSteps.push({
            executionId: results[i].value.executionId,
            label: next.items[i].label,
            parallel: true,
          });
        } else {
          anyFailed = true;
          setError(`${next.items[i].label} trigger failed: ${results[i].reason?.message}`);
        }
      }
      if (newSteps.length > 0) {
        setSteps((prev) => [...prev, ...newSteps]);
      }
      if (anyFailed && newSteps.length === 0) {
        setBusy(false);
      }
    } else {
      // Single sequential job
      pendingParallelRef.current = 0;
      try {
        const { executionId } = await next.fn();
        setSteps((prev) => [...prev, { executionId, label: next.label }]);
      } catch (err) {
        setError(`${next.label} trigger failed: ${err.message}`);
        setBusy(false);
      }
    }
  }, []);

  const handleDeploy = useCallback(async ({ vmName, joinDomain, installIIS, install7Zip }) => {
    setBusy(true);
    setError('');
    setSteps([]);
    const sanitized = vmName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    vmNameRef.current = sanitized;

    // Build queue
    const queue = [];
    if (joinDomain) {
      queue.push({
        type: 'single',
        label: 'Job 2 — Post-config (DNS + Domain Join)',
        fn: () => startJob2(sanitized),
      });
    }

    // Job 3 + 4: parallel if both, single if only one
    const softwareJobs = [];
    if (installIIS) {
      softwareJobs.push({
        label: 'Job 3 — Installa IIS',
        fn: () => startJob3(sanitized),
      });
    }
    if (install7Zip) {
      softwareJobs.push({
        label: 'Job 4 — Installa 7-Zip',
        fn: () => startJob4(sanitized),
      });
    }
    if (softwareJobs.length > 1) {
      queue.push({ type: 'parallel', items: softwareJobs });
    } else if (softwareJobs.length === 1) {
      queue.push({ type: 'single', ...softwareJobs[0] });
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
      if (result !== 'succeeded') {
        // If a parallel job fails, don't stop its sibling — just note error
        if (pendingParallelRef.current > 1) {
          pendingParallelRef.current--;
          return;
        }
        // Last (or single) job failed — stop chain
        pendingParallelRef.current = 0;
        queueRef.current = [];
        setBusy(false);
        return;
      }

      // Succeeded — if parallel, wait for all siblings
      if (pendingParallelRef.current > 1) {
        pendingParallelRef.current--;
        return; // Still waiting for sibling(s)
      }
      pendingParallelRef.current = 0;

      // All done for this group — trigger next
      await triggerNext();
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
            parallel={step.parallel}
            onComplete={(result) => handleStepComplete(i, result)}
          />
        ))}
      </div>
    </div>
  );
}
