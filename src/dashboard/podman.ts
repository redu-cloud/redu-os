import http from "node:http";

const podmanSocket = process.env.PODMAN_SOCKET_PATH ?? "/run/podman/podman.sock";

/** Raw GET against the Podman REST API via Unix socket. Returns a Buffer. */
export function podmanRequest(apiPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: podmanSocket, path: apiPath, method: "GET" },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * Parse Docker/Podman multiplexed log stream.
 * Format per frame: [streamType(1)][pad(3)][length(4 BE)] + payload
 */
export function parseLogStream(buf: Buffer): Array<{ stream: "stdout" | "stderr"; text: string }> {
  const lines: Array<{ stream: "stdout" | "stderr"; text: string }> = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const streamType = buf[offset];
    const payloadLen = buf.readUInt32BE(offset + 4);
    offset += 8;
    if (offset + payloadLen > buf.length) break;
    const text = buf.subarray(offset, offset + payloadLen).toString("utf8").replace(/\n$/, "");
    if (text.length > 0) {
      lines.push({ stream: streamType === 2 ? "stderr" : "stdout", text });
    }
    offset += payloadLen;
  }
  return lines;
}
