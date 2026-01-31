/**
 * Email Service
 * Handles sending emails using nodemailer
 * 
 * Required environment variables:
 * - SMTP_HOST: SMTP server hostname (e.g., smtp.gmail.com)
 * - SMTP_PORT: SMTP server port (e.g., 587)
 * - SMTP_USER: SMTP username/email
 * - SMTP_PASS: SMTP password (for Gmail, use App Password)
 * - SMTP_FROM: Sender email address and name
 * 
 * Example Gmail setup:
 * 1. Enable 2FA on your Google account
 * 2. Generate an App Password: Google Account > Security > App Passwords
 * 3. Use that App Password as SMTP_PASS
 */

const nodemailer = require('nodemailer');

// Check if email is configured
const isEmailConfigured = () => {
    return !!(
        process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS
    );
};

// Create transporter
const createTransporter = () => {
    if (!isEmailConfigured()) {
        throw new Error('Email service not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS environment variables.');
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number.parseInt(process.env.SMTP_PORT, 10),
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

/**
 * Send password reset email
 * @param {string} toEmail - Recipient email address
 * @param {string} resetUrl - Password reset URL with token
 */
const sendPasswordResetEmail = async (toEmail, resetUrl) => {
    const transporter = createTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

    const mailOptions = {
        from: fromAddress,
        to: toEmail,
        subject: 'Password Reset Request - Thoughty',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">Password Reset Request</h2>
                <p style="color: #666; font-size: 16px;">
                    You requested to reset your password for your Thoughty account.
                </p>
                <p style="color: #666; font-size: 16px;">
                    Click the button below to reset your password. This link will expire in 1 hour.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" 
                       style="background-color: #6366f1; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 6px; font-size: 16px;">
                        Reset Password
                    </a>
                </div>
                <p style="color: #999; font-size: 14px;">
                    If you didn't request this, please ignore this email. Your password will remain unchanged.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="${resetUrl}" style="color: #6366f1;">${resetUrl}</a>
                </p>
            </div>
        `,
        text: `
            Password Reset Request - Thoughty
            
            You requested to reset your password for your Thoughty account.
            
            Click the link below to reset your password. This link will expire in 1 hour.
            
            ${resetUrl}
            
            If you didn't request this, please ignore this email. Your password will remain unchanged.
        `
    };

    await transporter.sendMail(mailOptions);
};

/**
 * Send account deletion notification email
 * @param {string} toEmail - Recipient email address
 */
const sendAccountDeletionEmail = async (toEmail) => {
    const transporter = createTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

    const mailOptions = {
        from: fromAddress,
        to: toEmail,
        subject: 'Account Deleted - Thoughty',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">Account Deletion Confirmation</h2>
                <p style="color: #666; font-size: 16px;">
                    Your Thoughty account has been successfully deleted as per your request.
                </p>
                <p style="color: #666; font-size: 16px;">
                    You will no longer be able to access your account or any associated data.
                </p>
                <p style="color: #666; font-size: 16px;">
                    If you did not request this deletion, or if you believe this was done in error, 
                    please contact our support team immediately.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 14px;">
                    We're sorry to see you go. Thank you for using Thoughty.
                </p>
            </div>
        `,
        text: `
            Account Deletion Confirmation - Thoughty
            
            Your Thoughty account has been successfully deleted as per your request.
            
            You will no longer be able to access your account or any associated data.
            
            If you did not request this deletion, or if you believe this was done in error, 
            please contact our support team immediately.
            
            We're sorry to see you go. Thank you for using Thoughty.
        `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = {
    isEmailConfigured,
    sendPasswordResetEmail,
    sendAccountDeletionEmail
};
