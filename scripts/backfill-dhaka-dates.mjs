// Backfill Bangladesh / Dhaka time fields on existing student records
import mongoose from "mongoose";

function toDhakaISO(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const m = {};
  f.formatToParts(d).forEach((p) => (m[p.type] = p.value));
  return `${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}:${m.second}+06:00`;
}

try {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  const list = await mongoose.connection
    .collection("students")
    .find()
    .toArray();
  for (const s of list) {
    const update = {};
    if (s.createdAt) update.createdAtDhaka = toDhakaISO(s.createdAt);
    if (s.verifiedAt) update.verifiedAtDhaka = toDhakaISO(s.verifiedAt);
    if (s.approvedAt) update.approvedAtDhaka = toDhakaISO(s.approvedAt);
    if (s.attendedAt) update.attendedAtDhaka = toDhakaISO(s.attendedAt);
    if (Object.keys(update).length > 0) {
      await mongoose.connection
        .collection("students")
        .updateOne({ _id: s._id }, { $set: update });
    }
  }
  const updated = await mongoose.connection
    .collection("students")
    .find()
    .toArray();
  console.log(
    "Backfilled records:",
    updated.map((x) => ({
      reg: x.registrationNumber,
      createdAtDhaka: x.createdAtDhaka,
      verifiedAtDhaka: x.verifiedAtDhaka,
      approvedAtDhaka: x.approvedAtDhaka,
    })),
  );
} finally {
  await mongoose.disconnect();
}

