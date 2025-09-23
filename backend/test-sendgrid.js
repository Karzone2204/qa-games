import { sendMail } from './src/services/mailer.js';
import dotenv from 'dotenv';

dotenv.config();

async function testSendGridEmail() {
  console.log('🧪 Testing SendGrid email functionality...');
  
  try {
    const result = await sendMail({
      to: 'test@example.com',
      subject: 'QA Games - SendGrid Test',
      text: 'This is a test email sent via SendGrid from the QA Games app.',
      html: '<h2>QA Games - SendGrid Test</h2><p>This is a test email sent via SendGrid from the QA Games app.</p><p>✅ Email system is working!</p>'
    });

    console.log('📧 Email test result:', result);
    
    if (result.provider === 'sendgrid') {
      console.log('✅ SendGrid email sent successfully!');
    } else if (result.provider === 'console') {
      console.log('⚠️  SendGrid not configured, fell back to console output');
    } else {
      console.log('❌ Unexpected result:', result);
    }
  } catch (error) {
    console.error('❌ Email test failed:', error);
  }
}

testSendGridEmail();