// Shared beta gate for account creation. These are simple "door codes" handed to
// invited testers — they keep random visitors from registering on the open beta.
// NOTE: they live in the client bundle, so this is NOT real security (anyone
// determined could read them). Real email verification / server-validated codes
// come with a paid plan / custom SMTP later.
//
// Each code maps to a short label so signups can be told apart by WHERE the code
// was handed out (e.g. a specific job application). On signup the matched code +
// label are stamped onto the new user's Supabase metadata (see the register()
// handlers in app/login + app/page), so the Supabase dashboard shows which code
// each tester came in through. Add a new code by adding a line here.
export const BETA_CODES: Record<string, string> = {
  "LocalHorst:3000": "general",
  "DS-3000": "DigitalService",
};

// Validate an entered code (trimmed, case-sensitive — codes are mixed-case).
// Returns the code's label, or null when the code isn't valid. Callers use the
// null result as the gate AND the label for signup attribution.
export function betaLabelFor(input: string): string | null {
  return BETA_CODES[input.trim()] ?? null;
}
