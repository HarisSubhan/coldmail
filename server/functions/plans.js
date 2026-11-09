import { createServerFn } from "../serverfn.js";
import { adminDb } from "../admin-client.js";
const publicClient = () => adminDb;
const listPublicPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().from("plans").select("id,name,description,price_monthly_pkr,price_yearly_pkr,features,sort_order").eq("active", true).order("sort_order");
  return data ?? [];
});
const getPublicSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().from("app_settings").select("whatsapp_number,whatsapp_message").eq("id", 1).maybeSingle();
  return {
    whatsapp_number: data?.whatsapp_number ?? "923377771527",
    whatsapp_message: data?.whatsapp_message ?? "Hi Origami99, I'd like to subscribe to the {plan} plan ({cycle}, PKR {price}). My name is {name} and my email is {email}."
  };
});
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
