/**
 * Forked from https://github.com/JacobLinCool/node-cloudflared
 *
 * Check main license for more information
 */
import { spawn, ChildProcess } from "node:child_process";
import type { Connection } from "./types";
import {
  cloudflaredBinPath,
  connRegex,
  ipRegex,
  locationRegex,
  indexRegex,
} from "./constants";

/**
 *  Create a tunnel.
 * @param options The options to pass to cloudflared.
 * @returns
 */
export function startCloudflaredTunnel(
  options: Record<string, string | number | null> = {},
  extraArgs : Array<string> = []
): {
  /** The URL of the tunnel */
  url: Promise<string>;
  /** The connections of the tunnel */
  connections: Promise<Connection>[];
  /** Spwaned cloudflared process */
  child: ChildProcess;
  /** Stop the cloudflared process */
  stop: ChildProcess["kill"];
} {
  const args: string[] = ["tunnel"];
  for (const [key, value] of Object.entries(options)) {
    if (typeof value === "string") {
      args.push(`${key}`, value);
    } else if (typeof value === "number") {
      args.push(`${key}`, value.toString());
    } else if (value === null) {
      args.push(`${key}`);
    }
  }
  if (!options['--url']) {
    args.push("--url", "localhost:8080");
  }
  
  if (Array.isArray(extraArgs)) {
    args.push(...extraArgs);
  }

  const child = spawn(cloudflaredBinPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (process.env.DEBUG) {
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
  }

  const urlRegex = /\|\s+(https?:\/\/\S+)/;
  let urlResolver: (value: string | PromiseLike<string>) => void = () =>
    undefined;
  let urlRejector: (reason: unknown) => void = () => undefined;
  const url = new Promise<string>(
    (...pair) => ([urlResolver, urlRejector] = pair),
  );

  const connectionResolvers: ((
    value: Connection | PromiseLike<Connection>,
  ) => void)[] = [];
  const connectionRejectors: ((reason: unknown) => void)[] = [];
  const connections: Promise<Connection>[] = [];
  for (let i = 0; i < 1; i++) {
    connections.push(
      new Promise<Connection>(
        (...pair) => ([connectionResolvers[i], connectionRejectors[i]] = pair),
      ),
    );
  }

  const parser = (data: Buffer) => {
    const str = data.toString();

    const urlMatch = str.match(urlRegex);
    urlMatch && urlResolver(urlMatch[1]);

    const connMatch = str.match(connRegex);
    const ipMatch = str.match(ipRegex);
    const locationMatch = str.match(locationRegex);
    const indexMatch = str.match(indexRegex);
    if (connMatch && ipMatch && locationMatch && indexMatch) {
      const [, id] = connMatch;
      const [, ip] = ipMatch;
      const [, location] = locationMatch;
      const [, idx] = indexMatch;
      connectionResolvers[+idx]?.({ id, ip, location });
    }
  };
  child.stdout.on("data", parser).on("error", urlRejector);
  child.stderr.on("data", parser).on("error", urlRejector);

  const stop = () => child.kill("SIGINT");

  return { url, connections, child, stop };
}
