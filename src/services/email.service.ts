import nodemailer, { type Transporter } from "nodemailer";

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || "smtp.hostinger.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE === "false" ? false : port === 465;
  const user = process.env.SMTP_USER || "authorinquiry@barnesnnobel.com";
  const pass = process.env.SMTP_PASS || "vix1-teqo-g87p-kvng";
  const from = process.env.SMTP_FROM || `"Power Line & Server Embassy" <${user}>`;
  const notifyEmail = process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAIL || "info@360webcoders.com";

  return { host, port, secure, user, pass, from, notifyEmail };
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const cfg = getSmtpConfig();
  if (!cfg.user || !cfg.pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
    });
  }
  return transporter;
}

export function isPowerlineStore(store?: string, type?: string): boolean {
  const s = `${store || ""} ${type || ""}`.toLowerCase();
  if (s.includes("server") || s.includes("embassy") || s.includes("lucky") || s.includes("scoop")) {
    return false;
  }
  return true; // Defaults to Power Line Devices
}

function getStoreTitle(store?: string, type?: string): string {
  const s = `${store || ""} ${type || ""}`.toLowerCase();
  if (s.includes("server") || s.includes("embassy")) return "Server Embassy";
  if (s.includes("lucky") || s.includes("scoop")) return "Lucky Girl Scoop";
  return "Power Line Devices";
}

