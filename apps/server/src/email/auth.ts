import { emailLayout, paragraph } from "./layout.ts";
const auth = {
 confirmation: ["Confirm your email · Unwatched", "Your story starts here.", "Confirm your email address to finish creating your Unwatched account.", "Confirm email"],
 magic_link: ["Your sign-in link · Unwatched", "The island is waiting.", "Use this one-time link to sign in. Open it in the same browser where you requested it, so we can complete your sign-in.", "Sign in to Unwatched"],
 invite: ["An invitation to Unwatched", "There’s room for you here.", "You’ve been invited to Unwatched. Follow the link to accept your invitation and set up your account.", "Accept invitation"],
 recovery: ["Reset your password · Unwatched", "A fresh way in.", "We received a request to reset your password. Follow the link to choose a new one.", "Reset password"],
 email_change: ["Confirm your email change · Unwatched", "A new address for your letters.", "Confirm the requested email change for your account. You may need to confirm from both your current and new inbox.", "Confirm email change"],
 reauthentication: ["Your verification code · Unwatched", "Just checking it’s you.", "Use this verification code to continue the account action you requested. Keep it private.", ""],
} as const;
const notices = {
 password_changed: ["Your password was changed", "The password for your Unwatched account was changed."],
 email_changed: ["Your email address was changed", "The email address for your Unwatched account was changed."],
 phone_changed: ["Your phone number was changed", "The phone number for your Unwatched account was changed."],
 identity_linked: ["A sign-in method was added", "A new sign-in method was linked to your Unwatched account."],
 identity_unlinked: ["A sign-in method was removed", "A sign-in method was removed from your Unwatched account."],
 mfa_factor_enrolled: ["A verification method was added", "A new verification method was added to your Unwatched account."],
 mfa_factor_unenrolled: ["A verification method was removed", "A verification method was removed from your Unwatched account."],
} as const;
export function authTemplates() {
 const result: Record<string,{subject:string;html:string}>={};
 for(const [key,[subject,headline,body,label]] of Object.entries(auth)) result[key]={subject,html:emailLayout({kicker:"Your Unwatched account",headline,preview:subject,body:paragraph(body)+(key==="reauthentication"?'<p style="font-family:monospace;font-size:32px;letter-spacing:6px;margin:24px 0">{{ .Token }}</p>':""),...(label?{action:{text:label,url:"{{ .ConfirmationURL }}"}}:{}),footer:"This email relates to an account request. If you didn’t request it, you can ignore it. Never share your sign-in link or verification code."})};
 for(const [key,[headline,body]] of Object.entries(notices)) result[`${key}_notification`]={subject:`${headline} · Unwatched`,html:emailLayout({kicker:"Account security",headline,preview:headline,body:paragraph(body)+paragraph("If this was you, no further action is needed. If you don’t recognize this change, review your account and contact the island operator immediately."),action:{text:"Review your account",url:"{{ .SiteURL }}/account"},footer:"This is a security notification about your account. It is separate from your digest and letter preferences."})};
 return result;
}
