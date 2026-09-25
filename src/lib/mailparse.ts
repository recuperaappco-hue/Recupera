// Pure helpers for reading email content (unit tested).

export function htmlToText(html: string) {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/**
 * Colombian e-invoices arrive as a ZIP with a PDF and an XML "AttachedDocument".
 * We read the XML and pull the seller, date, total and item lines.
 */
export function invoiceFromXml(xml: string) {
  // AttachedDocument embeds the actual invoice inside CDATA.
  const inner = xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ?? xml;
  const pick = (re: RegExp, s = inner) => s.match(re)?.[1]?.trim();
  const seller = pick(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:RegistrationName>([^<]+)<\/cbc:RegistrationName>/);
  const date = pick(/<cbc:IssueDate>([^<]+)<\/cbc:IssueDate>/);
  const total = pick(/<cbc:PayableAmount[^>]*>([^<]+)<\/cbc:PayableAmount>/);
  const number = pick(/<cbc:ID>([^<]+)<\/cbc:ID>/);
  const items = [...inner.matchAll(/<cac:InvoiceLine>([\s\S]*?)<\/cac:InvoiceLine>/g)].slice(0, 15).map((m) => {
    const desc = pick(/<cbc:Description>([^<]+)<\/cbc:Description>/, m[1]);
    const amt = pick(/<cbc:LineExtensionAmount[^>]*>([^<]+)<\/cbc:LineExtensionAmount>/, m[1]);
    return `${desc ?? "?"} = ${amt ?? "?"}`;
  });
  if (!seller && !total) return "";
  return `FACTURA ELECTRÓNICA (XML DIAN)\nVendedor: ${seller}\nNúmero: ${number}\nFecha: ${date}\nTotal a pagar: ${total}\nÍtems:\n${items.join("\n")}`;
}