function formatCurrency(val?: number): string {
  if (typeof val !== "number" || isNaN(val)) return "$0.00";
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Send Admin Notification & Customer Acknowledgment on New Quote / RFQ
 * Power Line Devices queries are routed strictly to: RFQ@powerlinedevices.com
 */
export async function sendQuoteAlert(quote: {
  id?: string;
  _id?: unknown;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  partNumber?: string;
  quantity?: number;
  targetPrice?: number;
  message?: string;
  status?: string;
  store?: string;
  type?: string;
  createdAt?: Date;
}) {
  const cfg = getSmtpConfig();
  const transport = getTransporter();
  if (!transport) {
    console.warn("⚠️ [Email] SMTP not configured. Skipping quote alert email.");
    return false;
  }

  const isPl = isPowerlineStore(quote.store, quote.type);
  const storeName = getStoreTitle(quote.store, quote.type);
  const quoteId = String(quote.id || quote._id || "N/A");
  const dateStr = new Date(quote.createdAt || Date.now()).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Dedicated Power Line RFQ mailbox
  const plRfqEmail = process.env.POWERLINE_RFQ_EMAIL || "RFQ@powerlinedevices.com";
  const adminRecipients = isPl
    ? Array.from(new Set([plRfqEmail, cfg.notifyEmail].filter(Boolean)))
    : cfg.notifyEmail;
  const replyToCustomer = isPl ? plRfqEmail : cfg.notifyEmail;

  const adminHtml = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
    <div style="background: #0f172a; padding: 24px 32px; color: #ffffff;">
      <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8;">${storeName} Enterprise</span>
      <h2 style="margin: 6px 0 0; font-size: 22px; font-weight: 700;">New Quote / RFQ Submission</h2>
    </div>
    <div style="padding: 28px 32px;">
      <p style="font-size: 14px; color: #475569; margin: 0 0 20px;">A new inbound bulk-quote request has been submitted on <strong>${storeName}</strong>.</p>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 140px;">Customer / Company:</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${quote.name} ${quote.company ? `(${quote.company})` : ""}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Email:</td>
          <td style="padding: 10px 0; color: #0284c7;"><a href="mailto:${quote.email}" style="color: #0284c7; text-decoration: none;">${quote.email}</a></td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Phone:</td>
          <td style="padding: 10px 0; color: #0f172a;">${quote.phone || "Not provided"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Part / SKU:</td>
          <td style="padding: 10px 0; color: #0f172a; font-family: monospace; font-weight: 700;">${quote.partNumber || "General Hardware Inquiry"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Requested Quantity:</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 700;">${quote.quantity ?? "N/A"}</td>
        </tr>
        ${
          quote.targetPrice
            ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Target Unit Price:</td>
          <td style="padding: 10px 0; color: #16a34a; font-weight: 700;">${formatCurrency(quote.targetPrice)}</td>
        </tr>`
            : ""
        }
        <tr>
          <td style="padding: 10px 0; color: #64748b; font-weight: 600; vertical-align: top;">Message:</td>
          <td style="padding: 10px 0; color: #334155; line-height: 1.5;">${quote.message || "No additional message."}</td>
        </tr>
      </table>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
        Submitted at ${dateStr} • Routed to: ${isPl ? plRfqEmail : cfg.notifyEmail}
      </div>
    </div>
  </div>`;

  const customerHtml = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
    <div style="background: #0066ff; padding: 24px 32px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Quote Request Received</h2>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">${storeName} Enterprise Hardware Desk</p>
    </div>
    <div style="padding: 28px 32px;">
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 16px;">Dear ${quote.name},</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px;">
        Thank you for contacting <strong>${storeName}</strong>. Our enterprise hardware procurement desk has received your Request for Quotation (RFQ) and is reviewing current availability and volume discount tiers.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">RFQ Summary</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 6px;"><strong>Part / SKU:</strong> ${quote.partNumber || "Hardware inquiry"}</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 6px;"><strong>Requested Quantity:</strong> ${quote.quantity ?? "N/A"}</div>
        ${quote.targetPrice ? `<div style="font-size: 13px; color: #475569; margin-bottom: 6px;"><strong>Target Price:</strong> ${formatCurrency(quote.targetPrice)}</div>` : ""}
      </div>

      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px;">
        A dedicated account manager will be in touch with an official quotation within 1-2 business hours.
      </p>
      <p style="font-size: 14px; color: #475569; margin: 0;">
        Need immediate assistance? Reply directly to this email or reach our procurement desk at <strong><a href="mailto:${replyToCustomer}" style="color: #0066ff; text-decoration: none;">${replyToCustomer}</a></strong>.
      </p>
    </div>
    <div style="background: #f8fafc; padding: 14px 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      © ${new Date().getFullYear()} ${storeName}. All rights reserved.
    </div>
  </div>`;

  try {
    // 1. Send Alert to Admin / RFQ Mailbox
    await transport.sendMail({
      from: `"${storeName} RFQ" <${cfg.user}>`,
      to: adminRecipients,
      replyTo: `"${quote.name}" <${quote.email}>`,
      subject: `🚨 [New Quote / RFQ] ${quote.partNumber ? `${quote.partNumber} (Qty: ${quote.quantity ?? 1})` : "Hardware RFQ"} - ${quote.name}`,
      html: adminHtml,
    });

    // 2. Send Acknowledgment to Customer
    await transport.sendMail({
      from: `"${storeName} Procurement" <${cfg.user}>`,
      to: quote.email,
      replyTo: replyToCustomer,
      subject: `We've received your quote request - ${storeName}`,
      html: customerHtml,
    });

    console.log(`✅ [Email] Quote alert dispatched for ${quote.email} (Routed to: ${Array.isArray(adminRecipients) ? adminRecipients.join(", ") : adminRecipients})`);
    return true;
  } catch (err) {
    console.error("❌ [Email] Failed to send quote alert email:", err);
    return false;
  }
}

/**
 * Send Admin Alert & Customer Receipt on New Order
 * Power Line Devices orders are routed strictly to: info@powerlinedevices.com
 */
export async function sendOrderAlert(order: {
  orderNumber: string;
  email: string;
  store?: string;
  type?: string;
  subtotal: number;
  discount?: number;
  shippingCost?: number;
  tax?: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  billingAddress?: any;
  shippingAddress?: any;
  items: Array<{
    title: string;
    sku?: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    selectedOption?: string;
  }>;
  placedAt?: Date;
}) {
  const cfg = getSmtpConfig();
  const transport = getTransporter();
  if (!transport) {
    console.warn("⚠️ [Email] SMTP not configured. Skipping order alert email.");
    return false;
  }

  const isPl = isPowerlineStore(order.store, order.type);
  const storeName = getStoreTitle(order.store, order.type);

  // Dedicated Power Line Orders mailbox
  const plOrdersEmail = process.env.POWERLINE_ORDERS_EMAIL || "info@powerlinedevices.com";
  const adminRecipients = isPl
    ? Array.from(new Set([plOrdersEmail, cfg.notifyEmail].filter(Boolean)))
    : cfg.notifyEmail;
  const replyToCustomer = isPl ? plOrdersEmail : cfg.notifyEmail;

  const itemsRows = (order.items || [])
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 12px 0;">
        <div style="font-weight: 600; color: #0f172a; font-size: 14px;">${item.title}</div>
        ${item.sku ? `<div style="font-size: 12px; color: #64748b; font-family: monospace;">SKU: ${item.sku}</div>` : ""}
        ${item.selectedOption ? `<div style="font-size: 12px; color: #64748b;">Option: ${item.selectedOption}</div>` : ""}
      </td>
      <td style="padding: 12px 10px; text-align: center; color: #334155; font-size: 14px;">${item.qty}</td>
      <td style="padding: 12px 0; text-align: right; color: #0f172a; font-weight: 600; font-size: 14px;">${formatCurrency(item.lineTotal)}</td>
    </tr>`,
    )
    .join("");

  const shipping = order.shippingAddress || {};
  const customerName = `${shipping.firstName || ""} ${shipping.lastName || ""}`.trim() || order.email;

  const adminHtml = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
    <div style="background: #0f172a; padding: 24px 32px; color: #ffffff;">
      <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #10b981;">New Order Placed</span>
      <h2 style="margin: 6px 0 0; font-size: 22px; font-weight: 700;">Order #${order.orderNumber}</h2>
    </div>
    <div style="padding: 28px 32px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
        <div>
          <div style="font-size: 12px; color: #64748b; font-weight: 600;">Customer</div>
          <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${customerName}</div>
          <div style="font-size: 13px; color: #0284c7;"><a href="mailto:${order.email}" style="color: #0284c7; text-decoration: none;">${order.email}</a></div>
          ${shipping.phone ? `<div style="font-size: 13px; color: #475569;">${shipping.phone}</div>` : ""}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; color: #64748b; font-weight: 600;">Payment & Store</div>
          <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${order.paymentMethod?.toUpperCase()} (${order.paymentStatus})</div>
          <div style="font-size: 13px; color: #64748b;">${storeName}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b;">
            <th style="padding: 8px 0; text-align: left;">Item</th>
            <th style="padding: 8px 10px; text-align: center;">Qty</th>
            <th style="padding: 8px 0; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div style="border-top: 2px solid #e2e8f0; padding-top: 14px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 6px;">
          <span>Subtotal:</span>
          <span>${formatCurrency(order.subtotal)}</span>
        </div>
        ${order.discount ? `<div style="display: flex; justify-content: space-between; font-size: 13px; color: #16a34a; margin-bottom: 6px;"><span>Discount:</span><span>-${formatCurrency(order.discount)}</span></div>` : ""}
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 6px;">
          <span>Shipping:</span>
          <span>${order.shippingCost ? formatCurrency(order.shippingCost) : "FREE"}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
          <span>Total:</span>
          <span style="color: #0284c7;">${formatCurrency(order.total)}</span>
        </div>
      </div>

      ${
        shipping.streetAddress
          ? `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 6px;">Shipping Address</div>
        <div style="font-size: 13px; color: #0f172a; line-height: 1.5;">
          ${shipping.streetAddress}<br/>
          ${shipping.city || ""}, ${shipping.state || ""} ${shipping.postalCode || ""}<br/>
          ${shipping.country || "United States"}
        </div>
      </div>`
          : ""
      }

      <div style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 14px;">
        Order alert delivered to ${isPl ? plOrdersEmail : cfg.notifyEmail}
      </div>
    </div>
  </div>`;

  const customerHtml = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
    <div style="background: #0066ff; padding: 24px 32px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 22px; font-weight: 700;">Order Confirmation</h2>
      <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">Thank you for your order #${order.orderNumber}</p>
    </div>
    <div style="padding: 28px 32px;">
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 18px;">Hello ${customerName},</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
        We have received your order on <strong>${storeName}</strong> and our warehouse team is preparing your hardware for inspection and dispatch.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b;">
            <th style="padding: 8px 0; text-align: left;">Item</th>
            <th style="padding: 8px 10px; text-align: center;">Qty</th>
            <th style="padding: 8px 0; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div style="border-top: 2px solid #e2e8f0; padding-top: 14px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 6px;">
          <span>Subtotal:</span>
          <span>${formatCurrency(order.subtotal)}</span>
        </div>
        ${order.discount ? `<div style="display: flex; justify-content: space-between; font-size: 13px; color: #16a34a; margin-bottom: 6px;"><span>Discount:</span><span>-${formatCurrency(order.discount)}</span></div>` : ""}
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 6px;">
          <span>Shipping:</span>
          <span>${order.shippingCost ? formatCurrency(order.shippingCost) : "FREE"}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
          <span>Total:</span>
          <span style="color: #0066ff;">${formatCurrency(order.total)}</span>
        </div>
      </div>

      ${
        shipping.streetAddress
          ? `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 6px;">Shipping Destination</div>
        <div style="font-size: 13px; color: #0f172a; line-height: 1.5;">
          ${shipping.streetAddress}<br/>
          ${shipping.city || ""}, ${shipping.state || ""} ${shipping.postalCode || ""}<br/>
          ${shipping.country || "United States"}
        </div>
      </div>`
          : ""
      }

      <p style="font-size: 14px; color: #475569; margin: 0;">
        If you have any questions regarding your order or shipment tracking, reply directly to this email or reach us at <strong><a href="mailto:${replyToCustomer}" style="color: #0066ff; text-decoration: none;">${replyToCustomer}</a></strong>.
      </p>
    </div>
    <div style="background: #f8fafc; padding: 14px 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      © ${new Date().getFullYear()} ${storeName}. All rights reserved.
    </div>
  </div>`;

  try {
    // 1. Send Alert to Operations / Orders Mailbox
    await transport.sendMail({
      from: `"${storeName} Orders" <${cfg.user}>`,
      to: adminRecipients,
      replyTo: `"${customerName}" <${order.email}>`,
      subject: `📦 [New Order #${order.orderNumber}] ${formatCurrency(order.total)} from ${customerName}`,
      html: adminHtml,
    });

    // 2. Send Receipt to Customer
    await transport.sendMail({
      from: `"${storeName}" <${cfg.user}>`,
      to: order.email,
      replyTo: replyToCustomer,
      subject: `Order Confirmation #${order.orderNumber} - ${storeName}`,
      html: customerHtml,
    });

    console.log(`✅ [Email] Order notifications sent for #${order.orderNumber} to ${order.email} (Routed to: ${Array.isArray(adminRecipients) ? adminRecipients.join(", ") : adminRecipients})`);
    return true;
  } catch (err) {
    console.error(`❌ [Email] Failed to send order notification for #${order.orderNumber}:`, err);
    return false;
  }
}

