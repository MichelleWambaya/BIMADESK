/**
 * Guesses which spreadsheet column holds which field.
 *
 * Intermediaries keep their books in whatever a previous employer, an
 * insurer's template, or a nephew set up, so headers are wildly
 * inconsistent: "Full Names", "INSURED", "Client", "Mobile No", "Tel",
 * "Msisdn", "E-mail Address". The old matcher only accepted a header that
 * literally contained the field name, so it found "email" and almost
 * nothing else, and every import became manual mapping.
 *
 * Matching runs in tiers, strongest first, and a column is only ever
 * claimed by one field. That ordering matters: without it a sheet with
 * both "Name" and "Business Name" can bind the wrong one, and a sheet
 * with "Phone" and "Alt Phone" can bind the alternate as the primary.
 */

export interface ImportField {
  key: string;
  label: string;
  /** Shown when a field is unmapped and it matters. */
  hint?: string;
  required?: boolean;
}

export const IMPORT_FIELDS: ImportField[] = [
  { key: "name", label: "Client or business name", required: true },
  { key: "phone", label: "Phone", required: true, hint: "Used to spot duplicates and to send reminders." },
  { key: "email", label: "Email" },
  { key: "clientType", label: "Client type", hint: "Individual, family, company and so on. Left blank, everyone comes in as an individual." },
  { key: "nationalId", label: "National ID or passport" },
  { key: "kraPin", label: "KRA PIN" },
  { key: "registrationNumber", label: "Company or society number" },
  { key: "altPhone", label: "Alternative phone" },
  { key: "city", label: "Town or city" },
  { key: "contactPersonName", label: "Contact person" },
  { key: "notes", label: "Notes" },
];

/** Synonyms per field, lowercase, punctuation and spaces stripped. */
const SYNONYMS: Record<string, string[]> = {
  name: [
    "name", "names", "clientname", "clientnames", "fullname", "fullnames",
    "insured", "insuredname", "policyholder", "policyholdername", "member",
    "membername", "client", "customer", "customername", "businessname",
    "companyname", "organisation", "organization", "surname",
  ],
  phone: [
    "phone", "phoneno", "phonenumber", "mobile", "mobileno", "mobilenumber",
    "tel", "telephone", "telno", "cell", "cellphone", "cellno", "contact",
    "contactno", "contactnumber", "msisdn", "primaryphone",
  ],
  altPhone: [
    "altphone", "alternativephone", "alternatephone", "secondphone",
    "otherphone", "phone2", "mobile2", "secondarycontact", "altcontact",
  ],
  email: ["email", "emailaddress", "mail", "emailid", "eaddress"],
  clientType: [
    "clienttype", "type", "category", "clientcategory", "customertype",
    "accounttype", "entitytype", "class",
  ],
  nationalId: [
    "nationalid", "id", "idno", "idnumber", "identitynumber", "passport",
    "passportno", "passportnumber", "idpassport", "nationalidpassport",
  ],
  kraPin: ["krapin", "pin", "pinnumber", "kra", "taxpin", "krano", "pinno"],
  registrationNumber: [
    "registrationnumber", "regno", "registrationno", "companyno",
    "companynumber", "certificateno", "incorporationno", "societyno",
  ],
  city: ["city", "town", "location", "area", "region", "county", "address", "physicaladdress"],
  contactPersonName: [
    "contactperson", "contactpersonname", "attention", "attn", "focalperson",
    "representative", "authorisedperson", "authorizedperson",
  ],
  notes: ["notes", "note", "remarks", "comment", "comments", "description", "details"],
};

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Maps headers to field keys.
 *
 * Tier 1: exact match against a synonym.
 * Tier 2: header starts with a synonym, so "Phone (Primary)" resolves.
 * Tier 3: header contains a synonym, the loosest tier, and only for
 *         synonyms of four characters or more. Without that floor, "id"
 *         matches "Valid From" and "pin" matches "Shipping".
 */
export function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const claimed = new Set<string>();

  const normalisedHeaders = headers.map((h) => ({ raw: h, norm: normalise(h) }));

  // Longer synonyms first inside each field, so "businessname" is tried
  // before "name" and does not lose to it.
  const fieldsInOrder = IMPORT_FIELDS.map((f) => f.key).filter((k) => SYNONYMS[k]);

  for (const tier of [1, 2, 3] as const) {
    for (const field of fieldsInOrder) {
      if (mapping[field]) continue;

      const synonyms = [...SYNONYMS[field]].sort((a, b) => b.length - a.length);

      for (const syn of synonyms) {
        if (tier === 3 && syn.length < 4) continue;

        const hit = normalisedHeaders.find(({ raw, norm }) => {
          if (claimed.has(raw)) return false;
          if (tier === 1) return norm === syn;
          if (tier === 2) return norm.startsWith(syn);
          return norm.includes(syn);
        });

        if (hit) {
          mapping[field] = hit.raw;
          claimed.add(hit.raw);
          break;
        }
      }
    }
  }

  return mapping;
}

/** Normalises whatever someone typed in a "type" column onto our enum. */
export function normaliseClientType(raw: string | undefined): string {
  if (!raw) return "individual";
  const v = normalise(raw);

  if (["company", "limited", "ltd", "corporate", "corporation", "plc", "enterprise"].some((s) => v.includes(s)))
    return "company";
  if (["sacco", "group", "chama", "welfare", "association", "society", "union"].some((s) => v.includes(s)))
    return "group";
  if (["family", "household", "spouse", "dependant", "dependent"].some((s) => v.includes(s)))
    return "family";
  if (["sole", "proprietor", "businessname", "trader", "selfemployed"].some((s) => v.includes(s)))
    return "sole_proprietor";

  return "individual";
}

/**
 * Confidence in an automatic mapping, so the interface can decide whether
 * to present it as done or as a draft needing review. Everything mapped
 * still gets shown for confirmation; a wrong column silently imported is
 * far more expensive to unpick than one extra screen.
 */
export function mappingConfidence(mapping: Record<string, string>): "high" | "partial" | "low" {
  const hasName = !!mapping.name;
  const hasPhone = !!mapping.phone;
  if (hasName && hasPhone) return Object.keys(mapping).length >= 4 ? "high" : "partial";
  if (hasName || hasPhone) return "partial";
  return "low";
}
