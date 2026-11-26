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

function getStoreTitle(store?: string): string {
  const s = (store || "powerline").toLowerCase();
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

  const storeName = getStoreTitle(quote.store || quote.type);
  const quoteId = String(quote.id || quote._id || "N/A");
  const dateStr = new Date(quote.createdAt || Date.now()).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

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
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Part #:</td>
          <td style="padding: 10px 0; color: #0f172a; font-family: monospace; font-size: 15px; font-weight: 700;">${quote.partNumber || "General Inquiry"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Quantity:</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${quote.quantity ?? "N/A"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Target Price:</td>
          <td style="padding: 10px 0; color: #059669; font-weight: 700;">${quote.targetPrice ? formatCurrency(quote.targetPrice) : "Open / Best Offer"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Date:</td>
          <td style="padding: 10px 0; color: #0f172a;">${dateStr}</td>
        </tr>
        ${
          quote.message
            ? `
        <tr>
          <td style="padding: 12px 0 6px; color: #64748b; font-weight: 600;" colspan="2">Notes / Message:</td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 12px; background: #f8fafc; border-radius: 8px; color: #334155; font-size: 13px; line-height: 1.6;">
            ${String(quote.message).replace(/\n/g, "<br>")}
          </td>
        </tr>`
            : ""
        }
      </table>
      
      <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0;">
        <a href="mailto:${quote.email}?subject=RE: Quote Request for ${encodeURIComponent(quote.partNumber || 'Hardware')} - ${encodeURIComponent(storeName)}" 
           style="display: inline-block; background: #0284c7; color: #ffffff; padding: 10px 20px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px;">
          Reply to Customer
        </a>
      </div>
    </div>
    <div style="background: #f8fafc; padding: 14px 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      Quote ID: ${quoteId} • Channel: ${storeName}
    </div>
  </div>`;

  const customerHtml = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
    <div style="background: #0f172a; padding: 24px 32px; color: #ffffff;">
      <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8;">${storeName}</span>
      <h2 style="margin: 6px 0 0; font-size: 22px; font-weight: 700;">We've Received Your Quote Request</h2>
    </div>
    <div style="padding: 28px 32px;">
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 16px;">Dear ${quote.name},</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px;">
        Thank you for contacting <strong>${storeName}</strong>. Our enterprise hardware procurement team has received your Request for Quotation (RFQ) and is reviewing current availability and bulk discount tiers.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">RFQ Summary</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 6px;"><strong>Part #:</strong> ${quote.partNumber || "Hardware inquiry"}</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 6px;"><strong>Requested Quantity:</strong> ${quote.quantity ?? "N/A"}</div>
        ${quote.targetPrice ? `<div style="font-size: 13px; color: #475569; margin-bottom: 6px;"><strong>Target Price:</strong> ${formatCurrency(quote.targetPrice)}</div>` : ""}
      </div>

      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px;">
        A dedicated account manager will be in touch with an official quotation within 1-2 business hours.
      </p>
      <p style="font-size: 14px; color: #475569; margin: 0;">Need immediate assistance? Reply directly to this email.</p>
    </div>
    <div style="background: #f8fafc; padding: 14px 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      © ${new Date().getFullYear()} ${storeName}. All rights reserved.
    </div>
  </div>`;

  try {
    // 1. Send Alert to Admin/Notification Mailbox
    await transport.sendMail({
      from: `"${storeName} RFQ" <${cfg.user}>`,
      to: cfg.notifyEmail,
      replyTo: `"${quote.name}" <${quote.email}>`,
      subject: `🚨 [New Quote / RFQ] ${quote.partNumber ? `${quote.partNumber} (Qty: ${quote.quantity ?? 1})` : "Hardware RFQ"} - ${quote.name}`,
      html: adminHtml,
    });

    // 2. Send Acknowledgment to Customer
    await transport.sendMail({
      from: `"${storeName}" <${cfg.user}>`,
      to: quote.email,
      replyTo: cfg.notifyEmail,
      subject: `We've received your quote request - ${storeName}`,
      html: customerHtml,
    });

    console.log(`✅ [Email] Quote alert dispatched for ${quote.email} (Quote ID: ${quoteId})`);
    return true;
  } catch (err) {
    console.error("❌ [Email] Failed to send quote alert email:", err);
    return false;
  }
}

/**
 * Send Admin Alert & Customer Receipt on New Order
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

  const storeName = getStoreTitle(order.store || order.type);
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
  const addressLine = [
    shipping.address1 || shipping.address,
    shipping.city,
    shipping.state,
    shipping.postalCode || shipping.zip,
    shipping.country,
  ]
    .filter(Boolean)
    .join(", ");

  const adminHtml = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
    <div style="background: #0f172a; padding: 24px 32px; color: #ffffff;">
      <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #10b981;">New Order Placed</span>
      <h2 style="margin: 6px 0 0; font-size: 22px; font-weight: 700;">Order #${order.orderNumber}</h2>
    </div>
    <div style="padding: 28px 32px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
        <div>
          <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700;">Customer</div>
          <div style="font-size: 15px; font-weight: 600; color: #0f172a;">${customerName}</div>
          <div style="font-size: 13px; color: #0284c7;"><a href="mailto:${order.email}" style="color: #0284c7; text-decoration: none;">${order.email}</a></div>
          ${shipping.phone ? `<div style="font-size: 13px; color: #475569;">${shipping.phone}</div>` : ""}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700;">Store Channel</div>
          <div style="font-size: 15px; font-weight: 600; color: #0f172a;">${storeName}</div>
          <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Payment: ${order.paymentMethod} (${order.paymentStatus})</div>
        </div>
      </div>

      ${
        addressLine
          ? `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
        <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">Shipping Destination</div>
        <div style="font-size: 13px; color: #334155;">${addressLine}</div>
      </div>`
          : ""
      }

      <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Purchased Items</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px; text-transform: uppercase; color: #64748b;">
            <th style="text-align: left; padding: 8px 0;">Item</th>
            <th style="text-align: center; padding: 8px 10px;">Qty</th>
            <th style="text-align: right; padding: 8px 0;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Subtotal:</td>
          <td style="padding: 6px 0; text-align: right; color: #0f172a; font-weight: 600;">${formatCurrency(order.subtotal)}</td>
        </tr>
        ${order.discount ? `<tr><td style="padding: 6px 0; color: #64748b;">Discount:</td><td style="padding: 6px 0; text-align: right; color: #dc2626;">-${formatCurrency(order.discount)}</td></tr>` : ""}
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Shipping:</td>
          <td style="padding: 6px 0; text-align: right; color: #0f172a;">${order.shippingCost ? formatCurrency(order.shippingCost) : "Free"}</td>
        </tr>
        ${order.tax ? `<tr><td style="padding: 6px 0; color: #64748b;">Tax:</td><td style="padding: 6px 0; text-align: right; color: #0f172a;">${formatCurrency(order.tax)}</td></tr>` : ""}
        <tr style="border-top: 2px solid #0f172a;">
          <td style="padding: 10px 0; color: #0f172a; font-weight: 700; font-size: 16px;">Total:</td>
          <td style="padding: 10px 0; text-align: right; color: #059669; font-weight: 700; font-size: 18px;">${formatCurrency(order.total)}</td>
        </tr>
      </table>
    </div>
    <div style="background: #f8fafc; padding: 14px 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      Order #${order.orderNumber} • ${storeName}
    </div>
  </div>`;

  const customerHtml = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
    <div style="background: #0f172a; padding: 24px 32px; color: #ffffff;">
      <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8;">${storeName}</span>
      <h2 style="margin: 6px 0 0; font-size: 22px; font-weight: 700;">Order Confirmation #${order.orderNumber}</h2>
    </div>
    <div style="padding: 28px 32px;">
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 16px;">Dear ${customerName},</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
        Thank you for your order with <strong>${storeName}</strong>! Your order has been placed successfully and our fulfillment team is preparing your package.
      </p>

      <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Order Summary</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px; text-transform: uppercase; color: #64748b;">
            <th style="text-align: left; padding: 8px 0;">Item</th>
            <th style="text-align: center; padding: 8px 10px;">Qty</th>
            <th style="text-align: right; padding: 8px 0;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Subtotal:</td>
          <td style="padding: 6px 0; text-align: right; color: #0f172a; font-weight: 600;">${formatCurrency(order.subtotal)}</td>
        </tr>
        ${order.discount ? `<tr><td style="padding: 6px 0; color: #64748b;">Discount:</td><td style="padding: 6px 0; text-align: right; color: #dc2626;">-${formatCurrency(order.discount)}</td></tr>` : ""}
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Shipping:</td>
          <td style="padding: 6px 0; text-align: right; color: #0f172a;">${order.shippingCost ? formatCurrency(order.shippingCost) : "Free"}</td>
        </tr>
        ${order.tax ? `<tr><td style="padding: 6px 0; color: #64748b;">Tax:</td><td style="padding: 6px 0; text-align: right; color: #0f172a;">${formatCurrency(order.tax)}</td></tr>` : ""}
        <tr style="border-top: 2px solid #0f172a;">
          <td style="padding: 10px 0; color: #0f172a; font-weight: 700; font-size: 16px;">Total Paid:</td>
          <td style="padding: 10px 0; text-align: right; color: #059669; font-weight: 700; font-size: 18px;">${formatCurrency(order.total)}</td>
        </tr>
      </table>

      ${
        addressLine
          ? `
      <div style="margin-top: 24px; padding: 14px 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">Delivering To</div>
        <div style="font-size: 13px; color: #334155;">${customerName}</div>
        <div style="font-size: 13px; color: #334155;">${addressLine}</div>
      </div>`
          : ""
      }
    </div>
    <div style="background: #f8fafc; padding: 14px 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      © ${new Date().getFullYear()} ${storeName}. If you have any questions, reply to this email.
    </div>
  </div>`;

  try {
    // 1. Send Alert to Operations/Admin
    await transport.sendMail({
      from: `"${storeName} Orders" <${cfg.user}>`,
      to: cfg.notifyEmail,
      replyTo: `"${customerName}" <${order.email}>`,
      subject: `📦 [New Order #${order.orderNumber}] ${formatCurrency(order.total)} from ${customerName}`,
      html: adminHtml,
    });

    // 2. Send Receipt to Customer
    await transport.sendMail({
      from: `"${storeName}" <${cfg.user}>`,
      to: order.email,
      replyTo: cfg.notifyEmail,
      subject: `Order Confirmation #${order.orderNumber} - ${storeName}`,
      html: customerHtml,
    });

    console.log(`✅ [Email] Order notifications sent for #${order.orderNumber} to ${order.email} and ${cfg.notifyEmail}`);
    return true;
  } catch (err) {
    console.error(`❌ [Email] Failed to send order notification for #${order.orderNumber}:`, err);
    return false;
  }
}

/**
 * Send Contact Message Alert to Admin
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

  const storeName = getStoreTitle(contact.store || contact.type);
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
    </div>
  </div>`;

  try {
    await transport.sendMail({
      from: `"${storeName} Contact" <${cfg.user}>`,
      to: cfg.notifyEmail,
      replyTo: `"${contact.name}" <${contact.email}>`,
      subject: `💬 [Contact Form] ${contact.subject || `Message from ${contact.name}`} - ${storeName}`,
      html,
    });
    return true;
  } catch (err) {
    console.error("❌ [Email] Failed to send contact message email:", err);
    return false;
  }
}
