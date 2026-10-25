import fs from 'fs/promises';
import path from 'path';
import { Admin, Student, Feedback, Setting, Counter } from './models.js';

const DIR = process.env.BACKUP_DIR || path.resolve('backups');
const MODELS = { admins: Admin, students: Student, feedback: Feedback, settings: Setting, counters: Counter };
const NAME = /^backup-[\w-]+\.json$/;

export async function makeBackup() {
  const out = { version: 1, at: new Date().toISOString() };
  for (const [k, M] of Object.entries(MODELS)) out[k] = await M.find().lean();
  return out;
}
export async function saveWeekly(tag = '') {
  await fs.mkdir(DIR, { recursive: true });
  const name = `backup-${new Date().toISOString().slice(0, 10)}${tag}.json`;
  await fs.writeFile(path.join(DIR, name), JSON.stringify(await makeBackup()));
  const files = (await fs.readdir(DIR)).filter(f => NAME.test(f)).sort();
  for (const f of files.slice(0, -12)) await fs.unlink(path.join(DIR, f));   // keep the latest 12
  return name;
}
export async function listBackups() {
  try { return (await fs.readdir(DIR)).filter(f => NAME.test(f)).sort().reverse(); } catch { return []; }
}
export async function readBackup(name) {
  if (!NAME.test(name)) throw new Error('Bad backup name');
  return JSON.parse(await fs.readFile(path.join(DIR, name), 'utf8'));
}
export async function restore(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.students) || !Array.isArray(data.admins)) throw new Error('Invalid backup file');
  await saveWeekly('-before-restore');                                         // safety copy of the current data
  for (const [k, M] of Object.entries(MODELS)) {
    if (!Array.isArray(data[k])) continue;
    await M.deleteMany({});
    if (data[k].length) await M.insertMany(data[k]);
  }
}
