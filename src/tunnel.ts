import { existsSync } from "node:fs";
import consola from "consola";

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
 *  verifyTLS: true
 *  acceptCloudflareNotice: true
 * };
 * const tunnel = await startTunnel(tunnelOptions);
 * console.log(await tunnel.getURL());
 * await tunnel.close();
 */
export async function startTunnel(
  opts: TunnelOptions,
): Promise<undefined | Tunnel> {
  const {
    installCloudflared,
    startCloudflaredTunnel,
    cloudflaredBinPath,
    cloudflaredNotice,
  } = await import("./cloudflared");

  const url =
    opts.url ||
    `${opts.protocol || "http"}://${opts.hostname ?? "localhost"}:${
      opts.port ?? 3000
    }`;

  consola.start(`Starting cloudflared tunnel to ${url}`);

  if (!existsSync(cloudflaredBinPath)) {
    consola.log(cloudflaredNotice);
    const canInstall =
      opts.acceptCloudflareNotice ||
      process.env.UNTUN_ACCEPT_CLOUDFLARE_NOTICE ||
      (await consola.prompt(
        `Do you agree with the above terms and wish to install the binary from GitHub?`,
        {
          type: "confirm",
        },
      ));
    if (!canInstall) {
      consola.fail("Skipping tunnel setup.");
      return;
    }
    await installCloudflared();
  }

  const args = [
    ["--url", url],
    opts.verifyTLS ? undefined : ["--no-tls-verify", ""],
  ].filter(Boolean) as [string, string][];

  const tunnel = await startCloudflaredTunnel(Object.fromEntries(args));

  const cleanup = async () => {
    await tunnel.stop();
  };
  for (const signal of ["SIGINT", "SIGUSR1", "SIGUSR2"] as const) {
    process.once(signal, cleanup);
  }

  return {
    getURL: async () => await tunnel.url,
    close: async () => {
      await cleanup();
    },
  };
}
