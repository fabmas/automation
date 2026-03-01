import { useState, useCallback, useRef } from 'react';
import DeployForm from './components/DeployForm';
import ClusterForm from './components/ClusterForm';
import JobStatus from './components/JobStatus';
import {
  startDeploy, startJob2, startJob3, startJob4,
  startJob5, startJob6, startJob7, startJob8,
} from './api';
import './index.css';

  /*
  Two workflows sharing the same queue engine:

  VM:
    1. Job 1 — Terraform provision
    2. Job 2 — Domain join (optional)
    3. Job 3 + 4 — IIS / 7-Zip (parallel if both)

  Cluster (FC + SQL Always On):
    1. Job 1 x2 — Provision node1 + node2        (parallel)
    2. Job 2 x2 — Domain join both               (parallel)
    3. Job 5 x2 — Install Failover Clustering    (parallel)
    4. Job 6 x2 — Install SQL Server             (parallel)
    5. Job 8 x2 — Install SSMS (optional)        (parallel)
    6. Job 7   — Create WSFC + AG                (sequential)

  Queue items: { type:'single', label, fn } | { type:'parallel', items:[…] }
*/

const TABS = [
  { id: 'vm', label: 'Nuova VM' },
  { id: 'cluster', label: 'Nuovo Cluster (FC)' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('vm');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [steps, setSteps] = useState([]);

  const queueRef = useRef([]);
  const pendingParallelRef = useRef(0);

  /* ---- Queue engine (shared) ---- */

  const triggerNext = useCallback(async () => {
    if (queueRef.current.length === 0) {
      setBusy(false);
      return;
    }
    const next = queueRef.current.shift();

    if (next.type === 'parallel') {
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

  const handleStepComplete = useCallback(
    async (_index, result) => {
      if (result !== 'succeeded') {
        if (pendingParallelRef.current > 1) {
          pendingParallelRef.current--;
          return;
        }
        pendingParallelRef.current = 0;
        queueRef.current = [];
        setBusy(false);
        return;
      }
      if (pendingParallelRef.current > 1) {
        pendingParallelRef.current--;
        return;
      }
      pendingParallelRef.current = 0;
      await triggerNext();
    },
    [triggerNext],
  );

  /* ---- VM flow ---- */

  const handleDeploy = useCallback(async ({ vmName, joinDomain, installIIS, install7Zip }) => {
    setBusy(true);
    setError('');
    setSteps([]);
    const sanitized = vmName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

    const queue = [];

    // 1 — Provision
    queue.push({
      type: 'single',
      label: `Job 1 — Provision VM "${sanitized}"`,
      fn: () => startDeploy(sanitized, joinDomain),
    });

    // 2 — Domain join
    if (joinDomain) {
      queue.push({
        type: 'single',
        label: 'Job 2 — Post-config (DNS + Domain Join)',
        fn: () => startJob2(sanitized),
      });
    }

    // 3+4 — Software
    const softwareJobs = [];
    if (installIIS) {
      softwareJobs.push({ label: 'Job 3 — Installa IIS', fn: () => startJob3(sanitized) });
    }
    if (install7Zip) {
      softwareJobs.push({ label: 'Job 4 — Installa 7-Zip', fn: () => startJob4(sanitized) });
    }
    if (softwareJobs.length > 1) {
      queue.push({ type: 'parallel', items: softwareJobs });
    } else if (softwareJobs.length === 1) {
      queue.push({ type: 'single', ...softwareJobs[0] });
    }

    queueRef.current = queue;
    await triggerNext();
  }, [triggerNext]);

  /* ---- Cluster flow ---- */

  const handleClusterDeploy = useCallback(async ({
    node1Name, node2Name, clusterName, clusterIp,
    agName, listenerName, installSSMSNode1, installSSMSNode2,
  }) => {
    setBusy(true);
    setError('');
    setSteps([]);
    const n1 = node1Name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const n2 = node2Name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

    const queue = [];

    // 1 — Provision both VMs
    queue.push({
      type: 'parallel',
      items: [
        { label: `Job 1 — Provision "${n1}"`, fn: () => startDeploy(n1, false) },
        { label: `Job 1 — Provision "${n2}"`, fn: () => startDeploy(n2, false) },
      ],
    });

    // 2 — Domain join both
    queue.push({
      type: 'parallel',
      items: [
        { label: `Job 2 — Domain Join "${n1}"`, fn: () => startJob2(n1) },
        { label: `Job 2 — Domain Join "${n2}"`, fn: () => startJob2(n2) },
      ],
    });

    // 3 — Install Failover Clustering on both
    queue.push({
      type: 'parallel',
      items: [
        { label: `Job 5 — Failover Clustering "${n1}"`, fn: () => startJob5(n1) },
        { label: `Job 5 — Failover Clustering "${n2}"`, fn: () => startJob5(n2) },
      ],
    });

    // 4 — Install SQL Server on both
    queue.push({
      type: 'parallel',
      items: [
        { label: `Job 6 — SQL Server "${n1}"`, fn: () => startJob6(n1) },
        { label: `Job 6 — SQL Server "${n2}"`, fn: () => startJob6(n2) },
      ],
    });

    // 5 — Install SSMS (optional, per-node)
    const ssmsJobs = [];
    if (installSSMSNode1) {
      ssmsJobs.push({ label: `Job 8 — SSMS "${n1}"`, fn: () => startJob8(n1) });
    }
    if (installSSMSNode2) {
      ssmsJobs.push({ label: `Job 8 — SSMS "${n2}"`, fn: () => startJob8(n2) });
    }
    if (ssmsJobs.length > 1) {
      queue.push({ type: 'parallel', items: ssmsJobs });
    } else if (ssmsJobs.length === 1) {
      queue.push({ type: 'single', ...ssmsJobs[0] });
    }

    // 6 — Create WSFC cluster + AG
    queue.push({
      type: 'single',
      label: `Job 7 — Crea Cluster "${clusterName}" + AG "${agName}"`,
      fn: () => startJob7({
        node1Name: n1, node2Name: n2,
        clusterName, clusterIp,
        agName, listenerName,
      }),
    });

    queueRef.current = queue;
    await triggerNext();
  }, [triggerNext]);

  /* ---- Render ---- */

  const switchTab = (id) => {
    if (busy) return;
    setActiveTab(id);
    setError('');
    setSteps([]);
  };

  return (
    <div className="app">
      <h1>AutoDeploy</h1>
      <p className="subtitle">
        Self-service provisioning &amp; configuration
      </p>

      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-item${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => switchTab(tab.id)}
            disabled={busy}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error && <div className="error-banner">{error}</div>}

      {activeTab === 'vm' && (
        <DeployForm onDeploy={handleDeploy} disabled={busy} />
      )}
      {activeTab === 'cluster' && (
        <ClusterForm onDeploy={handleClusterDeploy} disabled={busy} />
      )}

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
