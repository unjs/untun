/**
 * Forked from https://github.com/JacobLinCool/node-cloudflared
 *
 * Check main license for more information
 */
import os from "node:os";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { Connection } from "./types";
import {
  cloudflaredBinPath,
  configRegex,
  connRegex,
  connectorIDRegex,
  disconnectRegex,
  indexRegex,
  ipRegex,
  locationRegex,
  metricsRegex,
  tunnelIDRegex,
} from "./constants";

/**
 * Cloudflared launchd identifier.
 * @platform macOS
 */
export const identifier = "com.cloudflare.cloudflared";

/**
 * Cloudflared service name.
 * @platform linux
 */
export const serviceName = "cloudflared.service";

/**
 * Path of service related files.
 * @platform macOS
 */
export const MACOS_SERVICE_PATH = {
  PLIST: isRoot()
    ? `/Library/LaunchDaemons/${identifier}.plist`
    : `${os.homedir()}/Library/LaunchAgents/${identifier}.plist`,
  OUT: isRoot()
    ? `/Library/Logs/${identifier}.out.log`
    : `${os.homedir()}/Library/Logs/${identifier}.out.log`,
  ERR: isRoot()
    ? `/Library/Logs/${identifier}.err.log`
    : `${os.homedir()}/Library/Logs/${identifier}.err.log`,
} as const;

/**
 * Path of service related files.
 * @platform linux
 */
export const LINUX_SERVICE_PATH = {
  SYSTEMD: `/etc/systemd/system/${serviceName}`,
  SERVICE: "/etc/init.d/cloudflared",
  SERVICE_OUT: "/var/log/cloudflared.log",
  SERVICE_ERR: "/var/log/cloudflared.err",
} as const;

/**
 * Cloudflared Service API.
 */
export const service = {
  install,
  uninstall,
  exists,
  log,
  err,
  current,
  clean,
  journal,
};

/**
 * Throw when service is already installed.
 */
export class AlreadyInstalledError extends Error {
  constructor() {
    super("service is already installed");
  }
}

/**
 * Throw when service is not installed.
 */
export class NotInstalledError extends Error {
  constructor() {
    super("service is not installed");
  }
}

/**
 * Install Cloudflared service.
 * @param token Tunnel service token.
 * @platform macOS, linux
 */
export function install(token?: string): void {
  if (!["darwin", "linux"].includes(process.platform)) {
    throw new Error(`Not Implemented on platform ${process.platform}`);
  }

  if (exists()) {
    throw new AlreadyInstalledError();
  }

  const args = ["service", "install"];

  if (token) {
    args.push(token);
  }

  const result = spawnSync(cloudflaredBinPath, args);

  if (result.status !== 0) {
    throw new Error(`service install failed: ${result.stderr.toString()}`);
  }
}

/**
 * Uninstall Cloudflared service.
 * @platform macOS, linux
 */
export function uninstall(): void {
  if (!["darwin", "linux"].includes(process.platform)) {
    throw new Error(`Not Implemented on platform ${process.platform}`);
  }

  if (!exists()) {
    throw new NotInstalledError();
  }

  const result = spawnSync(cloudflaredBinPath, ["service", "uninstall"]);

  if (result.status !== 0) {
    throw new Error(`service uninstall failed: ${result.stderr.toString()}`);
  }

  if (process.platform === "darwin") {
    fs.rmSync(MACOS_SERVICE_PATH.OUT);
    fs.rmSync(MACOS_SERVICE_PATH.ERR);
  } else if (process.platform === "linux" && !isSystemd()) {
    fs.rmSync(LINUX_SERVICE_PATH.SERVICE_OUT);
    fs.rmSync(LINUX_SERVICE_PATH.SERVICE_ERR);
  }
}

/**
 * Get stdout log of cloudflared service. (Usually empty)
 * @returns stdout log of cloudflared service.
 * @platform macOS, linux (sysv)
 */
export function log(): string {
  if (!exists()) {
    throw new NotInstalledError();
  }

  if (process.platform === "darwin") {
    return fs.readFileSync(MACOS_SERVICE_PATH.OUT, "utf8");
  }

  if (process.platform === "linux" && !isSystemd()) {
    return fs.readFileSync(LINUX_SERVICE_PATH.SERVICE_OUT, "utf8");
  }

  throw new Error(`Not Implemented on platform ${process.platform}`);
}

/**
 * Get stderr log of cloudflared service. (cloudflared print all things here)
 * @returns stderr log of cloudflared service.
 * @platform macOS, linux (sysv)
 */
