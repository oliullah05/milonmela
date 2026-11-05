// Idempotent reconciliation for the payment-verification approval workflow.
// Run: node --env-file=.env scripts/reconcile-payment-approvals.mjs
import mongoose from "mongoose";
try {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  const result = await mongoose.connection
    .collection("students")
    .updateMany(
      {
        paymentStatus: "verified",
        $or: [
          { applicationStatus: { $ne: "approved" } },
          { approvedAt: null },
          { $and: [{ approvedBy: null }, { verifiedBy: { $ne: null } }] },
        ],
      },
      [
        {
          $set: {
            applicationStatus: "approved",
            approvedAt: {
              $ifNull: ["$approvedAt", { $ifNull: ["$verifiedAt", "$$NOW"] }],
            },
            approvedBy: {
              $ifNull: ["$approvedBy", { $ifNull: ["$verifiedBy", null] }],
            },
            rejectionReason: "",
            revision: { $add: [{ $ifNull: ["$revision", 0] }, 1] },
          },
        },
      ],
    );
  console.log(
    `Reconciled ${result.modifiedCount} verified registrations; registration numbers and attendance preserved.`,
  );
} finally {
  await mongoose.disconnect();
}
