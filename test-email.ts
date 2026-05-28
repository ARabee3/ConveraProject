import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 2525;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'noreply@example.com';

  if (!host || !user || !pass) {
    console.error('Missing SMTP credentials. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
    process.exit(1);
  }

  console.log(`Connecting to ${host}:${port} as ${user}...`);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: `"Convera Test" <${from}>`,
    to: 'test@example.com',
    subject: 'Convera Email Test',
    html: '<h1>Hello from Convera!</h1><p>If you see this, email delivery is working.</p>',
  });

  console.log('Message sent:', info.messageId);

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('Preview URL:', previewUrl);
  }

  console.log('Email sent successfully!');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
