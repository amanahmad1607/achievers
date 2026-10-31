import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import mongoose from 'mongoose';
import routes from './routes.js';
import extra from './extra.js';
import { saveWeekly } from './backup.js';
import { Student } from './models.js';
import { clockOut } from './attendance.js';
import './dns-fix.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use('/api/super/restore', express.json({ limit: '25mb' }));   // backups can be large
app.use(express.json({ limit: '1mb' }));
app.use('/api', routes);
app.use('/api', extra);

await mongoose.connect(process.env.MONGO_URI);
cron.schedule('0 3 * * 0', () => saveWeekly().catch(console.error));   // every Sunday at 3 AM
  // Safety net: anyone who forgot to check out is checked out at 11:59 PM, so nobody stays "Present" overnight
cron.schedule('59 23 * * *', async () => {
    for (const st of await Student.find({ checkedInAt: { $ne: null } })) { clockOut(st); await st.save(); }
  });
app.listen(process.env.PORT || 5000, () => console.log('Achievers API running'));
