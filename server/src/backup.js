import { google } from 'googleapis';

import {
  Admin,
  Student,
  Feedback,
  Setting,
  Counter,
  Slide
} from './models.js';

// Google Drive configuration
const FOLDER_ID = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;

const MODELS = {
  admins: Admin,
  students: Student,
  feedback: Feedback,
  settings: Setting,
  counters: Counter,
  slides: Slide
};

const NAME = /^backup-[\w-]+\.json$/;

// Validate configuration
function validateConfig() {
  const required = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
    'GOOGLE_DRIVE_BACKUP_FOLDER_ID'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length) {
    throw new Error(
      `Missing Google Drive configuration: ${missing.join(', ')}`
    );
  }
}

// Google Drive client
let driveClient;

function getDrive() {
  validateConfig();

  if (!driveClient) {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    auth.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    driveClient = google.drive({
      version: 'v3',
      auth
    });
  }

  return driveClient;
}

// Generate database backup
export async function makeBackup() {
  const out = {
    version: 1,
    at: new Date().toISOString()
  };

  for (const [key, Model] of Object.entries(MODELS)) {
    out[key] = await Model.find().lean();
  }

  return out;
}

// List backup files from Google Drive
async function getDriveFiles() {
  const drive = getDrive();

  const result = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and trashed = false`,
    fields: 'files(id,name,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 1000
  });

  return (result.data.files || [])
    .filter(file => NAME.test(file.name));
}

// Delete old backups and retain latest 12
async function cleanupBackups() {
  const drive = getDrive();
  const files = await getDriveFiles();

  const oldFiles = files.slice(12);

  for (const file of oldFiles) {
    await drive.files.delete({
      fileId: file.id
    });
  }
}

// Save backup to Google Drive
export async function saveWeekly(tag = '') {
  const drive = getDrive();

  const name =
    `backup-${new Date().toISOString().slice(0, 10)}${tag}.json`;

  const backup = await makeBackup();

  const content = JSON.stringify(backup, null, 2);

  // Upload JSON file to Google Drive
  const result = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/json',
      parents: [FOLDER_ID]
    },
    media: {
      mimeType: 'application/json',
      body: content
    },
    fields: 'id,name'
  });

  // Keep latest 12 files
  await cleanupBackups();

  return result.data.name;
}

// List saved backups
export async function listBackups() {
  const files = await getDriveFiles();

  return files.map(file => file.name);
}

// Find a backup by filename
async function findBackup(name) {
  if (!NAME.test(name)) {
    throw new Error('Bad backup name');
  }

  const files = await getDriveFiles();

  const file = files.find(item => item.name === name);

  if (!file) {
    throw new Error('Backup not found in Google Drive');
  }

  return file;
}

// Read backup from Google Drive
export async function readBackup(name) {
  const drive = getDrive();

  const file = await findBackup(name);

  const response = await drive.files.get(
    {
      fileId: file.id,
      alt: 'media'
    },
    {
      responseType: 'stream'
    }
  );

  const chunks = [];

  for await (const chunk of response.data) {
    chunks.push(chunk);
  }

  return JSON.parse(
    Buffer.concat(chunks).toString('utf8')
  );
}

// Restore database
export async function restore(data) {
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.students) ||
    !Array.isArray(data.admins)
  ) {
    throw new Error('Invalid backup file');
  }

  // Save current database before restoring
  await saveWeekly('-before-restore');

  for (const [key, Model] of Object.entries(MODELS)) {
    if (!Array.isArray(data[key])) continue;

    await Model.deleteMany({});

    if (data[key].length) {
      await Model.insertMany(data[key]);
    }
  }
}