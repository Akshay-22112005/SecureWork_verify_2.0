/**
 * Base Mongoose plugin establishing consistent data model conventions across SecureWork Verify.
 * Features:
 * - Ensures timestamps (createdAt, updatedAt)
 * - Standardizes toJSON output:
 *   - Renames _id to id
 *   - Strips internal __v version key
 *   - Strips private credentials and secrets (e.g., passwordHash, privateKey)
 */
function baseModelPlugin(schema) {
  // Ensure timestamps are enabled
  schema.set('timestamps', true);

  // Define standard toJSON transform
  const prevTransform = schema.options.toJSON?.transform;

  schema.set('toJSON', {
    virtuals: true,
    transform(doc, ret, options) {
      // Map _id to id and remove _id and __v
      if (ret._id) {
        ret.id = ret._id.toString();
        delete ret._id;
      }
      delete ret.__v;

      // Always strip private credentials and secrets from serialized representations
      delete ret.passwordHash;
      delete ret.privateKey;
      delete ret.privateKeyPem;
      delete ret.privateKeyReference;
      delete ret.seed;

      // Invoke previously defined transform if present
      if (typeof prevTransform === 'function') {
        return prevTransform(doc, ret, options);
      }

      return ret;
    }
  });
}

module.exports = baseModelPlugin;
