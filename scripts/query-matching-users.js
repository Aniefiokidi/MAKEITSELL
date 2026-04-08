const { MongoClient } = require("mongodb");
const terms = ["david", "eke", "uche", "arnold", "aniefiok"];
const pattern = new RegExp(terms.join("|"), "i");
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || undefined;

if (!uri) {
  throw new Error("MONGODB_URI not set");
}

const maskPhone = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  return "*".repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
};

(async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = dbName ? client.db(dbName) : client.db();

  const docs = await db.collection("users")
    .find(
      { $or: [{ name: pattern }, { email: pattern }] },
      {
        projection: {
          _id: 0,
          name: 1,
          email: 1,
          phone: 1,
          phone_number: 1,
          phoneVerified: 1,
          phone_verified: 1,
          otp_attempts: 1,
          otp_attempts_reset_at: 1,
          otp_last_sent_at: 1,
        },
      }
    )
    .sort({ name: 1, email: 1 })
    .toArray();

  const rows = docs.map((d) => ({
    name: d.name || "",
    email: d.email || "",
    phone: maskPhone(d.phone),
    phone_number: maskPhone(d.phone_number),
    phoneVerified: d.phoneVerified ?? "",
    phone_verified: d.phone_verified ?? "",
    otp_attempts: d.otp_attempts ?? "",
    otp_attempts_reset_at: d.otp_attempts_reset_at
      ? new Date(d.otp_attempts_reset_at).toISOString()
      : "",
    otp_last_sent_at: d.otp_last_sent_at
      ? new Date(d.otp_last_sent_at).toISOString()
      : "",
  }));

  console.table(rows);
  await client.close();
})().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
