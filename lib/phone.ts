const DEFAULT_COUNTRY_CODE = "972"; // Israel

/**
 * Normalize to E.164. Israeli numbers arrive in a handful of shapes on the shop
 * floor: 054-123-4567, 0541234567, +972 54 123 4567, 972541234567. All of them
 * mean the same person.
 *
 * Returns null when the input cannot be trusted. The caller keeps the raw string
 * either way, so a number is never lost to a normalization it did not expect.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hadPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (hadPlus) {
    // Already international, just cleaned up.
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  // 00 prefix is the other way of writing +
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  // Bare national number: 0541234567 -> +972541234567
  if (digits.startsWith("0")) {
    return `+${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  }

  // Country code typed without the plus: 972541234567
  if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length > DEFAULT_COUNTRY_CODE.length + 6) {
    return `+${digits}`;
  }

  // Anything else short enough to be a local number missing its leading zero.
  if (digits.length >= 8 && digits.length <= 10) {
    return `+${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  return digits.length <= 15 ? `+${digits}` : null;
}

/** wa.me wants the E.164 digits with no leading plus. */
export function waNumber(e164: string): string {
  return e164.replace(/\D/g, "");
}

/**
 * The money feature. One tap opens WhatsApp with the message already typed to the
 * right person. The send itself stays manual and always will: that is what keeps
 * this on a personal number.
 */
export function waLink(e164: string, body: string): string {
  return `https://wa.me/${waNumber(e164)}?text=${encodeURIComponent(body)}`;
}

/** Grouped for reading on a phone screen: +972 54 123 4567 */
export function formatPhone(e164: string): string {
  const m = /^\+972(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+972 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
