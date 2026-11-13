import net from "node:net";
import tls from "node:tls";
class Conn {
  constructor(socket) {
    this.socket = socket;
    this.attach(socket);
  }
  buf = "";
  waiters = [];
  attach(socket) {
    this.socket = socket;
    this.buf = "";
    socket.setEncoding("utf8");
    socket.on("data", (d) => {
      this.buf += d;
      this.flush();
    });
  }
  flush() {
    const lines = this.buf.split("\r\n");
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^\d{3} /.test(lines[i] ?? "")) {
        const reply = lines.slice(0, i + 1).join("\n");
        this.buf = lines.slice(i + 1).join("\r\n");
        const w = this.waiters.shift();
        if (w) w(reply);
        return this.flush();
      }
    }
  }
  read(timeoutMs = 2e4) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("SMTP timeout")), timeoutMs);
      this.waiters.push((l) => {
        clearTimeout(t);
        resolve(l);
      });
    });
  }
  async cmd(line, expect) {
    this.socket.write(line + "\r\n");
    const r = await this.read();
    const code = Number(r.slice(0, 3));
    if (!expect.includes(code)) throw new Error(`SMTP error after "${line.split(" ")[0]}": ${r}`);
    return r;
  }
}
function connect(cfg) {
  return new Promise((resolve, reject) => {
    const s = cfg.encryption === "ssl" ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host }, () => resolve(s)) : net.connect({ host: cfg.host, port: cfg.port }, () => resolve(s));
    s.once("error", reject);
  });
}
async function open(cfg) {
  const conn = new Conn(await connect(cfg));
  const greet = await conn.read();
  if (!greet.startsWith("220")) throw new Error(`SMTP greeting failed: ${greet}`);
  await conn.cmd("EHLO origami99.app", [250]);
  if (cfg.encryption === "tls") {
    await conn.cmd("STARTTLS", [220]);
    const secure = await new Promise((resolve, reject) => {
      const t = tls.connect({ socket: conn.socket, servername: cfg.host }, () => resolve(t));
      t.once("error", reject);
    });
    conn.attach(secure);
    await conn.cmd("EHLO origami99.app", [250]);
  }
  if (cfg.username) {
    await conn.cmd("AUTH LOGIN", [334]);
    await conn.cmd(Buffer.from(cfg.username).toString("base64"), [334]);
    await conn.cmd(Buffer.from(cfg.password).toString("base64"), [235]);
  }
  return conn;
}
async function testSmtp(cfg) {
  const conn = await open(cfg);
  await conn.cmd("QUIT", [221]).catch(() => {
  });
  conn.socket.end();
}
const encodeHeader = (s) => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`;
async function sendMail(cfg, msg) {
  const conn = await open(cfg);
  try {
    await conn.cmd(`MAIL FROM:<${msg.fromEmail}>`, [250]);
    await conn.cmd(`RCPT TO:<${msg.to}>`, [250, 251]);
    await conn.cmd("DATA", [354]);
    const domain = msg.fromEmail.split("@")[1] ?? "localhost";
    const b64 = (s) => Buffer.from(s).toString("base64").replace(/.{1,76}/g, "$&\r\n");
    const headers = [
      `From: ${encodeHeader(msg.fromName)} <${msg.fromEmail}>`,
      `To: <${msg.to}>`,
      msg.replyTo ? `Reply-To: <${msg.replyTo}>` : null,
      `Subject: ${encodeHeader(msg.subject)}`,
      `Date: ${(/* @__PURE__ */ new Date()).toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@${domain}>`,
      "MIME-Version: 1.0"
    ].filter(Boolean);
    let payload;
    if (msg.html) {
      const boundary = `----origami99-${crypto.randomUUID()}`;
      headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      payload = [
        `--${boundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        b64(msg.text),
        `--${boundary}`,
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        b64(msg.html),
        `--${boundary}--`
      ].join("\r\n");
    } else {
      headers.push("Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64");
      payload = b64(msg.text);
    }
    await conn.cmd(`${headers.join("\r\n")}\r
\r
${payload}\r
.`, [250]);
    await conn.cmd("QUIT", [221]).catch(() => {
    });
  } finally {
    conn.socket.end();
  }
}
export {
  sendMail,
  testSmtp
};
