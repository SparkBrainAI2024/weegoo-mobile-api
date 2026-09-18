import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as Handlebars from "handlebars";

/**
 * Service responsible for parsing dynamic email template content
 * and rendering it inside the base WeeGoo email template.
 *
 * Features:
 * - Injects dynamic content from DB into the base template
 * - Converts <button> tags to <a> tags (buttons don't work reliably in email clients)
 * - Turns every <a href="..."> link into a styled button
 * - Adds a styled button for any plain URL found in the content (including URLs
 *   supplied through variables such as {{verificationLink}})
 * - Replaces placeholders like {{otp}}, {{name}}, {{currentYear}} and custom variables
 */
@Injectable()
export class EmailTemplateParserService {
  private readonly logger = new Logger(EmailTemplateParserService.name);
  private readonly baseTemplate: string;

  /** Button styling used for links converted to buttons */
  private readonly BUTTON_STYLE =
    "display:inline-block;padding:14px 32px;background-color:#081329;color:#FFD21F;text-decoration:none;border-radius:8px;font-size:16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.5;";

  /** Secondary button style (lighter variant) */
  private readonly BUTTON_STYLE_SECONDARY =
    "display:inline-block;padding:14px 32px;background-color:#FFD21F;color:#081329;text-decoration:none;border-radius:8px;font-size:16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.5;";

