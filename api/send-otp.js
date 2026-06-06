// api/send-otp.js
// Vercel Serverless Function — OTP Email Sender
// Uses Nodemailer with Gmail SMTP

const nodemailer = require('nodemailer');

// In-memory OTP store (use Redis/Supabase for production)
// Since Vercel is stateless, store OTP in Supabase or use a simple KV store
// For now we use a signed token approach

const crypto = require('crypto');

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

function hashOTP(otp, email, timestamp) {
  const secret = process.env.OTP_SECRET || 'cryptox-secret-key';
  return crypto
    .createHmac('sha256', secret)
    .update(`${otp}:${email}:${timestamp}`)
    .digest('hex');
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Generate OTP
  const otp = generateOTP();
  const timestamp = Date.now();
  const hash = hashOTP(otp, email, timestamp);

  // Setup Gmail transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,       // your Gmail: e.g. cryptoxapp@gmail.com
      pass: process.env.EMAIL_APP_PASS,   // Gmail App Password (not regular password)
    },
  });

  // Email HTML template
  const emailHTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CryptoX — Password Reset</title>
  </head>
  <body style="margin:0;padding:0;background:#000000;font-family:'Inter',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 20px;">
      <tr>
        <td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;max-width:520px;width:100%;">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#1a0a00,#0d0d0d);padding:32px 40px;text-align:center;border-bottom:1px solid rgba(255,92,0,0.2);">
                <div style="font-size:28px;font-weight:900;color:#ffb59a;letter-spacing:-0.04em;">CryptoX</div>
                <div style="font-size:11px;color:rgba(228,190,177,0.4);text-transform:uppercase;letter-spacing:0.12em;margin-top:4px;">Pro Crypto Trading</div>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:40px;">
                <h2 style="color:#e5e2e1;font-size:22px;font-weight:700;margin:0 0 8px;">Password Reset Request</h2>
                <p style="color:rgba(228,190,177,0.6);font-size:14px;line-height:1.6;margin:0 0 32px;">We received a request to reset your CryptoX account password. Use the verification code below to continue.</p>

                <!-- OTP Box -->
                <div style="background:rgba(255,92,0,0.08);border:1px solid rgba(255,92,0,0.3);border-radius:12px;padding:28px;text-align:center;margin-bottom:32px;">
                  <div style="font-size:11px;color:rgba(228,190,177,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">Your Verification Code</div>
                  <div style="font-size:48px;font-weight:900;color:#ff5c00;letter-spacing:0.15em;font-family:'Courier New',monospace;">${otp}</div>
                  <div style="font-size:12px;color:rgba(228,190,177,0.4);margin-top:12px;">⏱ Expires in <strong style="color:#ffb59a;">10 minutes</strong></div>
                </div>

                <!-- Warning -->
                <div style="background:rgba(147,0,10,0.1);border:1px solid rgba(255,180,171,0.2);border-radius:8px;padding:14px 16px;margin-bottom:24px;">
                  <p style="color:#ffb4ab;font-size:13px;margin:0;line-height:1.5;">
                    ⚠️ <strong>Never share this code.</strong> CryptoX will never ask for your OTP via phone or chat. If you didn't request this, ignore this email.
                  </p>
                </div>

                <p style="color:rgba(228,190,177,0.4);font-size:12px;line-height:1.6;margin:0;">
                  This code is valid for one-time use only. After 10 minutes, you'll need to request a new code.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background:#0a0a0a;padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
                <p style="color:rgba(228,190,177,0.3);font-size:11px;margin:0;">© 2025 CryptoX. All Rights Reserved.</p>
                <p style="color:rgba(228,190,177,0.2);font-size:10px;margin:6px 0 0;">This is an automated security email. Please do not reply.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  try {
    await transporter.sendMail({
      from: `"CryptoX Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `${otp} — Your CryptoX Password Reset Code`,
      html: emailHTML,
    });

    // Return hash + timestamp so frontend can verify later
    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      token: hash,
      timestamp: timestamp,
      // OTP expires in 10 minutes
      expiresAt: timestamp + 10 * 60 * 1000,
    });

  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({
      error: 'Failed to send email. Please try again.',
    });
  }
}
