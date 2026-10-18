import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.EMAIL_FROM || "onboarding@resend.dev";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const EmailService = {
  async sendPasswordReset(to: string, name: string, token: string) {
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is not set. Email not sent.");
      return;
    }

    const resetLink = `${siteUrl}/reset-password?token=${token}`;

    try {
      await resend.emails.send({
        from: `متجر نخبة <${fromEmail}>`,
        to,
        subject: "استعادة كلمة المرور - متجر نخبة",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #ff5c00;">مرحباً ${name}،</h2>
            <p>لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في متجر نخبة.</p>
            <p>اضغط على الزر أدناه لإعادة التعيين:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #ff5c00; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">استعادة كلمة المرور</a>
            </div>
            <p style="font-size: 12px; color: #666;">إذا لم تطلب هذا، يمكنك تجاهل هذه الرسالة بأمان. الرابط صالح لمدة ساعة واحدة فقط.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error("Failed to send password reset email:", error);
    }
  },
};