  /** URL detection regex - matches http/https URLs */
  private readonly URL_REGEX = /(https?:\/\/[^\s<>"']+)/g;

  /** Email-safe content wrapper styles */
  private readonly CONTENT_WRAPPER_STYLE =
    "font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7;color:#334155;";

  constructor() {
    // Load the base email template from the templates directory.
    // Try multiple paths to support both ts-node (dev) and webpack (prod) builds.
    const possiblePaths = [
      path.join(process.cwd(), "libs", "services", "mail", "templates", "base-email-template.hbs"),
      path.join(__dirname, "templates", "base-email-template.hbs"),
      path.join(process.cwd(), "dist", "apps", "api", "templates", "base-email-template.hbs"),
      path.join(process.cwd(), "dist", "apps", "admin-api", "templates", "base-email-template.hbs"),
      path.join(process.cwd(), "dist", "apps", "driver-api", "templates", "base-email-template.hbs"),
      path.join(process.cwd(), "dist", "libs", "services", "mail", "templates", "base-email-template.hbs"),
      path.join(process.cwd(), "dist", "libs", "services", "email-template", "src", "templates", "base-email-template.hbs"),
      path.join(process.cwd(), "libs", "services", "email-template", "src", "templates", "base-email-template.hbs"),
    ];

    let templatePath: string | null = null;
    for (const candidate of possiblePaths) {
      if (fs.existsSync(candidate)) {
        templatePath = candidate;
        break;
      }
    }

    if (!templatePath) {
      throw new Error(
        `Base email template not found. Tried: ${possiblePaths.join(", ")}`,
      );
    }

    this.baseTemplate = fs.readFileSync(templatePath, "utf-8");
  }

  /**
   * Parse dynamic content and render it inside the base email template.
   */
  parseAndRender(content: string, variables?: Record<string, any>): string {
    try {
      const currentYear = new Date().getFullYear().toString();
      const carIconUrl = this.getCarIconUrl();

      // 1. Replace placeholders first so any URL supplied through variables
      //    already exists in the content before parsing.
      const contentWithVariables = this.applyVariables(content, {
        currentYear,
        carIconUrl,
        ...variables,
      });

      // 2. Parse the dynamic content - convert links/URLs to buttons, fix buttons, etc.
      const parsedContent = this.parseContent(contentWithVariables);

      // 3. Compile the base template with Handlebars
      const template = Handlebars.compile(this.baseTemplate);

      // 4. Build the context with parsed content and default variables
      const context: Record<string, any> = {
        content: parsedContent,
        currentYear,
        carIconUrl,
        ...variables,
      };

      // 5. Render the final HTML
      return template(context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to parse and render email template: ${errorMessage}`);
      return this.fallbackRender(content, variables);
    }
  }

  /**
   * Replaces custom {{variable}} placeholders inside the dynamic content.
   */
  private applyVariables(
    content: string,
    variables?: Record<string, any>,
  ): string {
    if (!content || !variables || Object.keys(variables).length === 0) {
      return content;
    }

    try {
      // noEscape keeps URLs intact (Handlebars would otherwise escape "=" in query
      // strings, breaking links like https://host/verify-email?token=abc)
      return Handlebars.compile(content, { noEscape: true })(variables);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to replace variables in email template content using Handlebars (${errorMessage}). Falling back to regex replacement.`,
      );
      return this.regexReplaceVariables(content, variables);
    }
  }

  /**
   * Plain regex replacement of known {{variable}} placeholders.
   */
  private regexReplaceVariables(
    content: string,
    variables: Record<string, any>,
  ): string {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      if (value === undefined || value === null) {
        continue;
      }
      result = result.replace(
        new RegExp(`{{\\s*${this.escapeRegExp(key)}\\s*}}`, "g"),
        () => String(value),
      );
    }
    // Strip any remaining strict {{...}} / {{{...}}} tokens so they never
    // render as literal "{{" in the final email.
    let previous: string;
    do {
      previous = result;
      result = result
        .replace(/{{{\s*[^{}]*?}}}/g, "")
        .replace(/{{\s*[^{}]*?}}/g, "");
    } while (result !== previous);
    return result;
  }

  /**
   * Escape a string for safe use inside a RegExp.
   */
  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Get the URL for the car icon image.
   */
  private getCarIconUrl(): string {
    let carIconUrl: string | undefined;

    if (!carIconUrl) {
      const publicBucket = process.env.AWS_PUBLIC_BUCKET;
      const publicRegion = process.env.AWS_PUBLIC_REGION;
      if (publicBucket && publicRegion) {
        carIconUrl = `https://${publicBucket}.s3.${publicRegion}.amazonaws.com/assets/car-icon.png`;
      }
    }

    if (!carIconUrl) {
      const s3Bucket = process.env.S3_BUCKET_NAME;
      const awsRegion = process.env.AWS_REGION;
      if (s3Bucket && awsRegion) {
        carIconUrl = `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/assets/car-icon.svg`;
      }
    }

    this.logger.log(`Car icon URL: ${carIconUrl}`);
    return carIconUrl;
  }

  /**
   * Parse the dynamic content:
   * 0. Fix split curly-brace placeholders like {{verification_url}}
   * 1. Convert <button> tags to <a> buttons
   * 2. Change existing <a href="..."> links into styled buttons
   * 3. Add a styled button for every plain URL found in the content
   * 4. Wrap content in email-safe HTML
   */
  private parseContent(content: string): string {
    if (!content || content.trim().length === 0) {
      return "";
    }

    let parsed = content;

    // Step 0: Fix split curly-brace placeholders like {{verification_url}}.
    // Converts "<p>{{</p><p>https://…</p><p>}}</p>" into a proper anchor so
    // Step 2 styles it into a button and Step 3 does NOT also wrap the URL
    // as a second, generic "Click Here" button.
    parsed = parsed.replace(
      /\{\{\s*(?:<[^>]+>\s*)*\s*(https?:\/\/[^\s<"']+)\s*(?:\s*<[^>]+>)*\s*\}\}/gi,
      (_match, url: string) =>
        `<a href="${url}">Verify My Email Address</a>`,
    );

    // Step 1: Convert <button> tags to <a> tags
    parsed = parsed.replace(
      /<button\b([^>]*)>([\s\S]*?)<\/button>/gi,
      (match, attributes: string, innerContent: string) => {
        const hrefMatch = attributes.match(
          /(?:data-url|data-href|onclick)\s*=\s*["']([^"']+)["']/i,
        );
        let href = hrefMatch ? hrefMatch[1] : "";

        // Clean up onclick handlers (e.g. window.location.href='...')
        if (href.startsWith("window.") || href.includes("location")) {
          const urlMatch = href.match(/['"](https?:\/\/[^'"]+)['"]/);
          if (urlMatch) {
            href = urlMatch[1];
          }
        }

        const buttonText = this.extractText(innerContent);
        if (!href || href === "#") {
          const innerUrl = this.extractExactUrl(innerContent);
          href = innerUrl || "#";
        }

        const finalText = buttonText === href ? "Click Here" : buttonText;

        return this.buildButton(href, finalText);
      },
    );

    // Step 2: Change existing <a href="..."> links into styled buttons
    parsed = parsed.replace(
      /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
      (match, attributes: string, innerContent: string) => {
        const dataUrlMatch = attributes.match(
          /(?:data-url|data-href)\s*=\s*["']([^"']*)["']/i,
        );
        const hrefMatch = attributes.match(/href\s*=\s*["']([^"']*)["']/i);
        let href = (dataUrlMatch?.[1] || hrefMatch?.[1] || "").trim();

        if (!href || href === "#") {
          const innerUrl = this.extractExactUrl(innerContent);
          if (innerUrl) {
            href = innerUrl;
          }
        }

        if (!href || href === "#") {
          return match;
        }

        const hasButtonStyle =
          attributes.includes("background-color") ||
          attributes.includes("background") ||
          attributes.includes("padding") ||
          attributes.includes("border-radius");

        if (hasButtonStyle) {
          return match;
        }

        const linkText = this.extractText(innerContent);

        const buttonText =
          linkText === href || linkText.trim().length === 0
            ? "Click Here"
            : linkText;

        return this.buildButton(href, buttonText);
      },
    );

    // Step 3: Add a styled button for every plain URL found in the content
    parsed = this.convertPlainUrlsToButtons(parsed);

    // Step 4: Wrap content in email-safe HTML
    return this.wrapContent(parsed);
  }

  /**
   * If the given HTML fragment's visible text is exactly one URL, return it.
   */
  private extractExactUrl(innerHtml: string): string | null {
    const text = this.extractText(innerHtml).trim();
    const match = text.match(/^(https?:\/\/[^\s<>"']+?)[.,;:!?)\]]*$/);
    return match ? match[1] : null;
  }

  /**
   * Detect plain (bare) URLs in the content text and convert them into styled buttons.
   *
   * Two things this method handles:
   *  1. `<p>URL</p>` is unwrapped to bare `URL` first, so the generated
   *     button <table> is never nested inside a <p> (which some email
   *     clients, especially Outlook, mangle or hide).
   *  2. URLs that look like verification links get the label
   *     "Verify My Email Address" instead of the generic "Click Here".
   */
  private convertPlainUrlsToButtons(content: string): string {
    // 1. Unwrap paragraphs that consist only of a URL.
    const unwrapped = content.replace(
      /<p[^>]*>\s*(https?:\/\/[^\s<"']+)\s*<\/p>/gi,
      (_m, url: string) => url,
    );

    // 2. Walk the content tag-by-tag (URLs inside attributes are never
    //    touched because they live inside a tag, not a text node).
    return unwrapped.replace(
      /(<[^>]*>)|([^<]+)/g,
      (match: string, tag?: string, text?: string) => {
        if (tag || !text) {
          return match;
        }

        return text.replace(this.URL_REGEX, (url: string) => {
          const trailingMatch = url.match(/[.,;:!?)\]]+$/);
          const trailing = trailingMatch ? trailingMatch[0] : "";
          const cleanUrl = trailing ? url.slice(0, -trailing.length) : url;

          if (!cleanUrl) {
            return url;
          }

          // Pick a label based on the URL's purpose.
          const label = /verify-email|\/verify\b|verification/i.test(cleanUrl)
            ? "Verify My Email Address"
            : "Click Here";

          return `${this.buildButton(cleanUrl, label)}${trailing}`;
        });
      },
    );
  }

  /**
   * Build a styled button anchor tag.
   */
  private buildButton(href: string, text: string): string {
    const safeHref = this.sanitizeUrl(href);
    const safeText = this.escapeHtml(text || "Click Here");

    // Use a table-based button for maximum email client compatibility
    return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
        <tr>
          <td style="border-radius:8px;background-color:#081329;">
            <a href="${safeHref}" target="_blank" style="${this.BUTTON_STYLE}">
              ${safeText}
            </a>
          </td>
        </tr>
      </table>
    `;
  }

  /**
   * Wrap parsed content in email-safe HTML with proper styling.
   */
  private wrapContent(content: string): string {
    return `
      <div style="${this.CONTENT_WRAPPER_STYLE}">
        ${content}
      </div>
    `;
  }

  /**
   * Extract readable text from HTML content (strips tags).
   */
  private extractText(html: string): string {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Sanitize URL to prevent XSS in emails.
   */
  private sanitizeUrl(url: string): string {
    if (!url || url === "#") {
      return "#";
    }
    if (/^(https?:\/\/|mailto:)/i.test(url)) {
      return url;
    }
    if (url.startsWith("/")) {
      return url;
    }
    return `https://${url}`;
  }

  /**
   * Escape HTML special characters.
   */
  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      "&": "&" + "amp;",
      "<": "&" + "lt;",
      ">": "&" + "gt;",
      '"': "&" + "quot;",
      "'": "&" + "#39;",
    };
    return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
  }

  /**
   * Fallback rendering if parsing fails.
   */
  private fallbackRender(content: string, variables?: Record<string, any>): string {
    const year = new Date().getFullYear().toString();
    let html = this.baseTemplate
      .replace("{{{content}}}", content || "")
      .replace("{{currentYear}}", year)
      .replace("{{carIconUrl}}", this.getCarIconUrl());

    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        if (value === undefined || value === null) {
          continue;
        }
        html = html.replace(
          new RegExp(`{{\\s*${this.escapeRegExp(key)}\\s*}}`, "g"),
          () => String(value),
        );
      }
    }

    return html;
  }
}