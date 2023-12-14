/**
 * Forked from https://github.com/JacobLinCool/node-cloudflared
 *
 * Check main license for more information
 */
import { tmpdir } from "node:os";
import path from "pathe";

export const CLOUDFLARED_VERSION =
  process.env.CLOUDFLARED_VERSION || "2023.10.0";

export const RELEASE_BASE =
  "https://github.com/cloudflare/cloudflared/releases/";

/**
 * The path to the cloudflared binary.
 */
export const cloudflaredBinPath = path.join(
  tmpdir(),
  "node-untun",
  process.platform === "win32"
    ? `cloudflared.${CLOUDFLARED_VERSION}.exe`
    : `cloudflared.${CLOUDFLARED_VERSION}`,
);

export const cloudflaredNotice = `
🔥 Your installation of cloudflared software constitutes a symbol of your signature
   indicating that you accept the terms of the Cloudflare License, Terms and Privacy Policy.

❯ License:         \`https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/license/\`
❯ Terms:           \`https://www.cloudflare.com/terms/\`
❯ Privacy Policy:  \`https://www.cloudflare.com/privacypolicy/\`
`;

// Regexes

export const connRegex = /connection[ =]([\da-z-]+)/i;
export const ipRegex = /ip=([\d.]+)/;
export const locationRegex = /location=([A-Z]+)/;
export const indexRegex = /connIndex=(\d)/;
export const tunnelIDRegex = /tunnelid=([\da-z-]+)/i;
export const connectorIDRegex = /connector id: ([\da-z-]+)/i;
export const metricsRegex = /metrics server on ([\d.:]+\/metrics)/;
export const configRegex = /config="(.+[^\\])"/;
export const disconnectRegex = /unregistered tunnel connection connindex=(\d)/i;
