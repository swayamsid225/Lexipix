import { Verification_Email_Template, Welcome_Email_Template } from "../utils/EmailTempletes.js";
import { transporter } from "./EmailConfig.js";



export const SendVerificationCode = async (email,verificationCode) => {
    try {
        const response = await transporter.sendMail({
                    from: `"✏️LexiPix ✨" <${process.env.USER_EMAIL}>`, // sender address
                    to: email, // list of receivers
                    subject: "Verify Your Email", // Subject line
                    text: "Verify your email", // plain text body
                    html: Verification_Email_Template.replace("{verificationCode}",verificationCode), // html body
                  });
                  console.log('Email sent sucessfully !',response)
    } catch (error) {
        console.log(error);
    }
}

export const WelcomeEmail= async (email,name) => {
    try {
        const response = await transporter.sendMail({
                    from: `"✏️LexiPix ✨" <${process.env.USER_EMAIL}>`, // sender address
                    to: email, // list of receivers
                    subject: "Welcome Email", // Subject line
                    text: "Welcome email", // plain text body
                    html: Welcome_Email_Template.replace("{name}",name), // html body
                  });
                  console.log('Email sent sucessfully !',response)
    } catch (error) {
        console.log(error);
    }
}