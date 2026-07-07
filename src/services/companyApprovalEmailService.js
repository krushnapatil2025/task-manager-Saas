/**
 * companyApprovalEmailService.js
 * Professional branded transactional emails for the Company Registration Approval workflow.
 *
 * Uses strict table-based styling and fallback colors for universal email client compatibility.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared HTML shell — dark enterprise theme (perfect table layout)
// ─────────────────────────────────────────────────────────────────────────────
const shell = (content) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; }
  img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  table { border-collapse: collapse !important; }
  body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d17;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0b0d17;padding:48px 16px;">
  <tr>
    <td align="center" valign="top">
      <!-- Card Container -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;border-radius:20px;overflow:hidden;background-color:#13152b;border:1px solid #23253d;">
        ${content}
        <!-- Footer -->
        <tr>
          <td style="background-color:#0b0d17;border-top:1px solid #1f213a;padding:32px;text-align:center;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom:12px;">
                  <span style="color:#6366f1;font-size:18px;font-weight:900;letter-spacing:-0.5px;">Strideo</span>
                  <span style="color:#475569;font-size:12px;margin-left:8px;font-weight:600;">by CICD Tech</span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <p style="margin:0;color:#475569;font-size:11px;line-height:1.6;font-weight:500;">
                    © ${new Date().getFullYear()} Strideo. All rights reserved.<br/>
                    Built by <a href="https://www.cicdtech.in/" target="_blank" rel="noopener noreferrer" style="color:#4f46e5;text-decoration:none;font-weight:700;">CICD Tech</a>
                    &nbsp;·&nbsp;
                    <a href="mailto:support@strideo.app" style="color:#4f46e5;text-decoration:none;font-weight:700;">support@strideo.app</a>
                  </p>
                  <p style="margin:12px 0 0 0;color:#1e293b;font-size:10px;font-weight:500;">
                    This is an automated system notification. Please do not reply directly.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// Shared header banner (Solid background fallback for full compatibility)
// ─────────────────────────────────────────────────────────────────────────────
const header = ({ bannerColor, emoji, title, subtitle }) => `
<tr>
  <td style="background-color:${bannerColor};padding:44px 32px 36px;text-align:center;">
    <table border="0" align="center" cellpadding="0" cellspacing="0" style="background-color:rgba(255,255,255,0.15);border-radius:16px;width:64px;height:64px;margin:0 auto 20px auto;text-align:center;">
      <tr>
        <td align="center" valign="middle" style="font-size:32px;line-height:64px;height:64px;width:64px;text-align:center;">
          ${emoji}
        </td>
      </tr>
    </table>
    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:900;letter-spacing:-0.5px;line-height:1.2;text-align:center;">
      ${title}
    </h1>
    <p style="margin:8px 0 0 0;color:#e2e8f0;font-size:13px;line-height:1.4;text-align:center;font-weight:500;">
      ${subtitle}
    </p>
  </td>
</tr>`;

// ─────────────────────────────────────────────────────────────────────────────
// Company details card (Perfect table layout, solid backgrounds)
// ─────────────────────────────────────────────────────────────────────────────
const companyCard = ({ companyName, adminName, industry, size, email, phone, workspaceSlug }) => `
<table border="0" width="100%" cellpadding="0" cellspacing="0"
       style="background-color:#1c1e36;border:1px solid #2a2d4e;
              border-radius:12px;margin-bottom:24px;border-collapse:collapse;">
  <tr>
    <td style="padding:12px 16px;color:#818cf8;font-size:11px;font-weight:700;
               text-transform:uppercase;letter-spacing:0.06em;width:40%;border-bottom:1px solid #2a2d4e;">Company</td>
    <td style="padding:12px 16px;color:#f1f5f9;font-size:13px;font-weight:700;text-align:right;border-bottom:1px solid #2a2d4e;">${companyName}</td>
  </tr>
  ${adminName ? `
  <tr>
    <td style="padding:12px 16px;color:#818cf8;font-size:11px;font-weight:700;
               text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #2a2d4e;">Admin</td>
    <td style="padding:12px 16px;color:#e2e8f0;font-size:13px;text-align:right;border-bottom:1px solid #2a2d4e;">${adminName}</td>
  </tr>` : ''}
  ${email ? `
  <tr>
    <td style="padding:12px 16px;color:#818cf8;font-size:11px;font-weight:700;
               text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #2a2d4e;">Email</td>
    <td style="padding:12px 16px;color:#e2e8f0;font-size:13px;text-align:right;border-bottom:1px solid #2a2d4e;">${email}</td>
  </tr>` : ''}
  ${phone ? `
  <tr>
    <td style="padding:12px 16px;color:#818cf8;font-size:11px;font-weight:700;
               text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #2a2d4e;">Phone</td>
    <td style="padding:12px 16px;color:#e2e8f0;font-size:13px;text-align:right;border-bottom:1px solid #2a2d4e;">${phone}</td>
  </tr>` : ''}
  ${industry ? `
  <tr>
    <td style="padding:12px 16px;color:#818cf8;font-size:11px;font-weight:700;
               text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #2a2d4e;">Industry</td>
    <td style="padding:12px 16px;color:#e2e8f0;font-size:13px;text-align:right;border-bottom:1px solid #2a2d4e;">${industry}</td>
  </tr>` : ''}
  ${size ? `
  <tr>
    <td style="padding:12px 16px;color:#818cf8;font-size:11px;font-weight:700;
               text-transform:uppercase;letter-spacing:0.06em;${workspaceSlug ? 'border-bottom:1px solid #2a2d4e;' : ''}">Team Size</td>
    <td style="padding:12px 16px;color:#e2e8f0;font-size:13px;text-align:right;${workspaceSlug ? 'border-bottom:1px solid #2a2d4e;' : ''}">${size} employees</td>
  </tr>` : ''}
  ${workspaceSlug ? `
  <tr>
    <td style="padding:12px 16px;color:#818cf8;font-size:11px;font-weight:700;
               text-transform:uppercase;letter-spacing:0.06em;">Platform ID</td>
    <td style="padding:12px 16px;color:#64748b;font-size:11px;font-family:monospace;text-align:right;">${workspaceSlug}</td>
  </tr>` : ''}
</table>`;

// ─────────────────────────────────────────────────────────────────────────────
// CTA Button (Centered, solid, no flexbox)
// ─────────────────────────────────────────────────────────────────────────────
const ctaButton = ({ href, label, color }) => `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0;text-align:center;">
  <tr>
    <td align="center">
      <a href="${href}" target="_blank" rel="noopener noreferrer"
         style="display:inline-block;background-color:${color};color:#ffffff;
                font-size:14px;font-weight:800;text-decoration:none;
                padding:14px 40px;border-radius:12px;letter-spacing:0.02em;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;

// ─────────────────────────────────────────────────────────────────────────────
// Reason / note box
// ─────────────────────────────────────────────────────────────────────────────
const reasonBox = ({ title, reason, color }) => reason ? `
<table border="0" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-left:4px solid ${color};background-color:#1e1a26;border-radius:0 8px 8px 0;">
  <tr>
    <td style="padding:16px 20px;text-align:left;">
      <p style="margin:0 0 6px 0;color:${color};font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;line-height:1.2;">
        ${title}
      </p>
      <p style="margin:0;color:#cbd5e1;font-size:13px;line-height:1.6;font-style:italic;font-weight:500;">
        "${reason}"
      </p>
    </td>
  </tr>
</table>` : '';

// ─────────────────────────────────────────────────────────────────────────────
// Divider
// ─────────────────────────────────────────────────────────────────────────────
const divider = () => `
<table border="0" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 16px 0;">
  <tr>
    <td style="border-top:1px solid #1f213a;height:1px;line-height:1px;font-size:1px;">&nbsp;</td>
  </tr>
</table>`;

// ─────────────────────────────────────────────────────────────────────────────
// Table-based numbered list for absolute alignment
// ─────────────────────────────────────────────────────────────────────────────
const steps = (items, accentColor) => `
<table border="0" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
  ${items.map((text, i) => `
  <tr>
    <td valign="top" style="padding-bottom:12px;width:28px;">
      <table border="0" cellpadding="0" cellspacing="0" style="background-color:${accentColor};border-radius:12px;width:24px;height:24px;text-align:center;">
        <tr>
          <td align="center" valign="middle" style="color:#ffffff;font-size:11px;font-weight:950;line-height:24px;height:24px;width:24px;text-align:center;">
            ${i + 1}
          </td>
        </tr>
      </table>
    </td>
    <td valign="top" style="padding-bottom:12px;color:#94a3b8;font-size:13px;line-height:1.6;padding-left:12px;text-align:left;font-weight:500;">
      ${text}
    </td>
  </tr>`).join('')}
</table>`;

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 1 — Registration Received
// ─────────────────────────────────────────────────────────────────────────────
export const buildRegistrationReceivedEmail = ({
  companyName,
  adminName,
  industry,
  size,
  email,
  appUrl,
}) => {
  return shell(`
    ${header({
      bannerColor:  '#4f46e5',
      emoji:        '🏢',
      title:        'Registration Received',
      subtitle:     'We are reviewing your workspace application',
    })}

    <tr>
      <td style="padding:32px;text-align:left;">
        <p style="color:#e2e8f0;font-size:16px;margin:0 0 10px 0;font-weight:700;">
          Welcome, ${adminName || 'there'}! 👋
        </p>
        <p style="color:#94a3b8;font-size:14px;line-height:1.75;margin:0 0 24px 0;font-weight:500;">
          Thank you for registering <strong style="color:#ffffff;">${companyName}</strong>. Your workspace is currently in our verification queue. Our administrators will review the details within 1–2 business days.
        </p>

        ${companyCard({ companyName, adminName, industry, size, email })}

        <table border="0" width="100%" cellpadding="0" cellspacing="0"
               style="background-color:#161932;border:1px solid #232a5c;border-radius:12px;margin-bottom:24px;">
          <tr>
            <td style="padding:20px;text-align:left;">
              <p style="margin:0 0 14px 0;color:#818cf8;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;line-height:1.2;">
                ⏳ What happens next?
              </p>
              ${steps([
                'Our platform administrator will review and verify your organizational details.',
                'You will receive a notification email as soon as a decision is made.',
                'Upon approval, full platform setup will be unlocked for your workspace.',
                'Need help? Contact our verification team anytime at <a href="mailto:support@strideo.app" style="color:#818cf8;text-decoration:none;font-weight:700;">support@strideo.app</a>.',
              ], '#4f46e5')}
            </td>
          </tr>
        </table>

        ${divider()}

        <p style="color:#475569;font-size:11px;text-align:center;margin:8px 0 0 0;line-height:1.6;font-weight:500;">
          If you did not initiate this registration request, please ignore or report to security.
        </p>
      </td>
    </tr>
  `);
};

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 2 — Approval Decisions
// ─────────────────────────────────────────────────────────────────────────────
const DECISION_CONFIG = {
  approved: {
    subject:       (c) => `🎉 Your ${c} workspace is approved!`,
    bannerColor:   '#059669',
    emoji:         '✅',
    title:         'Workspace Approved!',
    subtitle:      'Your company workspace is active and ready to go',
    accentColor:   '#10b981',
    description:   (c) => `Great news! Your company workspace <strong style="color:#ffffff;">${c}</strong> has been reviewed and <strong style="color:#10b981;">approved</strong> by our team. All features are now unlocked.`,
    reasonTitle:   null,
    ctaLabel:      'Access Your Dashboard →',
    ctaColor:      '#10b981',
    nextSteps: [
      'Log in with your registered email and credentials.',
      'Go to workspace settings and customize your brand colors.',
      'Invite employees and assign administrative roles.',
      'Create your team task boards and begin collaborating.',
    ],
  },
  rejected: {
    subject:       (c) => `Update on your ${c} workspace registration`,
    bannerColor:   '#dc2626',
    emoji:         '❌',
    title:         'Application Declined',
    subtitle:      'We were unable to approve your registration request',
    accentColor:   '#ef4444',
    description:   (c) => `We have completed the verification check for <strong style="color:#ffffff;">${c}</strong>. Regrettably, your request has been declined at this time. Please see the detail below.`,
    reasonTitle:   'Reason for decision:',
    ctaLabel:      'Email Verification Support',
    ctaColor:      '#312e81',
    nextSteps: [
      'Check the decision explanation provided above.',
      'Ensure your organization information matches public registers.',
      'Contact our team to submit supplementary details.',
      'Submit a new request or email <a href="mailto:support@strideo.app" style="color:#94a3b8;text-decoration:none;font-weight:700;">support@strideo.app</a>.',
    ],
  },
  restricted: {
    subject:       (c) => `⚠️ Notice: Your ${c} workspace has been restricted`,
    bannerColor:   '#d97706',
    emoji:         '🔒',
    title:         'Workspace Restricted',
    subtitle:      'Platform access has been suspended',
    accentColor:   '#f59e0b',
    description:   (c) => `Please be advised that your workspace <strong style="color:#ffffff;">${c}</strong> has been placed in <strong style="color:#f59e0b;">restricted mode</strong> by platform admins. Access is blocked.`,
    reasonTitle:   'Reason for restriction:',
    ctaLabel:      'Contact Admin Support',
    ctaColor:      '#b45309',
    nextSteps: [
      'Review the compliance note listed above.',
      'Contact our support department immediately.',
      'Provide requested identity or security confirmations.',
    ],
  },
};

export const buildApprovalDecisionEmail = ({
  companyName,
  adminName,
  industry,
  size,
  email,
  phone,
  workspaceSlug,
  status,
  reason,
  appUrl,
}) => {
  const cfg = DECISION_CONFIG[status] || DECISION_CONFIG.rejected;
  const loginUrl   = `${appUrl || 'https://app.strideo.com'}/login`;
  const supportUrl = `mailto:support@strideo.app?subject=Workspace%20Verification%20Support:%20${encodeURIComponent(companyName)}`;
  const ctaHref    = status === 'approved' ? loginUrl : supportUrl;

  return shell(`
    ${header({
      bannerColor:  cfg.bannerColor,
      emoji:        cfg.emoji,
      title:        cfg.title,
      subtitle:     cfg.subtitle,
    })}

    <tr>
      <td style="padding:32px;text-align:left;">
        <p style="color:#e2e8f0;font-size:15px;margin:0 0 10px 0;font-weight:700;">
          Hi ${adminName || 'Administrator'},
        </p>
        <p style="color:#94a3b8;font-size:14px;line-height:1.75;margin:0 0 24px 0;font-weight:500;">
          ${cfg.description(companyName)}
        </p>

        ${companyCard({ companyName, adminName, industry, size, phone, workspaceSlug })}

        ${reason ? reasonBox({ title: cfg.reasonTitle, reason, color: cfg.accentColor }) : ''}

        ${ctaButton({
          href:  ctaHref,
          label: cfg.ctaLabel,
          color: cfg.ctaColor,
        })}

        ${divider()}

        <p style="margin:0 0 14px 0;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;line-height:1.2;">
          ${status === 'approved' ? '🚀 Getting Started Checklist' : '📋 Recommended actions'}
        </p>
        ${steps(cfg.nextSteps, cfg.accentColor)}

        ${divider()}

        <p style="color:#475569;font-size:11px;text-align:center;margin:8px 0 0 0;line-height:1.6;font-weight:500;">
          Reference ID: <span style="color:#6366f1;font-weight:700;">${workspaceSlug || companyName}</span> &nbsp;·&nbsp; Status: <span style="color:${cfg.accentColor};font-weight:700;text-transform:uppercase;">${status}</span>
        </p>
      </td>
    </tr>
  `);
};

// ─────────────────────────────────────────────────────────────────────────────
// Core Brevo API Call Helper
// ─────────────────────────────────────────────────────────────────────────────
const sendViaBrevo = async ({ toEmail, toName, subject, htmlContent, tags = [] }) => {
  const apiKey      = import.meta.env.VITE_BREVO_API_KEY;
  const senderEmail = import.meta.env.VITE_SENDER_EMAIL || 'noreply@strideo.app';
  const senderName  = import.meta.env.VITE_SENDER_NAME  || 'Strideo';

  if (!apiKey) {
    console.warn('VITE_BREVO_API_KEY not configured in .env. Skipping email delivery.');
    return false;
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method:  'POST',
      headers: {
        'api-key':      apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender:      { name: senderName, email: senderEmail },
        to:          [{ email: toEmail, name: toName || toEmail }],
        subject,
        htmlContent,
        tags,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Brevo API request failed:', errText);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to dispatch transactional email via Brevo:', err);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export const sendRegistrationReceivedEmail = async ({
  toEmail, toName, companyName, adminName, industry, size, appUrl,
}) => {
  const htmlContent = buildRegistrationReceivedEmail({
    companyName, adminName, industry, size, email: toEmail, appUrl,
  });
  return sendViaBrevo({
    toEmail,
    toName:      toName || adminName,
    subject:     `✅ Workspace registration received: ${companyName}`,
    htmlContent,
    tags:        ['company-registration', 'registration-received'],
  });
};

export const sendApprovalEmail = async ({
  toEmail, toName, companyName, adminName, industry, size,
  phone, workspaceSlug,
  status, reason, appUrl,
}) => {
  const cfg = DECISION_CONFIG[status];
  if (!cfg) {
    console.error('sendApprovalEmail: Invalid approval status value', status);
    return false;
  }
  const htmlContent = buildApprovalDecisionEmail({
    companyName, adminName, industry, size, phone, workspaceSlug, status, reason, appUrl,
  });
  return sendViaBrevo({
    toEmail,
    toName:      toName || adminName,
    subject:     cfg.subject(companyName),
    htmlContent,
    tags:        ['company-approval', `status-${status}`],
  });
};
