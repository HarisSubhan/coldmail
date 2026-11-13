import { api } from "@/lib/db-client";
const listPublicPlans = (opts) => api("/api/fn/listPublicPlans", { data: opts?.data ?? null }).then((r) => r.result);
const getPublicSettings = (opts) => api("/api/fn/getPublicSettings", { data: opts?.data ?? null }).then((r) => r.result);
function buildWhatsAppUrl(number, message) {
  const digits = number.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
function fillWhatsAppTemplate(template, vars) {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v);
  out = out.replace(/\s*\{[a-z_]+\}\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  return out;
}
export {
  buildWhatsAppUrl,
  fillWhatsAppTemplate,
  getPublicSettings,
  listPublicPlans
};
