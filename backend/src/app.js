import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import analyzeRoutes from './routes/analyze.routes.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

const allowedOrigin = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.use('/api/analyze', analyzeRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

export default app;
