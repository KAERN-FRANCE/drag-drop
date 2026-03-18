import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp0001.neo.space',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM = process.env.EMAIL_FROM || 'TachoCompliance <noreply@tachocompliance.com>'

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[email] SMTP not configured, skipping email to', to)
    return
  }
  try {
    const result = await transporter.sendMail({ from: FROM, to, subject, html })
    console.log('[email] Sent to', to, '- messageId:', result.messageId)
    return result
  } catch (error) {
    console.error('[email] Failed to send to', to, error)
    throw error
  }
}
