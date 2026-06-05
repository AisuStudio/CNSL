// Shared beta gate for account creation. This is a simple "door code" handed to
// invited testers — it keeps random visitors from registering on the open beta.
// NOTE: it lives in the client bundle, so it is NOT real security (anyone
// determined could read it). Real email verification comes with a paid plan /
// custom SMTP later. Change the code here in one place.
export const BETA_CODE = "LocalHorst:3000";
