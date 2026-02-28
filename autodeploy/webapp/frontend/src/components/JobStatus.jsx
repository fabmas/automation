import { useEffect, useRef, useState } from 'react';
import { getJobStatus, getJobLog } from '../api';

const STATUS_LABELS = {
  running:   'In esecuzione',
  succeeded: 'Completato',
  failed:    'Fallito',
  aborted:   'Annullato',
};

const POLL_MS = 3000;

export default function JobStatus({ executionId, label, parallel, onComplete }) {
  const [status, setStatus] = useState('running');
  const [log, setLog] = useState([]);
  const offsetRef = useRef(0);
  const logRef = useRef(null);
  const completedRef = useRef(false);

  /* Poll status + log */
  useEffect(() => {
    if (!executionId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const [statusRes, logRes] = await Promise.all([
          getJobStatus(executionId),
          getJobLog(executionId, offsetRef.current),
        ]);

        if (cancelled) return;

        const s = statusRes.status;
        setStatus(s);

        if (logRes.entries?.length) {
          setLog((prev) => [...prev, ...logRes.entries.map((e) => e.log)]);
        }
        // Always advance the offset so we don't re-fetch old entries
        if (logRes.offset != null) {
          offsetRef.current = logRes.offset;
        }

        const terminal = ['succeeded', 'failed', 'aborted'].includes(s);
        if (terminal && !completedRef.current) {
          completedRef.current = true;
          // Fetch any remaining log lines one last time
          try {
            const finalLog = await getJobLog(executionId, offsetRef.current);
            if (!cancelled && finalLog.entries?.length) {
              setLog((prev) => [...prev, ...finalLog.entries.map((e) => e.log)]);
            }
          } catch { /* ignore */ }
          onComplete?.(s);
        } else if (!terminal) {
          setTimeout(poll, POLL_MS);
        }
      } catch {
        if (!cancelled) setTimeout(poll, POLL_MS * 2);
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [executionId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Auto-scroll log */
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const iconClass =
    status === 'running'   ? 'running'  :
    status === 'succeeded' ? 'success'  :
    status === 'failed'    ? 'failed'   : 'pending';

  const iconChar =
    status === 'running'   ? '⟳' :
    status === 'succeeded' ? '✓' :
    status === 'failed'    ? '✗' : '…';

  const [logVisible, setLogVisible] = useState(false);

  return (
    <div className="card">
      <div className="step">
        <div className={`step-icon ${iconClass}`}>{iconChar}</div>
        <div className="step-info">
          <div className="step-title">
            {label}
            {parallel && <span className="badge-parallel">⚡ Parallelo</span>}
          </div>
          <div className="step-detail">
            {STATUS_LABELS[status] || status} — Execution #{executionId}
          </div>
        </div>
        {log.length > 0 && (
          <button
            type="button"
            className="btn-log-toggle"
            onClick={() => setLogVisible((v) => !v)}
            title={logVisible ? 'Nascondi log' : 'Mostra log'}
          >
            {logVisible ? '▲ Log' : '▼ Log'}
          </button>
        )}
      </div>

      {logVisible && log.length > 0 && (
        <div className="log-box" ref={logRef}>
          {log.map((line, i) => (
            <div key={i} className="log-line">{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
