
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import routes from './routes.js';
import extra from './extra.js';
import { saveWeekly } from './backup.js';
import { Student } from './models.js';
import { clockOut } from './attendance.js';

import './dns-fix.js';

const app = express();

// CORS
const allowedOrigins = [
  'https://achieverslibrarymallawan.in',
  'https://www.achieverslibrarymallawan.in',
  'https://achieversstudypoint.vercel.app',
  'http://localhost:5173'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Request body limits
app.use('/api/super/restore', express.json({ limit: '25mb' }));
app.use(express.json({ limit: '1mb' }));

// Cached MongoDB connection for serverless functions
let cached = globalThis.mongooseCache;

if (!cached) {
  cached = globalThis.mongooseCache = {
    conn: null,
    promise: null
  };
}

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI)
      .then((mongooseInstance) => mongooseInstance)
      .catch((error) => {
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// Ensure MongoDB is connected before handling requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('MongoDB connection error:', error);
    res.status(503).json({
      success: false,
      message: 'Database connection failed'
    });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Achievers API is running!'
  });
});

// Protect scheduled job endpoints
function verifyCron(req, res, next) {
  const secret = process.env.CRON_SECRET;

  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  next();
}

// Weekly backup endpoint
app.get('/api/cron/weekly-backup', verifyCron, async (req, res) => {
  try {
    await saveWeekly();

    res.json({
      success: true,
      message: 'Weekly backup completed'
    });
  } catch (error) {
    console.error('Weekly backup error:', error);

    res.status(500).json({
      success: false,
      message: 'Weekly backup failed'
    });
  }
});

// Daily attendance cleanup endpoint
app.get('/api/cron/attendance-cleanup', verifyCron, async (req, res) => {
  try {
    const students = await Student.find({
      checkedInAt: { $ne: null }
    });

    let count = 0;

    for (const student of students) {
      await clockOut(student);
      await student.save();
      count++;
    }

    res.json({
      success: true,
      message: 'Attendance cleanup completed',
      processed: count
    });
  } catch (error) {
    console.error('Attendance cleanup error:', error);

    res.status(500).json({
      success: false,
      message: 'Attendance cleanup failed'
    });
  }
});

// Existing API routes
app.use('/api', routes);
app.use('/api', extra);

// Export Express application for Vercel
export default app;