/**
 * Send Contact Message Alert
 * Power Line Devices:
 * - Quote/RFQ inquiries routed to: RFQ@powerlinedevices.com
 * - Order/General inquiries routed to: info@powerlinedevices.com
 */
export async function sendContactAlert(contact: {
  name: string;
  email: string;
  subject?: string;
  message: string;
  store?: string;
  type?: string;
}) {
  const cfg = getSmtpConfig();
  const transport = getTransporter();
  if (!transport) return false;

  const isPl = isPowerlineStore(contact.store, contact.type);
  const storeName = getStoreTitle(contact.store, contact.type);

  let targetRecipient: string | string[] = cfg.notifyEmail;
  if (isPl) {
    const isRfq = /quote|rfq|bulk|pricing|part|volume/i.test(`${contact.subject || ""} ${contact.message || ""}`);
    const plRfqEmail = process.env.POWERLINE_RFQ_EMAIL || "RFQ@powerlinedevices.com";
    const plOrdersEmail = process.env.POWERLINE_ORDERS_EMAIL || "info@powerlinedevices.com";
    const primary = isRfq ? plRfqEmail : plOrdersEmail;
    targetRecipient = Array.from(new Set([primary, cfg.notifyEmail].filter(Boolean)));
  }

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <div style="background: #0f172a; padding: 20px; color: #ffffff;">
      <h3 style="margin: 0;">New Contact Form Message - ${storeName}</h3>
    </div>
    <div style="padding: 24px;">
      <p><strong>From:</strong> ${contact.name} (<a href="mailto:${contact.email}">${contact.email}</a>)</p>
      ${contact.subject ? `<p><strong>Subject:</strong> ${contact.subject}</p>` : ""}
      <div style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 14px; line-height: 1.6;">
        ${contact.message.replace(/\n/g, "<br>")}
      </div>
      <div style="margin-top: 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px;">
        Routed to: ${Array.isArray(targetRecipient) ? targetRecipient.join(", ") : targetRecipient}
      </div>
    </div>
  </div>`;

  try {
    await transport.sendMail({
      from: `"${storeName} Contact" <${cfg.user}>`,
      to: targetRecipient,
      replyTo: `"${contact.name}" <${contact.email}>`,
      subject: `💬 [Contact Form] ${contact.subject || `Message from ${contact.name}`} - ${storeName}`,
      html,
    });
    console.log(`✅ [Email] Contact message routed to ${Array.isArray(targetRecipient) ? targetRecipient.join(", ") : targetRecipient}`);
    return true;
  } catch (err) {
    console.error("❌ [Email] Failed to send contact message email:", err);
    return false;
  }
}
