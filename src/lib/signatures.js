const emptySignature = {
  full_name: "",
  job_title: "",
  company: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  logo_url: "",
  custom_text: "",
  linkedin: "",
  twitter: "",
  instagram: "",
  facebook: ""
};
const SIGNATURE_TEMPLATES = [
  { id: "modern-minimal", name: "Modern Minimal" },
  { id: "classic-professional", name: "Classic Professional" },
  { id: "corporate", name: "Corporate Style" },
  { id: "simple-clean", name: "Simple Clean" },
  { id: "elegant-blue", name: "Elegant Blue" },
  { id: "social-minimal", name: "Minimal with Social Icons" }
];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const link = (href, text, color) => `<a href="${esc(href)}" style="color:${color};text-decoration:none;">${esc(text)}</a>`;
function logoImg(d, size) {
  if (!d.logo_url) return "";
  return `<img src="${esc(d.logo_url)}" width="${size}" alt="${esc(d.company || "Logo")}" style="display:block;border:0;max-width:${size}px;height:auto;" />`;
}
function socialRow(d, color) {
  const items = [];
  if (d.linkedin) items.push(link(d.linkedin, "LinkedIn", color));
  if (d.twitter) items.push(link(d.twitter, "X", color));
  if (d.instagram) items.push(link(d.instagram, "Instagram", color));
  if (d.facebook) items.push(link(d.facebook, "Facebook", color));
  if (!items.length) return "";
  return `<div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;">${items.join(' <span style="color:#cccccc;">\xB7</span> ')}</div>`;
}
function contactLine(d, color) {
  const parts = [];
  if (d.email) parts.push(link(`mailto:${d.email}`, d.email, color));
  if (d.phone) parts.push(esc(d.phone));
  if (d.website) parts.push(link(d.website.startsWith("http") ? d.website : `https://${d.website}`, d.website, color));
  return parts.join(' <span style="color:#cccccc;">\xB7</span> ');
}
function renderSignature(templateId, d) {
  const name = esc(d.full_name || "Your Name");
  const title = esc(d.job_title);
  const company = esc(d.company);
  const custom = d.custom_text ? `<div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;">${esc(d.custom_text)}</div>` : "";
  const address = d.address ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;">${esc(d.address)}</div>` : "";
  switch (templateId) {
    case "classic-professional":
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Georgia,serif;"><tr><td style="padding-right:14px;vertical-align:top;">${logoImg(d, 72)}</td><td style="border-left:2px solid #1a1a2e;padding-left:14px;vertical-align:top;"><div style="font-size:16px;font-weight:bold;color:#1a1a2e;">${name}</div>${title ? `<div style="font-size:13px;color:#555555;font-style:italic;">${title}</div>` : ""}${company ? `<div style="font-size:13px;color:#555555;">${company}</div>` : ""}<div style="margin-top:6px;font-size:12px;color:#1a1a2e;">${contactLine(d, "#1a1a2e")}</div>${address}${custom}</td></tr></table>`;
    case "corporate":
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;"><tr><td style="background:#16213e;padding:14px 18px;vertical-align:middle;">${logoImg(d, 56)}</td><td style="background:#f4f6fa;padding:14px 18px;vertical-align:middle;"><div style="font-size:15px;font-weight:bold;color:#16213e;text-transform:uppercase;letter-spacing:1px;">${name}</div>${title ? `<div style="font-size:12px;color:#0f3460;">${title}</div>` : ""}${company ? `<div style="font-size:12px;font-weight:bold;color:#0f3460;">${company}</div>` : ""}<div style="margin-top:6px;font-size:12px;color:#444444;">${contactLine(d, "#0f3460")}</div>${address}${custom}</td></tr></table>`;
    case "simple-clean":
      return `<div style="font-family:Arial,Helvetica,sans-serif;"><div style="font-size:15px;font-weight:bold;color:#222222;">${name}</div>${title || company ? `<div style="font-size:13px;color:#666666;">${[title, company].filter(Boolean).join(" \xB7 ")}</div>` : ""}<div style="margin-top:6px;font-size:12px;color:#666666;">${contactLine(d, "#ff6b4a")}</div>${custom}</div>`;
    case "elegant-blue":
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;"><tr><td style="padding-right:14px;vertical-align:top;">${logoImg(d, 64)}</td><td style="vertical-align:top;"><div style="font-size:16px;font-weight:bold;color:#1e3a8a;">${name}</div>${title ? `<div style="font-size:12px;color:#3b82f6;letter-spacing:0.5px;">${title}</div>` : ""}${company ? `<div style="font-size:13px;color:#1e3a8a;">${company}</div>` : ""}<div style="margin-top:6px;border-top:1px solid #bfdbfe;padding-top:6px;font-size:12px;color:#555555;">${contactLine(d, "#2563eb")}</div>${address}${socialRow(d, "#2563eb")}${custom}</td></tr></table>`;
    case "social-minimal":
      return `<div style="font-family:Arial,Helvetica,sans-serif;"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle;padding-right:12px;">${logoImg(d, 48)}</td><td style="vertical-align:middle;"><div style="font-size:15px;font-weight:bold;color:#222222;">${name}</div>${title || company ? `<div style="font-size:12px;color:#777777;">${[title, company].filter(Boolean).join(" \xB7 ")}</div>` : ""}</td></tr></table><div style="margin-top:6px;font-size:12px;color:#666666;">${contactLine(d, "#0ea5a5")}</div>${socialRow(d, "#0ea5a5")}${custom}</div>`;
    case "modern-minimal":
    default:
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;"><tr><td style="padding-right:14px;vertical-align:top;">${logoImg(d, 60)}</td><td style="border-left:3px solid #ff6b4a;padding-left:14px;vertical-align:top;"><div style="font-size:16px;font-weight:bold;color:#1a1a2e;">${name}</div>${title ? `<div style="font-size:12px;color:#ff6b4a;">${title}</div>` : ""}${company ? `<div style="font-size:13px;color:#555555;">${company}</div>` : ""}<div style="margin-top:6px;font-size:12px;color:#666666;">${contactLine(d, "#ff6b4a")}</div>${socialRow(d, "#ff6b4a")}${custom}</td></tr></table>`;
  }
}
function signatureToText(d) {
  const lines = [d.full_name, [d.job_title, d.company].filter(Boolean).join(" \xB7 "), d.email, d.phone, d.website, d.address].filter(Boolean);
  return lines.join("\n");
}
export {
  SIGNATURE_TEMPLATES,
  emptySignature,
  renderSignature,
  signatureToText
};
