import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const Admin = model('Admin', new Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  passwordHash: String,
  role: { type: String, enum: ['admin', 'super'], default: 'admin' },
}, { timestamps: true }));

export const Student = model('Student', new Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  phone: { type: String, unique: true },            // last 10 digits
  passwordHash: String,
  mustChange: Boolean,                              // true after an admin password reset, until the student sets their own
  photo: String,                                    // small JPEG data URL for the ID card
  job: String,                                      // exam preparing for
  shift: { type: String, enum: ['M', 'E', 'F'], default: 'F' }, // Morning / Evening / Full day
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  seat: { type: Number, min: 1, max: 115, default: null },
  emailVerified: Boolean,
  waVerified: Boolean,
  joinedAt: { type: Date, default: Date.now },
  payments: [{ month: String, paidOn: Date, receiptNo: String }],   // month = "2026-10"
  presentOn: [String],                                              // "YYYY-MM-DD"
  checkedInAt: Date,
  studyMinutes: { type: Map, of: Number, default: {} },
}, { timestamps: true }));

export const Otp = model('Otp', new Schema({
  email: String, phone: String, emailHash: String, waHash: String,
  expiresAt: Date, tries: { type: Number, default: 0 },
}));

export const Feedback = model('Feedback', new Schema({
  studentId: Schema.Types.ObjectId, name: String, seat: Number, cat: String, msg: String,
  reply: { type: String, default: '' }, status: { type: String, enum: ['open', 'resolved'], default: 'open' },
}, { timestamps: true }));
export const Setting = model('Setting', new Schema({ _id: String, value: String }));
export const Counter = model('Counter', new Schema({ _id: String, n: Number }));
