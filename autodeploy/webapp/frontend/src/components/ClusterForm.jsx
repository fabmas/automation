import { useState } from 'react';

export default function ClusterForm({ onDeploy, disabled }) {
  const [node1Name, setNode1Name] = useState('');
  const [node2Name, setNode2Name] = useState('');
  const [clusterName, setClusterName] = useState('');
  const [clusterIp, setClusterIp] = useState('');
  const [agName, setAgName] = useState('');
  const [listenerName, setListenerName] = useState('');
  const [listenerIp, setListenerIp] = useState('');
  const [error, setError] = useState('');

  const validateHost = (name) => /^[a-zA-Z0-9]{1,15}$/.test(name);
  const validateIp = (ip) => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!validateHost(node1Name)) {
      setError('Nome Nodo 1: solo lettere/numeri, max 15 caratteri.');
      return;
    }
    if (!validateHost(node2Name)) {
      setError('Nome Nodo 2: solo lettere/numeri, max 15 caratteri.');
      return;
    }
    if (node1Name.toLowerCase() === node2Name.toLowerCase()) {
      setError('I nomi dei due nodi devono essere diversi.');
      return;
    }
    if (!clusterName.trim()) {
      setError('Nome Cluster è obbligatorio.');
      return;
    }
    if (!validateIp(clusterIp)) {
      setError('IP Cluster non valido (es. 10.0.0.50).');
      return;
    }
    if (!agName.trim()) {
      setError('Nome Availability Group è obbligatorio.');
      return;
    }
    if (!listenerName.trim()) {
      setError('Nome Listener è obbligatorio.');
      return;
    }
    if (!validateIp(listenerIp)) {
      setError('IP Listener non valido (es. 10.0.0.51).');
      return;
    }

    onDeploy({
      node1Name, node2Name,
      clusterName, clusterIp,
      agName, listenerName, listenerIp,
    });
  };

  const canSubmit =
    node1Name && node2Name && clusterName && clusterIp &&
    agName && listenerName && listenerIp;

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2>Nuovo Cluster (Failover + SQL Always On)</h2>

      {/* ---- Nodi ---- */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="node1Name">Nome Nodo 1</label>
          <input
            id="node1Name" type="text" value={node1Name}
            onChange={(e) => setNode1Name(e.target.value)}
            placeholder="es. sqlnode01" maxLength={15}
            disabled={disabled} autoComplete="off"
          />
        </div>
        <div className="form-group">
          <label htmlFor="node2Name">Nome Nodo 2</label>
          <input
            id="node2Name" type="text" value={node2Name}
            onChange={(e) => setNode2Name(e.target.value)}
            placeholder="es. sqlnode02" maxLength={15}
            disabled={disabled} autoComplete="off"
          />
        </div>
      </div>
      <p className="hint">1-15 caratteri alfanumerici (hostname Windows)</p>

      {/* ---- Cluster WSFC ---- */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="clusterName">Nome Cluster (WSFC)</label>
          <input
            id="clusterName" type="text" value={clusterName}
            onChange={(e) => setClusterName(e.target.value)}
            placeholder="es. SQLCLUSTER01"
            disabled={disabled} autoComplete="off"
          />
        </div>
        <div className="form-group">
          <label htmlFor="clusterIp">IP Cluster</label>
          <input
            id="clusterIp" type="text" value={clusterIp}
            onChange={(e) => setClusterIp(e.target.value)}
            placeholder="es. 10.0.0.50"
            disabled={disabled} autoComplete="off"
          />
        </div>
      </div>

      {/* ---- SQL Always On ---- */}
      <div className="form-group">
        <label htmlFor="agName">Nome Availability Group</label>
        <input
          id="agName" type="text" value={agName}
          onChange={(e) => setAgName(e.target.value)}
          placeholder="es. AG-SQL01"
          disabled={disabled} autoComplete="off"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="listenerName">Nome Listener</label>
          <input
            id="listenerName" type="text" value={listenerName}
            onChange={(e) => setListenerName(e.target.value)}
            placeholder="es. SQLAG-LSN"
            disabled={disabled} autoComplete="off"
          />
        </div>
        <div className="form-group">
          <label htmlFor="listenerIp">IP Listener</label>
          <input
            id="listenerIp" type="text" value={listenerIp}
            onChange={(e) => setListenerIp(e.target.value)}
            placeholder="es. 10.0.0.51"
            disabled={disabled} autoComplete="off"
          />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={disabled || !canSubmit}
      >
        {disabled ? 'Deploy in corso…' : 'Avvia Deploy Cluster'}
      </button>
    </form>
  );
}
