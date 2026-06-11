// Minimal HTML → RTF converter for NotePad exports (#NotePad export buttons).
// Handles headings, paragraphs, bold/italic/underline/strike, inline code,
// bullet + numbered lists, line breaks and links (text only). Browser-only
// (uses DOMParser); returns "" on the server.

function escapeRtf(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\\" || ch === "{" || ch === "}") out += "\\" + ch;
    else if (ch === "\n") out += "\\line ";
    else if (ch === "\t") out += "\\tab ";
    else if (code <= 127) out += ch;
    else if (code <= 65535) out += `\\u${code > 32767 ? code - 65536 : code}?`;
    else out += "?"; // astral plane (emoji) — needs surrogate handling; skip
  }
  return out;
}

export function htmlToRtf(html: string): string {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");

  const walkList = (listEl: Element, ordered: boolean): string => {
    let out = "";
    let i = 1;
    for (const li of Array.from(listEl.children)) {
      if (li.tagName.toLowerCase() !== "li") continue;
      const marker = ordered ? `${i}.` : "\\bullet";
      out += `{${marker}\\tab ${walk(li)}}\\par\n`;
      i++;
    }
    return out;
  };

  const walk = (node: Node): string => {
    let out = "";
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += escapeRtf(child.textContent || "");
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      switch (el.tagName.toLowerCase()) {
        case "h1": out += `{\\b\\fs48 ${walk(el)}}\\par\n`; break;
        case "h2": out += `{\\b\\fs32 ${walk(el)}}\\par\n`; break;
        case "h3": out += `{\\b\\fs26 ${walk(el)}}\\par\n`; break;
        case "p": out += `${walk(el)}\\par\n`; break;
        case "br": out += "\\line "; break;
        case "strong":
        case "b": out += `{\\b ${walk(el)}}`; break;
        case "em":
        case "i": out += `{\\i ${walk(el)}}`; break;
        case "u": out += `{\\ul ${walk(el)}}`; break;
        case "s":
        case "strike":
        case "del": out += `{\\strike ${walk(el)}}`; break;
        case "code": out += `{\\f1 ${walk(el)}}`; break;
        case "a": out += walk(el); break; // link text only
        case "ul": out += walkList(el, false); break;
        case "ol": out += walkList(el, true); break;
        case "blockquote": out += `${walk(el)}\\par\n`; break;
        default: out += walk(el); break;
      }
    });
    return out;
  };

  const content = walk(doc.body);
  return (
    "{\\rtf1\\ansi\\ansicpg1252\\deff0" +
    "{\\fonttbl{\\f0 Public Sans;}{\\f1 Courier New;}}\\fs24\n" +
    content +
    "}"
  );
}
