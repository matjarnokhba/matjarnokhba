import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const EmailService = {
  // ═══ إرسال استعادة كلمة المرور ═══
  async sendPasswordReset(to: string, name: string, token: string) {
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      console.warn("SMTP credentials missing. Email not sent.");
      return;
    }

    const resetLink = `${siteUrl}/reset-password?token=${token}`;

    try {
      await transporter.sendMail({
        from: `"متجر نخبة" <${process.env.SMTP_EMAIL}>`,
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

  // ═══ إرسال تأكيد البريد الإلكتروني ═══
  async sendVerificationEmail(to: string, name: string, token: string) {
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      console.warn("SMTP credentials missing. Email not sent.");
      return;
    }

    const verifyLink = `${siteUrl}/api/auth/verify-email?token=${token}`;

    try {
      await transporter.sendMail({
        from: `"متجر نخبة" <${process.env.SMTP_EMAIL}>`,
        to,
        subject: "تأكيد البريد الإلكتروني - متجر نخبة",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #ff5c00;">مرحباً ${name}،</h2>
            <p>شكراً لتسجيلك في متجر نخبة. يرجى تأكيد بريدك الإلكتروني بالضغط على الزر أدناه:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyLink}" style="display: inline-block; padding: 12px 24px; background-color: #ff5c00; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">تأكيد البريد الإلكتروني</a>
            </div>
            <p style="font-size: 12px; color: #666;">إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذه الرسالة بأمان.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error("Failed to send verification email:", error);
    }
  },
};