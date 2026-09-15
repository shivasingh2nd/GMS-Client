/** Fields extracted from an HP PAY Customer Profile screenshot. */
export interface HpPayConsumerFields {
  name?: string;
  address?: string;
  phone?: string;
  consumerNumber?: string;
  pincode?: string;
}

interface LabelRule {
  key: keyof HpPayConsumerFields;
  /** Matches a label-only line (value is on the next line). */
  exact: RegExp;
  /** Matches "Label: value" or "Label value" on one line. */
  withValue: RegExp;
}

const LABEL_RULES: LabelRule[] = [
  {
    key: 'name',
    exact: /^consumer\s*name$/i,
    withValue: /^consumer\s*name\s*[:.\-–—]?\s+(.+)$/i,
  },
  {
    key: 'address',
    exact: /^consumer\s*address$/i,
    withValue: /^consumer\s*address\s*[:.\-–—]?\s+(.+)$/i,
  },
  {
    key: 'pincode',
    exact: /^pin\s*code$/i,
    withValue: /^pin\s*code\s*[:.\-–—]?\s+(.+)$/i,
  },
  {
    key: 'phone',
    exact: /^consumer\s*(phone|mobile)(\s*number)?$/i,
    withValue: /^consumer\s*(phone|mobile)(\s*number)?\s*[:.\-–—]?\s+(.+)$/i,
  },
  {
    key: 'consumerNumber',
    exact: /^consumer\s*(number|no\.?|num)$/i,
    withValue: /^consumer\s*(number|no\.?|num)\s*[:.\-–—]?\s+(.+)$/i,
  },
];

const LOOKS_LIKE_LABEL =
  /^(consumer\s*(email|name|address|phone|mobile|number|no\.?)|unique\s*consumer\s*id|cylinder\s*type|status|pin\s*code|pincode|distributor\s*profile|customer|profile|hp\s*pay|home|transactions|contact)$/i;

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function isBlankValue(value: string): boolean {
  return !value || /^(n\/?a|nil|null|-|—|–|\.|none)$/i.test(value);
}

function normalizePhone(value: string): string | undefined {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);
  return digits || undefined;
}

function normalizeConsumerNumber(value: string): string | undefined {
  const cleaned = value.replace(/[^\dA-Za-z]/g, '').trim();
  return cleaned || undefined;
}

function normalizePincode(value: string): string | undefined {
  const digits = value.replace(/\D/g, '');
  return /^\d{6}$/.test(digits) ? digits : undefined;
}

/**
 * Parse OCR text from an HP PAY Customer Profile screenshot into consumer fields.
 * Distributor name and father name are not on that screen — leave those for manual entry.
 */
export function parseHpPayProfileText(ocrText: string): HpPayConsumerFields {
  const lines = ocrText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const raw: HpPayConsumerFields = {};
  let pending: keyof HpPayConsumerFields | null = null;

  for (const line of lines) {
    let matched = false;

    for (const rule of LABEL_RULES) {
      const withValue = line.match(rule.withValue);
      if (withValue) {
        const value = withValue[withValue.length - 1]?.trim();
        if (value && !isBlankValue(value) && !LOOKS_LIKE_LABEL.test(value)) {
          raw[rule.key] = value;
        }
        pending = null;
        matched = true;
        break;
      }

      if (rule.exact.test(line)) {
        pending = rule.key;
        matched = true;
        break;
      }
    }

    if (matched) continue;
    if (!pending) continue;
    if (LOOKS_LIKE_LABEL.test(line) || isBlankValue(line)) {
      pending = null;
      continue;
    }

    raw[pending] = line;
    pending = null;
  }

  const result: HpPayConsumerFields = {};

  if (raw.name && !LOOKS_LIKE_LABEL.test(raw.name)) {
    result.name = raw.name.replace(/\s+/g, ' ').trim().toLocaleUpperCase('en-IN');
  }

  if (raw.phone) {
    const phone = normalizePhone(raw.phone);
    if (phone) result.phone = phone;
  }

  if (raw.consumerNumber) {
    const consumerNumber = normalizeConsumerNumber(raw.consumerNumber);
    if (consumerNumber) result.consumerNumber = consumerNumber.toLocaleUpperCase('en-IN');
  }

  if (raw.pincode) {
    const pincode = normalizePincode(raw.pincode);
    if (pincode) result.pincode = pincode;
  }

  if (raw.address && !LOOKS_LIKE_LABEL.test(raw.address)) {
    let address = raw.address.replace(/\s+/g, ' ').trim();
    if (result.pincode && !address.includes(result.pincode)) {
      address = `${address} ${result.pincode}`.trim();
    }
    result.address = address.toLocaleUpperCase('en-IN');
  } else if (result.pincode) {
    result.address = result.pincode;
  }

  return result;
}

/** True when at least one fillable consumer field was found. */
export function hasHpPayConsumerFields(fields: HpPayConsumerFields): boolean {
  return Boolean(fields.name || fields.address || fields.phone || fields.consumerNumber);
}
