const PATTERNS = {
  consultative: {
    label: "Professional Consultative Sales",
    steps: "1) natural personalized greeting and opening referencing the recipient's business/industry; 2) show understanding of their business and likely needs; 3) identify a genuine opportunity or area to improve; 4) introduce our service in detail and exactly how it helps them; 5) practical benefits and value proposition; 6) professional call to action (short call/meeting/details); 7) natural professional closing line."
  },
  problem_solution: {
    label: "Problem-Solution",
    steps: "1) personalized introduction; 2) highlight a relevant business challenge; 3) explain why it may affect their business; 4) introduce our service as a possible solution; 5) explain features and benefits in meaningful detail; 6) expected business value without guaranteed results; 7) compelling but non-aggressive call to action; 8) professional closing line."
  },
  value_growth: {
    label: "Value-Driven Business Growth",
    steps: "1) introduce the sender and reason for reaching out; 2) explain a relevant growth opportunity for their business; 3) present our service and its capabilities; 4) describe how it improves operations, online presence, customer acquisition, revenue or productivity; 5) relevant examples only from the provided information; 6) invite them to explore the opportunity; 7) professional closing line."
  },
  consultation: {
    label: "Personalized Solution & Consultation",
    steps: "1) professional introduction; 2) reference their business and industry; 3) explain why we are contacting them; 4) present a solution tailored to their business; 5) how we would implement it; 6) practical advantages of working together; 7) offer a consultation, demo or short discussion; 8) professional closing line."
  }
};
const SERVICES = {
  "SEO Services": "search visibility, organic traffic, keyword opportunities, technical SEO, local search/Google Maps ranking, and customer acquisition from search",
  "Website Development": "professional online presence, website performance and speed, user experience, mobile friendliness, business credibility and lead conversion",
  "Website Redesign": "modernizing an outdated site, improving UX and speed, stronger branding, mobile experience and higher conversion of visitors into enquiries",
  "Custom Software Development": "operational automation, workflow improvements, custom business requirements, integrations and efficiency",
  "SaaS Solutions": "cloud-based tools, subscription convenience, scalability, centralised data and reduced IT overhead",
  "AI Tools and Automation": "automating repetitive tasks with AI, improving productivity, reducing manual workload and faster response times",
  "Mobile Application Development": "reaching customers on their phones, bookings/orders in-app, push notifications, loyalty and brand engagement",
  "Digital Marketing": "multi-channel campaigns, targeted ads, measurable ROI, brand awareness and steady lead flow",
  "Social Media Marketing": "consistent content, audience engagement, community growth, paid social targeting and brand trust",
  "Lead Generation": "a predictable pipeline of qualified prospects, targeting, outreach and appointment setting",
  "CRM Solutions": "organising customer data, tracking deals, follow-up reminders, sales visibility and retention",
  "Business Automation": "connecting tools, removing manual data entry, automated reporting and smoother operations"
};
function serviceGuide(service) {
  if (!service) return "";
  return SERVICES[service] ? `Service focus: ${service}. Discuss specifically: ${SERVICES[service]}.` : `Service focus: ${service}. First reason about what this service really delivers to a business, then discuss its specific, concrete benefits (never a generic pitch).`;
}
export {
  PATTERNS,
  SERVICES,
  serviceGuide
};
