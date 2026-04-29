import { existsSync } from "node:fs";
import { constants as osConstants } from "node:os";
import { log, prompt } from "./log.ts";

export interface TunnelOptions {
  /**
   * The URL to which the tunnel should connect. The default is to construct a URL based on protocol, hostname and port.
   * @optional
   */
  url?: string;

  /**
   * The port number to use for the tunnel connection. Can be a string or a number. Defaults to 3000.
   * @optional
   */
  port?: number | string;

  /**
   * The host name for the tunnel connection. Defaults to localhost.
   * @optional
   */
  hostname?: string;

  /**
   * The protocol to use for the tunnel connection, either "http" or "https". Default is http.
   * @optional
   */
  protocol?: "http" | "https";

  /**
   * Specifies whether to enforce TLS verification. Default is true.
   * @optional
   */
  verifyTLS?: boolean;

  /**
   * Indicates whether the user accepts the Cloudflare Terms of Service for using cloudflared. Default is false.
   * @optional
   */
  acceptCloudflareNotice?: boolean;
  extraArgs?: Array<string>;
}

export interface Tunnel {
  /**
   * Get the current URL of the active tunnel.
   * @returns {Promise<string>} A promise that resolves to the URL of the tunnel.
   */
  getURL: () => Promise<string>;

  /**
   * Close the active tunnel.
   * @returns {Promise<void>} A promise that will be resolved when the tunnel is successfully closed.
   */
  close: () => Promise<void>;
}

/**
 * Initialises and starts a network tunnel using cloudflared.
 * @param {TunnelOptions} opts - Configuration options for the tunnel.
 * @returns {Promise<undefined | Tunnel>} A promise that resolves to the tunnel instance, or undefined if the setup fails.
 * @throws {Error} If there are problems installing cloudflared or starting the tunnel.
 * @example
 * const tunnelOptions = {
 *  protocol: "https",
 *  port: "443",
 *  hostname: "example.com",
 *  verifyTLS: true,
 *  acceptCloudflareNotice: true
 * };
 * const tunnel = await startTunnel(tunnelOptions);
 * console.log(await tunnel.getURL());
 * await tunnel.close();
 */
export async function startTunnel(opts: TunnelOptions): Promise<undefined | Tunnel> {
  const { installCloudflared, startCloudflaredTunnel, cloudflaredBinPath, cloudflaredNotice } =
    await import("./cloudflared/index.ts");

  const url =
    opts.url || `${opts.protocol || "http"}://${opts.hostname ?? "localhost"}:${opts.port ?? 3000}`;

  log(`Starting cloudflared tunnel to ${url}`, "info");

  if (!existsSync(cloudflaredBinPath)) {
    log(cloudflaredNotice);
    const canInstall =
      opts.acceptCloudflareNotice ||
      process.env.UNTUN_ACCEPT_CLOUDFLARE_NOTICE ||
      (await prompt(
        `Do you agree with the above terms and wish to install the binary from GitHub?`,
      ));
    if (!canInstall) {
      log("Skipping tunnel setup.", "error");
      return;
    }
    await installCloudflared();
  }

  const args = [["--url", url], opts.verifyTLS ? undefined : ["--no-tls-verify", null]].filter(
    Boolean,
  ) as [string, string | null][];

  const tunnel = startCloudflaredTunnel(Object.fromEntries(args), opts.extraArgs);

  let closed = false;
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
  const handlers = new Map<NodeJS.Signals, () => void>();

  const cleanup = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    for (const [sig, handler] of handlers) process.off(sig, handler);
    handlers.clear();
    await tunnel.stop();
  };

  for (const signal of signals) {
    const handler = () => {
      cleanup().finally(() => {
        const signo = osConstants.signals[signal] ?? 0;
        process.exit(128 + signo);
      });
    };
    handlers.set(signal, handler);
    process.once(signal, handler);
  }

  return {
    getURL: () => tunnel.url,
    close: cleanup,
  };
}
