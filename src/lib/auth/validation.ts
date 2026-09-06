export function validateEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }
export function validateSignUp(input: { displayName: string; email: string; password: string; confirmPassword: string }) {
  const errors: Record<string, string> = {};
  if (!input.displayName.trim()) errors.displayName = "Display name is required.";
  if (!validateEmail(input.email)) errors.email = "Enter a valid email address.";
  if (input.password.length < 8) errors.password = "Use at least 8 characters.";
  if (input.password !== input.confirmPassword) errors.confirmPassword = "Passwords do not match.";
  return errors;
}
