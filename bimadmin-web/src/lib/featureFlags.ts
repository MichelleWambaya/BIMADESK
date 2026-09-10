/**
 * Feature flags for things that exist in the code but are not ready for
 * customers. Flip to true to re-enable; nothing needs reconstructing.
 */
export const FEATURES = {
  /** WhatsApp and SMS sending. Off until the WhatsApp template flow and a
   *  business SMS gateway are in place. Call logging and email stay on. */
  messaging: false,
} as const;
