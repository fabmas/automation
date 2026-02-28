const express = require('express');
const router = express.Router();
const rundeck = require('../services/rundeck');

const JOB1_ID = process.env.JOB1_ID;
const JOB2_ID = process.env.JOB2_ID;
const JOB3_ID = process.env.JOB3_ID;
const JOB4_ID = process.env.JOB4_ID;

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
    // Pass vm_name so Rundeck/Terraform create the VM with the requested name.
    // state_key per-VM avoids overwriting existing state.
    const job1Exec = await rundeck.runJob(JOB1_ID, {
      vm_name: sanitized,
      state_key: `autodeploy/${sanitized}.tfstate`,
      admin_password_secret_name: `${sanitized}-localadmin`,
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
 * Passes localadmin_secret_name so the playbook reads the correct KV secret.
 */
router.post('/job2', async (req, res) => {
  try {
    const { vmName } = req.body;
    const opts = {};
    if (vmName) {
      opts.localadmin_secret_name = `${vmName}-localadmin`;
    }

    const job2Exec = await rundeck.runJob(JOB2_ID, opts);

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

/**
 * POST /api/deploy/job3
 * Body: { vmName: "test01" }
 *
 * Triggers Job 3 (Ansible — Install IIS).
 */
router.post('/job3', async (req, res) => {
  try {
    const { vmName } = req.body;
    const opts = {};
    if (vmName) {
      opts.localadmin_secret_name = `${vmName}-localadmin`;
    }
    const job3Exec = await rundeck.runJob(JOB3_ID, opts);
    res.json({
      job3: {
        executionId: job3Exec.id,
        href: job3Exec.href,
        status: job3Exec.status,
      },
    });
  } catch (err) {
    console.error('[deploy/job3] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/deploy/job4
 * Body: { vmName: "test01" }
 *
 * Triggers Job 4 (Ansible — Install 7-Zip unattended).
 */
router.post('/job4', async (req, res) => {
  try {
    const { vmName } = req.body;
    const opts = {};
    if (vmName) {
      opts.localadmin_secret_name = `${vmName}-localadmin`;
    }
    const job4Exec = await rundeck.runJob(JOB4_ID, opts);
    res.json({
      job4: {
        executionId: job4Exec.id,
        href: job4Exec.href,
        status: job4Exec.status,
      },
    });
  } catch (err) {
    console.error('[deploy/job4] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
