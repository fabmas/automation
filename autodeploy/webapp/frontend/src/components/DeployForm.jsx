import { useState } from 'react';

export default function DeployForm({ onDeploy, disabled }) {
  const [vmName, setVmName] = useState('');
  const [joinDomain, setJoinDomain] = useState(false);
  const [error, setError] = useState('');

  const validate = (name) => /^[a-zA-Z0-9]{1,15}$/.test(name);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!validate(vmName)) {
      setError('Nome VM: solo lettere/numeri, max 15 caratteri.');
      return;
    }
    onDeploy({ vmName, joinDomain });
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2>Nuova VM</h2>

      <div className="form-group">
        <label htmlFor="vmName">Nome macchina</label>
        <input
          id="vmName"
          type="text"
          value={vmName}
          onChange={(e) => setVmName(e.target.value)}
          placeholder="es. winproto01"
          maxLength={15}
          disabled={disabled}
          autoComplete="off"
        />
        <p className="hint">1-15 caratteri alfanumerici (hostname Windows)</p>
      </div>

      <div className="form-group">
        <div className="checkbox-group">
          <input
            id="joinDomain"
            type="checkbox"
            checked={joinDomain}
            onChange={(e) => setJoinDomain(e.target.checked)}
            disabled={disabled}
          />
          <label htmlFor="joinDomain">Join al dominio (fabmas.it)</label>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <button type="submit" className="btn btn-primary" disabled={disabled || !vmName}>
        {disabled ? 'Deploy in corso…' : 'Avvia Deploy'}
      </button>
    </form>
  );
}
