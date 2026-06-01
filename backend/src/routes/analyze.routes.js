import express from 'express';
/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
import asyncHandler from '../middleware/asyncHandler.js';
import * as githubService from '../services/github.service.js';
import { runReActAgent } from '../agent/react.loop.js';

const router = express.Router();

router.get('/', asyncHandler(
  /**
   * @param {Request} req
   * @param {Response} res
   */
  async (req, res) => {
  const { repoUrl, goal } = req.query;

  if (!repoUrl || !goal) {
    return res.status(400).json({ error: 'repoUrl and goal are required' });
  }

  const { owner, repo } = githubService.parseRepoUrl(repoUrl);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  /** @param {string} eventType @param {object} data */
  const sendEvent = (eventType, data) => {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('start', { owner, repo, goal });

  await runReActAgent({
    goal,
    owner,
    repo,
    /** @param {object} step */
    onStep: (step) => sendEvent('step', step),
  });

  sendEvent('done', { message: 'Analysis complete' });
  res.end();
}));

export default router;
