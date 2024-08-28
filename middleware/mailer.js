const nodemailer = require("nodemailer");
const fs = require("fs");
const ejs = require("ejs");
const path = require("path");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports like 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendVerificationEmail = async (email, code, username) => {
  try {
    const templatePath = path.join(__dirname, "../emails", "invite_reg.html");

    // Read the HTML file
    let htmlTemplate = fs.readFileSync(templatePath, "utf-8");

    // Replace placeholders with actual values
    htmlTemplate = htmlTemplate.replace("[username]", username);
    htmlTemplate = htmlTemplate.replace("[code]", code);

    // Use EJS to inject dynamic values into the template
    const htmlContent = ejs.render(htmlTemplate, {
      username: username, // Replace with the dynamic username
      code: code, // Replace with the dynamic verification code
    });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: "Email Verification Code",
      html: htmlContent, // Use the rendered HTML as the email content
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error };
  }
};

const sendPasswordResetEmail = async (email, code) => {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: "Password reset Code",
    text: `Your reset password code is ${code}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error };
  }
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