export function err(): string {
  if (!exists()) {
    throw new NotInstalledError();
  }

  if (process.platform === "darwin") {
    return fs.readFileSync(MACOS_SERVICE_PATH.ERR, "utf8");
  }

  if (process.platform === "linux" && !isSystemd()) {
    return fs.readFileSync(LINUX_SERVICE_PATH.SERVICE_ERR, "utf8");
  }

  throw new Error(`Not Implemented on platform ${process.platform}`);
}

/**
 * Get cloudflared service journal from journalctl.
 * @param n The number of entries to return.
 * @returns cloudflared service journal.
 * @platform linux (systemd)
 */
export function journal(n = 300): string {
  if (process.platform === "linux" && isSystemd()) {
    const args = ["-u", serviceName, "-o", "cat", "-n", n.toString()];
    return spawnSync("journalctl", args).stdout.toString();
  }

  throw new Error(`Not Implemented on platform ${process.platform}`);
}

/**
 * Get informations of current running cloudflared service.
 * @returns informations of current running cloudflared service.
 * @platform macOS, linux
 */
export function current(): {
  /** Tunnel ID */
  tunnelID: string;
  /** Connector ID */
  connectorID: string;
  /** The connections of the tunnel */
  connections: Connection[];
  /** Metrics Server Location */
  metrics: string;
  /** Tunnel Configuration */
  config: {
    ingress?: { service: string; hostname?: string }[];
    [key: string]: unknown;
  };
} {
  if (!["darwin", "linux"].includes(process.platform)) {
    throw new Error(`Not Implemented on platform ${process.platform}`);
  }

  if (!exists()) {
    throw new NotInstalledError();
  }

  const log = isSystemd() ? journal() : err();

  let tunnelID = "";
  let connectorID = "";
  const connections: Connection[] = [];
  let metrics = "";
  let config: {
    ingress?: { service: string; hostname?: string }[];
    [key: string]: unknown;
  } = {};

  for (const line of log.split("\n")) {
    try {
      if (tunnelIDRegex.test(line)) {
        tunnelID = line.match(tunnelIDRegex)?.[1] ?? "";
      } else if (connectorIDRegex.test(line)) {
        connectorID = line.match(connectorIDRegex)?.[1] ?? "";
      } else if (
        connRegex.test(line) &&
        locationRegex.test(line) &&
        ipRegex.test(line) &&
        indexRegex.test(line)
      ) {
        const [, id] = line.match(connRegex) ?? [];
        const [, location] = line.match(locationRegex) ?? [];
        const [, ip] = line.match(ipRegex) ?? [];
        const [, idx] = line.match(indexRegex) ?? [];
        connections[Number.parseInt(idx)] = { id, ip, location };
      } else if (disconnectRegex.test(line)) {
        const [, idx] = line.match(disconnectRegex) ?? [];
        if (Number.parseInt(idx) in connections) {
          connections[Number.parseInt(idx)] = { id: "", ip: "", location: "" };
        }
      } else if (metricsRegex.test(line)) {
        metrics = line.match(metricsRegex)?.[1] ?? "";
      } else if (configRegex.test(line)) {
        config = JSON.parse(
          line.match(configRegex)?.[1].replace(/\\/g, "") ?? "{}",
        );
      }
    } catch (error) {
      if (process.env.DEBUG) {
        console.error("log parsing failed", error);
      }
    }
  }

  return { tunnelID, connectorID, connections, metrics, config };
}

/**
 * Clean up service log files.
 * @platform macOS
 */
export function clean(): void {
  if (process.platform !== "darwin") {
    throw new Error(`Not Implemented on platform ${process.platform}`);
  }

  if (exists()) {
    throw new AlreadyInstalledError();
  }

  fs.rmSync(MACOS_SERVICE_PATH.OUT, { force: true });
  fs.rmSync(MACOS_SERVICE_PATH.ERR, { force: true });
}

/**
 * Check if cloudflared service is installed.
 * @returns true if service is installed, false otherwise.
 * @platform macOS, linux
 */
export function exists(): boolean {
  if (process.platform === "darwin") {
    return fs.existsSync(MACOS_SERVICE_PATH.PLIST);
  } else if (process.platform === "linux") {
    return isSystemd()
      ? fs.existsSync(LINUX_SERVICE_PATH.SYSTEMD)
      : fs.existsSync(LINUX_SERVICE_PATH.SERVICE);
  }

  throw new Error(`Not Implemented on platform ${process.platform}`);
}

function isRoot(): boolean {
  return process.getuid?.() === 0;
}

function isSystemd(): boolean {
  return process.platform === "linux" && fs.existsSync("/run/systemd/system");
}
