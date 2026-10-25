import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import mongoose from 'mongoose';
import routes from './routes.js';
import extra from './extra.js';
import { saveWeekly } from './backup.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use('/api/super/restore', express.json({ limit: '25mb' }));   // backups can be large
app.use(express.json({ limit: '1mb' }));
app.use('/api', routes);
app.use('/api', extra);

await mongoose.connect(process.env.MONGO_URI);
cron.schedule('0 3 * * 0', () => saveWeekly().catch(console.error));   // every Sunday at 3 AM
app.listen(process.env.PORT || 5000, () => console.log('Achievers API running'));
