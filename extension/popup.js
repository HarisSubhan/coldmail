const $ = (id) => document.getElementById(id);
function decode(code) {
  code = code.trim();
  if (!code.startsWith("O99-")) return null;
  try {
    const b = code.slice(4).replace(/-/g, "+").replace(/_/g, "/");
    const j = JSON.parse(atob(b + "===".slice((b.length + 3) % 4)));
    return j.u && j.t ? { url: String(j.u).replace(/\/+$/, ""), tok: j.t } : null;
  } catch { return null; }
}
chrome.storage.local.get(["code", "status"], (v) => {
  $("tok").value = v.code || ""; $("s").textContent = v.status || "Not connected";
});
$("save").onclick = () => {
  const code = $("tok").value.trim(), d = decode(code);
  if (!d) { $("s").textContent = "Invalid connect code. Copy it again from the Lead Finder page."; return; }
  chrome.storage.local.set({ url: d.url, tok: d.tok, code }, () => {
    $("s").textContent = "Checking…";
    chrome.runtime.sendMessage({ type: "check" }, (r) => { $("s").textContent = r?.msg || "Saved"; });
  });
};
for (const type of ["pause", "resume"]) $(type).onclick = () => {
  chrome.runtime.sendMessage({ type }, (response) => { $("s").textContent = response?.msg || "Request failed"; });
};
setInterval(() => chrome.storage.local.get(["status"], (v) => { if (v.status) $("s").textContent = v.status; }), 1500);
