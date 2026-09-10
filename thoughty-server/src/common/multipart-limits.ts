// Upload forms contain one file and at most a scalar entryId. Reject bracket
// notation before append-field can allocate or walk attacker-controlled arrays.
// Multer 2.3's array-index protection requires an explicit opt-in.
export const MULTIPART_FIELD_LIMITS = {
  fieldNestingDepth: 0,
  fieldArrayIndexLimit: 0,
  fieldNameSize: 64,
  fieldSize: 1024,
  fields: 1,
  files: 1,
  parts: 3,
};
