import { describe, it, expect } from "vitest";
import { authTemplates } from "../src/email/auth.ts";
import { letterMail } from "../src/mail.ts";
describe("transactional email templates",()=>{
 it("preserves Supabase confirmation URLs without rebuilding or hardcoding redirects",()=>{
 const templates=authTemplates();
 for(const key of ["confirmation","magic_link","invite","recovery","email_change"]) {
 expect(templates[key]!.html).toContain('href="{{ .ConfirmationURL }}"');
 expect(templates[key]!.html).not.toContain('redirect_to=');
 }
 expect(templates.reauthentication!.html).toContain('{{ .Token }}');
 expect(templates.reauthentication!.html).not.toContain('{{ .ConfirmationURL }}');
 });
 it("keeps security notices separate from optional notification settings",()=>{
 const templates=authTemplates();
 expect(Object.keys(templates)).toHaveLength(13);
 for(const [key,t] of Object.entries(templates)) if(key.endsWith('_notification')) {
 expect(t.html).toContain('{{ .SiteURL }}/account');
 expect(t.html).not.toContain('Manage email preferences');
 }
 });
 it("escapes quote-breaking links and agent content and includes accessible plain text preferences",()=>{
 const mail=letterMail({to:'a@example.com',name:'<script>alert(1)</script>',day:1,text:'<img src=x onerror=alert(1)>',url:'https://unwatched.world/letters?x="bad"'});
 expect(mail.html).not.toMatch(/<script|<img/);
 expect(mail.html).toContain('&quot;bad&quot;');
 expect(mail.text).toContain('Manage email preferences: https://unwatched.world/account');
 });
});
