import { describe, expect, it } from "vitest";
import { isDangerousUrl, isExportSafeUrl } from "../src/io/urlSafety";

describe("isDangerousUrl", () => {
  it("flags script-executing schemes, including obfuscated ones", () => {
    expect(isDangerousUrl("javascript:alert(1)")).toBe(true);
    expect(isDangerousUrl("  javascript:alert(1)")).toBe(true);
    expect(isDangerousUrl("java\tscript:alert(1)")).toBe(true);
    expect(isDangerousUrl("javascript:alert(1)")).toBe(true);
    expect(isDangerousUrl("JavaScript:alert(1)")).toBe(true);
    expect(isDangerousUrl("vbscript:msgbox(1)")).toBe(true);
    expect(isDangerousUrl("data:text/html,<script>alert(1)</script>")).toBe(true);
  });

  it("allows http/https/mailto/anchors/relative links", () => {
    expect(isDangerousUrl("https://example.com")).toBe(false);
    expect(isDangerousUrl("http://example.com")).toBe(false);
    expect(isDangerousUrl("mailto:a@b.com")).toBe(false);
    expect(isDangerousUrl("#map=abc123")).toBe(false);
    expect(isDangerousUrl("/relative/page")).toBe(false);
    expect(isDangerousUrl("example.com")).toBe(false);
  });
});

describe("isExportSafeUrl", () => {
  it("allows the export allowlist (http(s), mailto, tel, #, data:image)", () => {
    expect(isExportSafeUrl("https://example.com")).toBe(true);
    expect(isExportSafeUrl("http://example.com")).toBe(true);
    expect(isExportSafeUrl("mailto:a@b.com")).toBe(true);
    expect(isExportSafeUrl("tel:+15551234567")).toBe(true); // #11 hyperlink parity
    expect(isExportSafeUrl("#map=abc123")).toBe(true);
    expect(isExportSafeUrl("data:image/png;base64,AAAA")).toBe(true);
  });

  it("rejects dangerous and non-allowlisted schemes", () => {
    expect(isExportSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isExportSafeUrl("data:text/html,x")).toBe(false);
    expect(isExportSafeUrl("vbscript:x")).toBe(false);
    expect(isExportSafeUrl("ftp://host/file")).toBe(false);
    expect(isExportSafeUrl("file:///etc/passwd")).toBe(false); // #11: file: deliberately excluded
    expect(isExportSafeUrl("/relative/page")).toBe(false);
  });
});
