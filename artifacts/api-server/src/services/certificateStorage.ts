import { Storage } from "@google-cloud/storage";

const endpoint = "http://127.0.0.1:1106";
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${endpoint}/token`,
    type: "external_account",
    credential_source: { url: `${endpoint}/credential`, format: { type: "json", subject_token_field_name: "access_token" } },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});