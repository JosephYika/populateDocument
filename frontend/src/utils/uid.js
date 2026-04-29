/**
 * Auto-incrementing ID generator for React keys on dynamic sections/lines.
 * Not globally unique — resets on page reload, which is fine for ephemeral
 * form elements that don't persist beyond the session.
 */
let _id = 0
export const uid = () => ++_id
