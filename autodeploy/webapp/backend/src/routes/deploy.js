const express = require('express');
const router = express.Router();
const rundeck = require('../services/rundeck');

const JOB1_ID = process.env.JOB1_ID;
const JOB2_ID = process.env.JOB2_ID;

/**
 * POST /api/deploy
 * Body: { vmName: "winproto02", joinDomain: true }
 *
 * 1. Triggers Job 1 (Terraform) with the VM name.
 * 2. Returns execution IDs so the frontend can poll status.
 */
router.post('/', async (req, res) => {
  try {
    const { vmName, joinDomain } = req.body;

    if (!vmName || typeof vmName !== 'string' || vmName.trim().length === 0) {
      return res.status(400).json({ error: 'vmName is required' });
    }

    const sanitized = vmName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (sanitized.length === 0 || sanitized.length > 15) {
      return res.status(400).json({ error: 'vmName must be 1-15 alphanumeric/dash characters' });
    }

    // Run Job 1 — Terraform provisioning
    const job1Exec = await rundeck.runJob(JOB1_ID, {
      // Options are pre-filled with defaults in the Rundeck job definition;
      // we only need to override what the user chooses.
      // TODO: when Terraform supports variable VM name, pass it here.
    });

    const result = {
      vmName: sanitized,
      joinDomain: !!joinDomain,
      job1: {
        executionId: job1Exec.id,
        href: job1Exec.href,
        status: job1Exec.status,
      },
      job2: null, // will be triggered after job1 succeeds (or by frontend)
    };

    res.json(result);
  } catch (err) {
    console.error('[deploy] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/deploy/job2
 * Body: { vmName: "winproto02" }
 *
 * Triggers Job 2 (Ansible post-config / domain join).
 */
router.post('/job2', async (req, res) => {
  try {
    const job2Exec = await rundeck.runJob(JOB2_ID, {});

    res.json({
      job2: {
        executionId: job2Exec.id,
        href: job2Exec.href,
        status: job2Exec.status,
      },
    });
  } catch (err) {
    console.error('[deploy/job2] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
