// api/verify-otp.js
// Vercel Serverless Function — OTP Verifier

const crypto = require('crypto');

function hashOTP(otp, email, timestamp) {
  const secret = process.env.OTP_SECRET || 'cryptox-secret-key';
  return crypto
    .createHmac('sha256', secret)
    .update(`${otp}:${email}:${timestamp}`)
    .digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, otp, token, timestamp } = req.body;

  if (!email || !otp || !token || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check expiry (10 minutes)
  const now = Date.now();
  if (now - parseInt(timestamp) > 10 * 60 * 1000) {
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  // Verify hash
  const expectedHash = hashOTP(otp, email, timestamp);
  const isValid = crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expectedHash)
  );

  if (!isValid) {
    return res.status(400).json({ error: 'Invalid OTP. Please check and try again.' });
  }

  // Generate a short-lived reset token for the next step
  const resetToken = crypto
    .createHmac('sha256', process.env.OTP_SECRET || 'cryptox-secret-key')
    .update(`reset:${email}:${now}`)
    .digest('hex');

  return res.status(200).json({
    success: true,
    message: 'OTP verified successfully',
    resetToken: resetToken,
    resetTimestamp: now,
  });
}
