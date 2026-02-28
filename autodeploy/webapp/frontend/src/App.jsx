import { useState, useCallback } from 'react';
import DeployForm from './components/DeployForm';
import JobStatus from './components/JobStatus';
import { startDeploy, startJob2 } from './api';
import './index.css';

/*
  Workflow:
  1. User compiles form → POST /api/deploy  → Job 1 (Terraform)
  2. If joinDomain and Job 1 succeeds  → POST /api/deploy/job2 → Job 2 (Ansible)
*/

export default function App() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [joinDomain, setJoinDomain] = useState(false);
  const [currentVmName, setCurrentVmName] = useState('');

  /* Each step: { executionId, label } */
  const [steps, setSteps] = useState([]);

  const handleDeploy = useCallback(async ({ vmName, joinDomain: join }) => {
    setBusy(true);
    setError('');
    setSteps([]);
    setJoinDomain(join);
    setCurrentVmName(vmName.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''));

    try {
      const { executionId } = await startDeploy(vmName, join);
      setSteps([{ executionId, label: `Job 1 — Provision VM "${vmName}"` }]);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }, []);

  const handleStepComplete = useCallback(
    async (index, result) => {
      /* If step 0 (Job 1) succeeded and joinDomain → trigger Job 2 */
      if (index === 0 && result === 'succeeded' && joinDomain) {
        try {
          const { executionId } = await startJob2(currentVmName);
          setSteps((prev) => [
            ...prev,
            { executionId, label: 'Job 2 — Post-config (DNS + Domain Join)' },
          ]);
          return; // keep busy
        } catch (err) {
          setError(`Job 2 trigger failed: ${err.message}`);
        }
      }

      /* Terminal — unlock the form */
      setBusy(false);
    },
    [joinDomain, currentVmName],
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
