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
const lc = (s) => { const t = strip(s); return t ? t[0].toLowerCase() + t.slice(1) : ""; };
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
