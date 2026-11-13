const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isValidEmail = (e) => EMAIL_RE.test(e.trim());
const norm = (k) => k.toLowerCase().replace(/[^a-z]/g, "");
const ALIASES = {
  name: "name",
  fullname: "name",
  contactname: "name",
  firstname: "name",
  businessname: "business_name",
  business: "business_name",
  company: "business_name",
  companyname: "business_name",
  email: "email",
  emailaddress: "email",
  mail: "email",
  website: "website",
  url: "website",
  site: "website",
  web: "website"
};
function prepareLeads(rows, existingEmails = []) {
  const seen = new Set([...existingEmails].map((e) => e.toLowerCase()));
  const leads = [];
  let invalid = 0;
  let duplicates = 0;
  for (const row of rows) {
    const lead = { name: null, business_name: null, email: "", website: null, custom_fields: {} };
    for (const [k, v] of Object.entries(row)) {
      const val = String(v ?? "").trim();
      if (!val) continue;
      const field = ALIASES[norm(k)];
      if (field) lead[field] = val;
      else lead.custom_fields[k] = val;
    }
    lead.email = lead.email.toLowerCase();
    if (!isValidEmail(lead.email)) {
      invalid++;
      continue;
    }
    if (seen.has(lead.email)) {
      duplicates++;
      continue;
    }
    seen.add(lead.email);
    leads.push(lead);
  }
  return { leads, invalid, duplicates };
}
export {
  isValidEmail,
  prepareLeads
};
