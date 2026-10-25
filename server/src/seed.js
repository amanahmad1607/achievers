import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Admin } from './models.js';

await mongoose.connect(process.env.MONGO_URI);
const email = process.env.SUPER_EMAIL.toLowerCase();
await Admin.findOneAndUpdate({ email },
  { name: 'Developer', email, role: 'super', passwordHash: await bcrypt.hash(process.env.SUPER_PASSWORD, 10) },
  { upsert: true });
console.log('Super admin ready:', email);
await mongoose.disconnect();
