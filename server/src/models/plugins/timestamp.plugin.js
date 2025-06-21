/**
 * Mongoose plugin to add createdAt and updatedAt timestamps to schemas
 * @param {Schema} schema - Mongoose schema
 */
module.exports = function timestampPlugin(schema) {
  // Add the fields to the schema
  schema.add({
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true, // Once created, cannot be changed
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  });

  // Update the 'updatedAt' field on each save
  schema.pre('save', function(next) {
    // Only update when the document is modified (not on creation)
    if (this.isModified() && !this.isNew) {
      this.updatedAt = Date.now();
    }
    next();
  });

  // Update the 'updatedAt' field when using updateOne or findOneAndUpdate
  schema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
    this.update({}, { $set: { updatedAt: Date.now() } });
    next();
  });
}; 