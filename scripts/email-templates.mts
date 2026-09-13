import { mkdir, writeFile } from "node:fs/promises";
import { authTemplates } from "../apps/server/src/email/auth.ts";
import { digestMail, letterMail } from "../apps/server/src/mail.ts";
const templates=authTemplates();
const directory=new URL("../packages/store/supabase/templates/",import.meta.url);
await mkdir(directory,{recursive:true});
const config:Record<string,string>={};
for(const [name,template] of Object.entries(templates)) { await writeFile(new URL(`${name}.html`,directory),template.html); config[`mailer_subjects_${name}`]=template.subject; config[`mailer_templates_${name}_content`]=template.html; }
await writeFile(new URL("auth-email-config.json",directory),JSON.stringify(config,null,2)+"\n");
const preview=new URL("../artifacts/email-preview/",import.meta.url);await mkdir(preview,{recursive:true});
const examples={...templates,digest:digestMail({to:"preview@example.com",name:"Mira Kovač",day:9,headline:"Mira found her place at the mill.",text:"A conversation became an offer. Mira starts work tomorrow, and she has someone to thank.",lines:["She met Rosa at the harbor inn.","The miller offered her a morning shift."],url:"https://unwatched.world/digest"}),letter:letterMail({to:"preview@example.com",name:"Mira Kovač",day:9,text:"I thought I wanted a place of my own. Maybe I just wanted a reason to stay. There’s work at the mill tomorrow. I said yes.",url:"https://unwatched.world/letters"})};
for(const [name,t] of Object.entries(examples)) await writeFile(new URL(`${name}.html`,preview),t.html.replaceAll("{{ .ConfirmationURL }}","#preview-only").replaceAll("{{ .SiteURL }}","https://unwatched.world").replaceAll("{{ .Token }}","123456"));
await writeFile(new URL("index.html",preview),`<!doctype html><html lang="en"><title>Unwatched email previews</title><body style="font:16px Arial;background:#f2f1eb;padding:40px"><h1>Unwatched emails</h1><p>Local examples. No emails are sent. Authentication buttons are inactive.</p>${Object.keys(examples).map(name=>`<p><a href="${name}.html">${name.replaceAll("_"," ")}</a></p>`).join("")}</body></html>`);
console.log(`Generated ${Object.keys(templates).length} Supabase templates and ${Object.keys(examples).length} local previews.`);
