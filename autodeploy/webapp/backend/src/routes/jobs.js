const express = require('express');
const router = express.Router();
const rundeck = require('../services/rundeck');

/**
 * GET /api/jobs/:executionId
 * Returns current status of a Rundeck execution.
 */
router.get('/:executionId', async (req, res) => {
  try {
    const exec = await rundeck.getExecution(req.params.executionId);
    res.json({
      id: exec.id,
      status: exec.status,         // running | succeeded | failed | aborted
      dateStarted: exec['date-started'],
      dateEnded: exec['date-ended'],
      job: exec.job?.name,
    });
  } catch (err) {
    console.error('[jobs] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/jobs/:executionId/log?offset=0
 * Returns log output entries for a Rundeck execution.
 */
router.get('/:executionId/log', async (req, res) => {
  try {
    const offset = parseInt(req.query.offset || '0', 10);
    const output = await rundeck.getExecutionOutput(req.params.executionId, offset);
    res.json({
      completed: output.completed,
      offset: output.offset,
      entries: (output.entries || []).map((e) => ({
        time: e.time,
        log: e.log,
        level: e.level,
      })),
    });
  } catch (err) {
    console.error('[jobs/log] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
