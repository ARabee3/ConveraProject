import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.SMTP_FROM || 'noreply@example.com';

  if (!apiKey) {
    console.error('Missing BREVO_API_KEY in .env');
    process.exit(1);
  }

  console.log(`Sending via Brevo API from ${from}...`);

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: from },
      to: [{ email: 'arabeea7104@gmail.com' }],
      subject: 'Convera Email Test',
      htmlContent: '<h1>Hello from Convera!</h1><p>If you see this, Brevo email delivery is working.</p>',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Brevo API error ${response.status}: ${errorBody}`);
    process.exit(1);
  }

  const data = await response.json();
  console.log('Message sent:', data.messageId);
  console.log('Email sent successfully!');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
