// Claim letter templates. Facts come from the finding; wording is fixed and versioned.
import { cop, fmtDate } from "./dates";

export const TEMPLATE_VERSION = "letters-v0.1";

export type LetterInput = {
  category: string;
  merchant: string | null;
  amount: number | null;
  name: string;
  email: string;
  orderRef?: string | null;
  eventDate?: string | null;
  dueDate?: string | null;
  priceFrom?: number | null;
  priceTo?: number | null;
  item?: string | null;
  fault?: string | null;
  evidence?: { subject: string; date: string }[];
};

export const CATEGORY_LABEL: Record<string, string> = {
  refund_pending: "Reembolso pendiente",
  duplicate_charge: "Cobro duplicado",
  flight_cancelled: "Vuelo cancelado",
  order_not_delivered: "Pedido no entregado",
  price_increase: "Aumento de tarifa",
  warranty: "Garantía",
};

export function buildLetter(i: LetterInput): { subject: string; body: string } {
  const who = i.merchant || "[Empresa]";
  const ref = i.orderRef ? ` (referencia ${i.orderRef})` : "";
  let subject = "", facts = "", ask = "";
  switch (i.category) {
    case "refund_pending":
      subject = `Reclamo por reembolso no recibido${ref}`;
      facts = `El ${fmtDate(i.eventDate)} ustedes confirmaron por correo la devolución de mi compra${ref}${i.amount ? ` por ${cop(i.amount)}` : ""} y el reembolso correspondiente. El plazo para el reembolso venció el ${fmtDate(i.dueDate)} y a la fecha no he recibido el dinero.`;
      ask = `el reembolso de ${i.amount ? cop(i.amount) : "la totalidad del valor pagado"} al medio de pago utilizado`;
      break;
    case "duplicate_charge":
      subject = "Reclamo por cobro duplicado";
      facts = `El ${fmtDate(i.eventDate)} se realizaron dos cobros por ${cop(i.amount)} a mi nombre por una sola compra, con pocos minutos de diferencia, según las alertas de mi banco.`;
      ask = `la devolución del cobro duplicado por ${cop(i.amount)}`;
      break;
    case "flight_cancelled":
      subject = `Solicitud de reembolso por vuelo cancelado${ref}`;
      facts = `Ustedes cancelaron mi vuelo${ref} programado para el ${fmtDate(i.eventDate)}. No acepté un cambio de vuelo ni un bono, y a la fecha no he recibido el reembolso.`;
      ask = `el reembolso del valor del tiquete${i.amount ? ` (${cop(i.amount)})` : ""} y la compensación que corresponda según las normas vigentes`;
      break;
    case "order_not_delivered":
      subject = `Reclamo por pedido no entregado${ref}`;
      facts = `Realicé un pedido${ref}${i.amount ? ` por ${cop(i.amount)}` : ""}. Ustedes informaron el ${fmtDate(i.eventDate)} un problema con la entrega y a la fecha no he recibido el producto ni el reembolso.`;
      ask = "la entrega inmediata del producto o, si no es posible, la devolución total del dinero pagado";
      break;
    case "price_increase":
      subject = "Solicitud para mantener mi tarifa";
      facts = `Recibí su aviso de que el precio de mi plan pasará de ${cop(i.priceFrom)} a ${cop(i.priceTo)} mensuales desde el ${fmtDate(i.dueDate)}. Soy cliente activo y quiero conservar mi plan.`;
      ask = "mantener mi tarifa actual o que me ofrezcan un plan equivalente al mismo precio. Si mi contrato tiene precio fijo o cláusula de permanencia, solicito que se respete lo pactado";
      break;
    case "warranty":
      subject = `Solicitud de garantía: ${i.item ?? "producto"}`;
      facts = `El ${fmtDate(i.eventDate)} compré ${i.item ?? "un producto"}${i.amount ? ` por ${cop(i.amount)}` : ""}, que está dentro del período de garantía (hasta el ${fmtDate(i.dueDate)}). El producto presenta la siguiente falla: ${i.fault || "[describe la falla]"}.`;
      ask = "hacer efectiva la garantía mediante la reparación del producto, su cambio o la devolución del dinero";
      break;
  }
  const ev = (i.evidence ?? []).map((e) => `- Correo "${e.subject}" del ${fmtDate(e.date)}`).join("\n");
  const body = `Señores ${who}:

Yo, ${i.name}, presento esta solicitud como consumidor.

Hechos:
${facts}

Petición:
Solicito ${ask}.
${ev ? `\nPruebas:\n${ev}\n` : ""}
Agradezco su respuesta dentro de los 15 días hábiles siguientes a la recepción de esta solicitud.

Atentamente,
${i.name}
${i.email}`;
  return { subject, body };
}
