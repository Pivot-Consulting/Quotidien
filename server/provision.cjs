/* Outputs one provisioned identity; store the hash server-side, share the token privately. */
const crypto = require("node:crypto");
const [id, space, role = "owner"] = process.argv.slice(2);
if (
  ![id, space].every((v) => /^[a-zA-Z0-9_-]{1,80}$/.test(v || "")) ||
  !["owner", "writer", "reader"].includes(role)
) {
  console.error(
    "Usage: node server/provision.cjs USER WORKSPACE [owner|writer|reader]",
  );
  process.exit(1);
}
const token = crypto.randomBytes(32).toString("base64url");
console.log(
  JSON.stringify(
    {
      identity: {
        id,
        space,
        role,
        tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
      },
      token,
    },
    null,
    2,
  ),
);
