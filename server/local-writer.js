// Origami99 built-in email writer. Runs fully on your server: no OpenAI, no API key, no cost.
// It combines many sentence variations with campaign + lead details so every email is different.

function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
function picker(seed) {
  let x = hash(seed) || 1;
  return (arr) => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    return arr[x % arr.length];
  };
}
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const firstName = (n) => clean(n).split(" ")[0] || "";
const strip = (s) => clean(s).replace(/[.!]+$/, "");
const lc = (s) => { const t = strip(s); return t && !/^[A-Z]{2}/.test(t) ? t[0].toLowerCase() + t.slice(1) : t; };
function points(s) {
  return String(s ?? "").split(/\n|;|•|,(?=\s*[A-Z])/).map(strip).filter(Boolean).slice(0, 4);
}
function domain(w) {
  return clean(w).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

const TONES = {
  Professional: { hi: ["Hi {n},", "Hello {n},", "Dear {n},"], close: ["Best regards,", "Kind regards,"] },
  Friendly: { hi: ["Hi {n}!", "Hey {n},", "Hi {n},"], close: ["Cheers,", "Thanks so much,", "Talk soon,"] },
  Formal: { hi: ["Dear {n},", "Good day {n},"], close: ["Yours sincerely,", "With kind regards,"] },
  Casual: { hi: ["Hey {n},", "Hi {n},"], close: ["Cheers,", "Thanks,"] },
  Persuasive: { hi: ["Hi {n},", "Hello {n},"], close: ["Best,", "Looking forward,"] },
};

export function writeColdEmail(c, lead) {
  const pick = picker(`${lead.email}|${c.name}|${Date.now()}`);
  const tone = TONES[c.tone] ?? TONES.Professional;
  const name = firstName(lead.name) || (lead.business_name ? `${clean(lead.business_name)} team` : "there");
  const biz = clean(lead.business_name);
  const site = domain(lead.website);
  const niche = strip(c.niche);
  const offer = strip(c.offer) || "a service that helps businesses grow";
  const sp = points(c.selling_points);
  const kw = (c.keywords ?? []).map(strip).filter(Boolean);
  const purpose = strip(c.purpose);
  const len = c.length || "Medium";

  const subject = pick([
    biz ? `Quick idea for ${biz}` : "Quick idea for you",
    biz ? `${biz} + ${kw[0] || "growth"}` : `A quick question about ${kw[0] || "growth"}`,
    `Helping ${niche || "businesses like yours"} with ${kw[0] || lc(offer).split(" ").slice(0, 3).join(" ")}`,
    biz ? `A thought for the ${biz} team` : "A short thought",
    `${name !== "there" ? firstName(lead.name) + ", " : ""}worth a quick look?`,
  ]);

  const opener = pick([
    `I came across ${biz || "your business"}${site ? ` (${site})` : ""} and wanted to reach out personally.`,
    `I've been looking at ${niche ? `businesses in the ${lc(niche)} space` : "businesses in your space"}, and ${biz || "yours"} stood out.`,
    `I'll keep this short, as I know your time is valuable.`,
    `I'm reaching out because we work with ${niche || "teams"} like ${biz || "yours"}${c.audience ? ` and ${lc(c.audience)}` : ""}.`,
  ]);

  const pitch = pick([
    `We offer ${lc(offer)}.`,
    `In short, we provide ${lc(offer)}.`,
    `What we do is simple: ${lc(offer)}.`,
  ]);

  let benefits = "";
  if (sp.length) {
    benefits = len === "Short"
      ? `${pick(["The biggest benefit:", "What clients like most:"])} ${lc(sp[0])}.`
      : `${pick(["Here's what that means for you:", "A few reasons clients choose us:", "What makes it different:"])}\n${sp.map((p) => `- ${p}`).join("\n")}`;
  } else if (kw.length) {
    benefits = `It's especially useful if ${kw.slice(0, 3).join(", ")} ${kw.length > 1 ? "are" : "is"} a priority for you.`;
  }

  const why = biz ? pick([
    `I think this could be a good fit for ${biz}.`,
    `I believe ${biz} could get real value from this.`,
  ]) : "";

  const cta = purpose
    ? pick([`Shall we ${lc(purpose).replace(/^to /, "")}?`, `Could we ${lc(purpose).replace(/^to /, "")} this week?`, `My goal is simple: ${lc(purpose).replace(/^to /, "")}. Would that work for you?`])
    : pick([
        "Would you be open to a quick 10-minute call this week?",
        "Is this something you'd like to hear more about?",
        "Would it make sense to have a short chat?",
        "Can I send you a few more details?",
      ]);

  const extra = len === "Long" ? pick([
    "There's no pressure at all. If it's not the right time, just let me know and I won't follow up unnecessarily.",
    "Happy to share examples of results we've achieved for similar businesses.",
  ]) : "";

  const parts = [tone.hi[0] && pick(tone.hi).replace("{n}", name), opener, len === "Short" ? `${pitch} ${benefits}` : pitch];
  if (len !== "Short" && benefits) parts.push(benefits);
  if (len !== "Short" && why) parts.push(why);
  if (extra) parts.push(extra);
  parts.push(cta, pick(tone.close));
  return { subject, body: parts.filter(Boolean).join("\n\n") };
}

export function writeFollowup(campaign, orig, delayDays) {
  const pick = picker(`${orig.id}|${Date.now()}`);
  const tone = TONES[campaign.tone] ?? TONES.Professional;
  const name = firstName(orig.leads?.name) || "there";
  const biz = clean(orig.leads?.business_name);
  const when = delayDays <= 2 ? "a couple of days ago" : delayDays <= 7 ? "last week" : "a little while ago";
  return {
    body: [
      pick(tone.hi).replace("{n}", name),
      pick([
        `I wanted to follow up on the email I sent ${when}${orig.subject ? ` about "${orig.subject.replace(/^Re:\s*/i, "")}"` : ""}.`,
        `Just bringing my previous note back to the top of your inbox.`,
        `I know things get busy, so I'm following up on my message from ${when}.`,
      ]),
      pick([
        `I still think it could be useful for ${biz || "you"}.`,
        `If it's relevant for ${biz || "your team"}, I'd be glad to share more.`,
      ]),
      pick(["Would a short call this week work?", "Is this worth a quick chat?", "Should I send over a few more details?", "If it's not a priority right now, no problem at all, just let me know."]),
      pick(tone.close),
    ].join("\n\n"),
  };
}

const RULES = [
  ["unsubscribe", /unsubscribe|remove me|stop (emailing|sending)|don'?t (email|contact)|opt.?out/i],
  ["out_of_office", /out of (the )?office|on (annual )?leave|on vacation|away until|auto.?reply|automatic reply/i],
  ["not_interested", /not interested|no thanks|no, thank|not (a )?(good )?fit|we('re| are) (all )?set|not looking|pass on this/i],
  ["interested", /interested|sounds good|let'?s (talk|chat|meet)|book|schedule|call me|send (me )?(more|details)|tell me more|yes/i],
  ["question", /\?|how much|price|pricing|cost|how does|what is|can you/i],
];
const RESPONSES = {
  interested: "Hi,\n\nThank you for getting back to me, I'm glad this caught your interest! I'd love to set up a short call. What day and time work best for you this week?\n\nBest regards,",
  question: "Hi,\n\nThanks for your question. Happy to explain. In short, we tailor everything to your needs, and I can share exact details and pricing on a quick call. Would you have 10 minutes this week?\n\nBest regards,",
  not_interested: "Hi,\n\nThank you for letting me know, I appreciate the reply. I won't follow up further. If anything changes in the future, feel free to reach out anytime.\n\nAll the best,",
  out_of_office: "Hi,\n\nThanks for the note. I'll reach out again after you're back.\n\nBest regards,",
  unsubscribe: "Hi,\n\nUnderstood. You've been removed and won't receive further emails from us. Apologies for any inconvenience.\n\nBest regards,",
  other: "Hi,\n\nThank you for your reply. Could you share a little more about what you're looking for, so I can help in the best way?\n\nBest regards,",
};
export function classifyReply(subject, body) {
  const text = `${subject ?? ""}\n${body ?? ""}`;
  const classification = (RULES.find(([, re]) => re.test(text)) ?? ["other"])[0];
  return { classification, response: RESPONSES[classification] };
}

// ===== Pattern-based writer (v5): 4 sales frameworks, service knowledge, 4 subject ideas =====
import { SERVICES } from "../src/lib/email-patterns.js";

function serviceAreas(service) {
  const g = SERVICES[service] || "";
  return g.split(/,| and /).map(strip).filter(Boolean);
}

export function writePatternEmail(c, lead) {
  const pick = picker(`${lead.email}|${c.name}|${c.pattern}|${Date.now()}`);
  const tone = TONES[c.tone] ?? TONES.Professional;
  const name = firstName(lead.name) || (lead.business_name ? `${clean(lead.business_name)} team` : "there");
  const biz = clean(lead.business_name) || "your business";
  const site = domain(lead.website);
  const niche = strip(c.niche) || strip(lead.custom_fields?.keyword) || "local";
  const city = strip(lead.custom_fields?.city);
  const service = strip(c.service) || "our services";
  const areas = serviceAreas(c.service);
  const a = (n, fb) => areas[n] || fb;
  const cap = (x) => x ? x[0].toUpperCase() + x.slice(1) : x;
  const offer = strip(c.offer);
  const sp = points(c.selling_points);
  const objective = strip(c.objective) || strip(c.purpose);
  const len = c.length || "Medium";
  const where = city ? ` in ${city}` : "";

  const greet = pick(tone.hi).replace("{n}", name);
  const intro = pick([
    `I came across ${biz}${site ? ` (${site})` : ""}${where} while researching ${lc(niche)} businesses, and wanted to reach out personally.`,
    `I've been looking at how ${lc(niche)} businesses${where} present themselves online, and ${biz} caught my attention.`,
    `I hope you're doing well. I'm reaching out because ${biz} looks like exactly the kind of ${lc(niche)} business we enjoy working with.`,
  ]);
  const understand = pick([
    `For a ${lc(niche)} business, new enquiries usually depend on being easy to find, looking trustworthy at first glance and making it simple for people to get in touch.`,
    `Businesses like ${biz} rely on a steady flow of new customers, and today most of them start their search online before they ever call or visit.`,
  ]);
  const gap = pick([
    `Looking at ${biz} from the outside, I believe there is a real opportunity around ${lc(a(0, "your online presence"))} and ${lc(a(1, "customer acquisition"))}.`,
    `From what I can see, ${biz} could get noticeably more out of ${lc(a(0, "its online presence"))}, especially when it comes to ${lc(a(1, "turning visitors into enquiries"))}.`,
  ]);
  const problem = pick([
    `A common challenge we see is that strong businesses lose potential customers simply because competitors are more visible or easier to contact.`,
    `Many ${lc(niche)} businesses tell us their biggest frustration is inconsistent enquiries: busy one month, quiet the next.`,
  ]);
  const impact = `Over time this can mean fewer calls, a smaller share of local demand and more money spent chasing customers who were already searching for a business like yours.`;
  const pitch = `This is where our ${service} come in.${offer ? ` ${offer[0].toUpperCase() + offer.slice(1)}.` : ""} We focus on ${areas.slice(0, 4).map(lc).join(", ") || "practical, measurable improvements"}${areas.length > 4 ? `, as well as ${lc(areas[4])}` : ""}.`;
  const how = pick([
    `We would start with a short review of where ${biz} stands today, agree on the most valuable improvements, and then handle the work for you with clear updates along the way.`,
    `Our process is simple: a quick assessment, a clear plan tailored to ${biz}, and hands-on implementation, so you can stay focused on running the business.`,
  ]);
  const benefits = sp.length
    ? `${pick(["What this means for you in practice:", "A few things clients value most:"])}\n${sp.map((p) => `- ${p}`).join("\n")}`
    : `${pick(["What this means for you in practice:", "The practical benefits:"])}\n- ${cap(a(0, "Better visibility"))}\n- ${cap(a(2, "A stronger first impression"))}\n- ${cap(a(3, "More enquiries from the right customers"))}`;
  const value = `We can't promise overnight results, but our goal is steady, measurable progress that pays for itself.`;
  const cta = objective
    ? pick([`My aim is simple: ${lc(objective)}. Would you be open to a short 15-minute call this week?`, `If it makes sense, I'd love to ${lc(objective).replace(/^to /, "")}. Would a quick call work for you?`])
    : pick(["Would you be open to a short 15-minute call this week to see if this is a fit?", "Would it be useful if I shared a few specific ideas for your business?"]);
  const closingLine = pick(["Thank you for your time, and I look forward to hearing from you.", "Either way, I wish you and the team continued success."]);
  const custom = strip(c.custom_instructions);

  const flows = {
    consultative: [intro, understand, gap, pitch, benefits, cta],
    problem_solution: [intro, problem, impact, pitch, benefits, value, cta],
    value_growth: [intro, `I'd like to briefly share how we help ${lc(niche)} businesses like ${biz} grow.`, pitch, benefits, value, cta],
    consultation: [intro, `I'm contacting you because I believe ${biz} could benefit from ${lc(service)}.`, gap, pitch, how, benefits, cta],
  };
  let body = flows[c.pattern] ?? flows.consultative;
  if (len === "Short") body = body.filter((x) => x !== impact && x !== how && x !== understand && x !== value);
  if (len === "Long" && !body.includes(how)) body = [...body.slice(0, -1), how, body.at(-1)];
  if (custom) body = [...body.slice(0, -1), custom[0].toUpperCase() + custom.slice(1) + ".", body.at(-1)];
  const text = [greet, ...body, closingLine, pick(tone.close)].join("\n\n");

  const short = service.replace(/ Services?$/i, "");
  const subjects = [...new Set([
    `${biz !== "your business" ? biz : "Your business"}: a quick ${lc(short)} idea`,
    `Helping ${biz} with ${lc(a(0, short))}`,
    `More enquiries for ${niche === "local" ? biz : lc(niche)}${where}?`,
    firstName(lead.name) ? `${firstName(lead.name)}, ${pick(["a short question", "worth a quick chat?", "an idea for you"])}` : `A short question for ${biz}`,
    `${short} for ${biz}`,
  ].map((x) => x.slice(0, 60)))].slice(0, 4);
  return { subject: subjects[0], subject_options: subjects, body: text };
}
