import mongoose from "mongoose";

// Ensure Node.js and Mongoose always operate in Bangladesh Standard Time (Asia/Dhaka)
process.env.TZ = "Asia/Dhaka";

export function toDhakaISO(date = new Date()) {
  const d =
    typeof date === "number" || typeof date === "string"
      ? new Date(date)
      : date;
  if (!d || isNaN(d.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map = {};
  for (const p of formatter.formatToParts(d)) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+06:00`;
}

const { Schema } = mongoose;
export async function db() {
  if (!process.env.MONGODB_URI) throw new Error("Database is not configured");
  if (mongoose.connection.readyState !== 1) {
    if (mongoose.connection.readyState === 0) global.mongoPromise = null;
    global.mongoPromise ||= mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    try {
      await global.mongoPromise;
    } catch (e) {
      global.mongoPromise = null;
      throw e;
    }
  }
  await Promise.all([Student.init(), Admin.init(), Limit.init()]);
}
const studentSchema = new Schema(
  {
    registrationNumber: { type: String, unique: true },
    name: String,
    mobile: { type: String, unique: true },
    batchYear: Number,
    bloodGroup: String,
    photoUrl: String,
    address: String,
    email: String,
    applicationStatus: { type: String, default: "pending" },
    rejectionReason: String,
    paymentStatus: { type: String, default: "pending" },
    method: String,
    amount: { type: Number, default: 200 },
    transactionId: String,
    senderMobileNumber: String,
    verifiedAt: Date,
    verifiedAtDhaka: String,
    verifiedBy: String,
    verifiedByName: String,
    approvedAt: Date,
    approvedAtDhaka: String,
    approvedBy: String,
    approvedByName: String,
    attendedAt: Date,
    attendedAtDhaka: String,
    attendedBy: String,
    attendedByName: String,
    createdAtDhaka: String,
    verificationToken: { type: String, unique: true },
    revision: { type: Number, default: 0 },
  },
  { timestamps: true },
);
studentSchema.pre("save", function () {
  if (!this.createdAtDhaka) {
    this.createdAtDhaka = toDhakaISO(this.createdAt || new Date());
  }
  if (this.verifiedAt) {
    this.verifiedAtDhaka = toDhakaISO(this.verifiedAt);
  } else if (this.isModified("verifiedAt")) {
    this.verifiedAtDhaka = null;
  }
  if (this.approvedAt) {
    this.approvedAtDhaka = toDhakaISO(this.approvedAt);
  } else if (this.isModified("approvedAt")) {
    this.approvedAtDhaka = null;
  }
  if (this.attendedAt) {
    this.attendedAtDhaka = toDhakaISO(this.attendedAt);
  } else if (this.isModified("attendedAt")) {
    this.attendedAtDhaka = null;
  }
});
studentSchema.index(
  { transactionId: 1, method: 1 },
  { unique: true, partialFilterExpression: { paymentStatus: "verified" } },
);
export const Student =
  mongoose.models.Student || mongoose.model("Student", studentSchema);
export const Admin =
  mongoose.models.Admin ||
  mongoose.model(
    "Admin",
    new Schema({
      email: { type: String, unique: true },
      name: String,
      passwordHash: String,
      isActive: { type: Boolean, default: true },
      sessionVersion: { type: Number, default: 0 },
      mustChangePassword: { type: Boolean, default: true },
    }),
  );
export const Setting =
  mongoose.models.Setting ||
  mongoose.model(
    "Setting",
    new Schema({
      _id: String,
      registrationOpen: { type: Boolean, default: true },
      overrideDeadline: { type: Boolean, default: false },
      eventDateTime: { type: String, default: "2027-08-15T10:00:00+06:00" },
      eventTitle: {
        type: String,
        default: "৫০ বছর পূর্তি ও প্রাক্তন ছাত্র পুনর্মিলনী",
      },
      eventHijriDate: { type: String, default: "১২ রবিউল আউয়াল" },
      registrationFee: { type: Number, default: 200 },
      paymentNumber: { type: String, default: "+8801812945767" },
    }),
  );
export const Counter =
  mongoose.models.Counter ||
  mongoose.model("Counter", new Schema({ _id: String, value: Number }));
export const Limit =
  mongoose.models.Limit ||
  mongoose.model(
    "Limit",
    new Schema({
      _id: String,
      count: Number,
      expires: { type: Date, index: { expires: 0 } },
    }),
  );
export async function settings() {
  return await Setting.findByIdAndUpdate(
    "event",
    { $setOnInsert: { _id: "event" } },
    { upsert: true, returnDocument: "after" },
  ).lean();
}
export function registrationState(s, now = Date.now()) {
  const day = new Date(s.eventDateTime).toLocaleDateString("en-CA", {
    timeZone: "Asia/Dhaka",
  });
  const registrationAutoCloseAt = new Date(
    day + "T00:00:00+06:00",
  ).toISOString();
  const deadlinePassed = now >= new Date(registrationAutoCloseAt).getTime();
  const open = s.registrationOpen && (!deadlinePassed || s.overrideDeadline);
  return {
    open,
    registrationAutoCloseAt,
    closedReason: open
      ? null
      : deadlinePassed && !s.overrideDeadline
        ? "deadline"
        : "manual",
  };
}
export function isOpen(s) {
  return registrationState(s).open;
}
export async function nextRegistrationNumber() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const counter = await Counter.collection.findOneAndUpdate(
        { _id: "registration-numeric" },
        [{ $set: { value: { $add: [{ $ifNull: ["$value", 499] }, 1] } } }],
        { upsert: true, returnDocument: "after" },
      );
      return String(counter.value);
    } catch (error) {
      if (error.code !== 11000 || attempt === 2) throw error;
    }
  }
}

export async function getAdminStats() {
  await db();
  const rows = await Student.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: {
          $sum: {
            $cond: [{ $eq: ["$applicationStatus", "pending"] }, 1, 0],
          },
        },
        approved: {
          $sum: {
            $cond: [{ $eq: ["$applicationStatus", "approved"] }, 1, 0],
          },
        },
        rejected: {
          $sum: {
            $cond: [{ $eq: ["$applicationStatus", "rejected"] }, 1, 0],
          },
        },
        paymentPending: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, 1, 0] },
        },
        verified: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "verified"] }, 1, 0] },
        },
        collections: {
          $sum: {
            $cond: [{ $eq: ["$paymentStatus", "verified"] }, "$amount", 0],
          },
        },
        attended: {
          $sum: {
            $cond: [
              { $ne: [{ $ifNull: ["$attendedAt", null] }, null] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  const stats = rows[0] || {};
  return {
    total: stats.total || 0,
    pending: stats.pending || 0,
    approved: stats.approved || 0,
    rejected: stats.rejected || 0,
    paymentPending: stats.paymentPending || 0,
    verified: stats.verified || 0,
    collections: stats.collections || 0,
    attended: stats.attended || 0,
  };
}

export async function getAdminStudents(query = {}, page = 1, limit = 15) {
  await db();
  const safePage = Math.max(1, Number(page) || 1);
  const [rows, total] = await Promise.all([
    Student.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * limit)
      .limit(limit)
      .lean(),
    Student.countDocuments(query),
  ]);
  return {
    rows: JSON.parse(JSON.stringify(rows)),
    total,
    page: safePage,
    pages: Math.ceil(total / limit),
    loaded: true,
  };
}
