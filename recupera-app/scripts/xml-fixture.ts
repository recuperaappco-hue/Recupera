import { invoiceFromXml } from "../src/lib/mailparse";

// Trimmed example of a DIAN AttachedDocument (invoice embedded in CDATA).
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<AttachedDocument xmlns:cbc="urn:cbc" xmlns:cac="urn:cac">
<cac:Attachment><cac:ExternalReference><cbc:Description><![CDATA[<?xml version="1.0"?>
<Invoice xmlns:cbc="urn:cbc" xmlns:cac="urn:cac">
<cbc:ID>FE-10231</cbc:ID>
<cbc:IssueDate>2025-10-10</cbc:IssueDate>
<cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>ALMACENES EJEMPLO S.A.S</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
<cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="COP">3899000.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
<cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:LineExtensionAmount currencyID="COP">3276470.59</cbc:LineExtensionAmount><cac:Item><cbc:Description>PORTATIL 14 PULGADAS</cbc:Description></cac:Item></cac:InvoiceLine>
</Invoice>]]></cbc:Description></cac:ExternalReference></cac:Attachment>
</AttachedDocument>`;

export const invoiceFromXmlForTest = () => invoiceFromXml(XML);
