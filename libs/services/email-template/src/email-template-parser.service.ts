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
 * - Detects URLs/links in content and converts them to styled buttons
 * - Converts <button> tags to <a> tags (buttons don't work reliably in email clients)
 * - Styles existing <a> tags as buttons when they contain links
 * - Replaces placeholders like {{currentYear}} and custom variables
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
  private readonly URL_REGEX =
    /(https?:\/\/[^\s<>"']+)/g;

  /** Email-safe content wrapper styles */
  private readonly CONTENT_WRAPPER_STYLE =
    "font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7;color:#334155;";

  constructor() {
    // Load the base email template from the templates directory.
    // Try multiple paths to support both ts-node (dev) and webpack (prod) builds.
    const possiblePaths = [
      // Primary: libs/services/mail/templates (main location)
      path.join(process.cwd(), "libs", "services", "mail", "templates", "base-email-template.hbs"),
      // Dev mode (ts-node): libs/services/email-template/src/templates
      path.join(__dirname, "templates", "base-email-template.hbs"),
      // Webpack build: dist/apps/{app}/templates (copied by CopyWebpackPlugin)
      path.join(process.cwd(), "dist", "apps", "api", "templates", "base-email-template.hbs"),
      path.join(process.cwd(), "dist", "apps", "admin-api", "templates", "base-email-template.hbs"),
      path.join(process.cwd(), "dist", "apps", "driver-api", "templates", "base-email-template.hbs"),
      // Webpack build: dist/libs/services/mail/templates
      path.join(process.cwd(), "dist", "libs", "services", "mail", "templates", "base-email-template.hbs"),
      // Fallback: dist/libs/services/email-template/src/templates
      path.join(process.cwd(), "dist", "libs", "services", "email-template", "src", "templates", "base-email-template.hbs"),
      // Source fallback
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
   *
   * @param content - The dynamic content from the email template (pageContent from DB)
   * @param variables - Optional custom variables to replace in the template (e.g., { userName: 'John' })
   * @returns The fully rendered HTML email
   */
  parseAndRender(content: string, variables?: Record<string, any>): string {
    try {
      // 1. Parse the dynamic content - convert links to buttons, fix buttons, etc.
      const parsedContent = this.parseContent(content);

      // 2. Compile the base template with Handlebars
      const template = Handlebars.compile(this.baseTemplate);

      // 3. Build the context with parsed content and default variables
      const context: Record<string, any> = {
        content: parsedContent,
        currentYear: new Date().getFullYear().toString(),
        carIconUrl: this.getCarIconUrl(),
        ...variables,
      };

      // 4. Render the final HTML
      return template(context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to parse and render email template: ${errorMessage}`);
      // Fallback: return content wrapped in basic HTML if parsing fails
      return this.fallbackRender(content, variables);
    }
  }

  /**
   * Get the URL for the car icon image.
   * Priority: EMAIL_CAR_ICON_URL > API_BASE_URL > S3 > PRODUCTION_URL > relative path
   */
  private getCarIconUrl(): string {
    let carIconUrl: string | undefined;

    // 1. Highest priority: Explicit EMAIL_CAR_ICON_URL env variable
    const envUrl = process.env.EMAIL_CAR_ICON_URL;
    if (envUrl && envUrl.trim().length > 0) {
      carIconUrl = envUrl.trim();
    }

    // 2. API_BASE_URL (e.g., http://localhost:3000/assets/car-icon.svg)
    if (!carIconUrl) {
      const apiBaseUrl = process.env.API_BASE_URL;
      if (apiBaseUrl && apiBaseUrl.trim().length > 0) {
        // Remove trailing /api if present since static assets are served at root
        const baseUrl = apiBaseUrl.trim().replace(/\/$/, '').replace(/\/api$/, '');
        carIconUrl = `${baseUrl}/assets/car-icon.svg`;
      }
    }

    // 3. S3 URL if configured
    if (!carIconUrl) {
      const s3Bucket = process.env.S3_BUCKET_NAME;
      const awsRegion = process.env.AWS_REGION;
      if (s3Bucket && awsRegion) {
        carIconUrl = `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/car-icon.svg`;
      }
    }

    // 4. PRODUCTION_URL
    if (!carIconUrl) {
      const productionUrl = process.env.PRODUCTION_URL;
      if (productionUrl && productionUrl.trim().length > 0) {
        carIconUrl = `${productionUrl.trim()}/assets/car-icon.svg`;
      }
    }

    // 5. Final fallback: relative path
    if (!carIconUrl) {
      carIconUrl = '/assets/car-icon.svg';
    }

    // Log the car icon URL for debugging
    this.logger.log(`Car icon URL: ${carIconUrl}`);

    // Ensure URL is absolute for email clients (emails can't use relative paths)
    // If it's a relative path, prepend with API_BASE_URL or PRODUCTION_URL if available
    if (carIconUrl.startsWith('/')) {
      const apiBaseUrl = process.env.API_BASE_URL?.trim().replace(/\/$/, '');
      const productionUrl = process.env.PRODUCTION_URL?.trim().replace(/\/$/, '');

      if (apiBaseUrl) {
        carIconUrl = `${apiBaseUrl}${carIconUrl}`;
      } else if (productionUrl) {
        carIconUrl = `${productionUrl}${carIconUrl}`;
      } else {
        // Last resort: use http://localhost for development
        const port = process.env.PORT || '3000';
        carIconUrl = `http://localhost:${port}${carIconUrl}`;
      }
    }

    return carIconUrl;
  }

  /**
   * Parse the dynamic content:
   * 1. Convert <button> tags to <a> tags (buttons don't work in most email clients)
   * 2. Detect plain URLs and convert them to styled buttons
   * 3. Style existing <a> tags as buttons
   * 4. Wrap content in email-safe HTML
   */
  private parseContent(content: string): string {
    if (!content || content.trim().length === 0) {
      return "";
    }

    let parsed = content;

    // Step 1: Convert <button> tags to <a> tags
    // Pattern: <button ...>text</button> or <button ...>text</button>
    parsed = parsed.replace(
      /<button\b([^>]*)>([\s\S]*?)<\/button>/gi,
      (match, attributes: string, innerContent: string) => {
        // Extract onclick or data-url attributes that might contain a link
        const hrefMatch = attributes.match(
          /(?:data-url|data-href|onclick)\s*=\s*["']([^"']+)["']/i,
        );
        let href = hrefMatch ? hrefMatch[1] : "#";

        // Clean up onclick handlers (e.g., window.location.href='...')
        if (href.startsWith("window.") || href.includes("location")) {
          const urlMatch = href.match(/['"](https?:\/\/[^'"]+)['"]/);
          if (urlMatch) {
            href = urlMatch[1];
          }
        }

        // Extract button text
        const buttonText = this.extractText(innerContent);

        return this.buildButton(href, buttonText);
      },
    );

    // Step 2: Detect plain URLs in text and convert them to buttons
    // Only convert URLs that are NOT already inside an <a> tag
    parsed = parsed.replace(
      /(^|[^"'>])(https?:\/\/[^\s<>"']+)/g,
      (match, prefix: string, url: string) => {
        // Skip if the URL is already part of an anchor tag
        if (prefix.includes("<a") || prefix.includes("href=")) {
          return match;
        }
        return `${prefix}${this.buildButton(url, "Click Here")}`;
      },
    );

    // Step 3: Style existing <a> tags as buttons if they don't have button styling
    parsed = parsed.replace(
      /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
      (match, attributes: string, innerContent: string) => {
        // Extract href
        const hrefMatch = attributes.match(/href\s*=\s*["']([^"']*)["']/i);
        const href = hrefMatch ? hrefMatch[1] : "#";

        // Check if the anchor already has button-like styling
        const hasButtonStyle =
          attributes.includes("background-color") ||
          attributes.includes("background") ||
          attributes.includes("padding") ||
          attributes.includes("border-radius");

        // If it already has button styling, keep it but ensure it looks good
        if (hasButtonStyle) {
          return match;
        }

        // Extract link text
        const linkText = this.extractText(innerContent);

        // If the link text is just the URL itself, use "Click Here" as button text
        const buttonText =
          linkText === href || linkText.trim().length === 0
            ? "Click Here"
            : linkText;

        return this.buildButton(href, buttonText);
      },
    );

    // Step 4: Wrap content in email-safe HTML
    return this.wrapContent(parsed);
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
    // Only allow http, https, and mailto protocols
    if (/^(https?:\/\/|mailto:)/i.test(url)) {
      return url;
    }
    // If it's a relative path or other, prefix with https://
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
   * Fallback rendering if parsing fails - returns content in a basic wrapper.
   */
  private fallbackRender(content: string, variables?: Record<string, any>): string {
    const year = new Date().getFullYear().toString();
    let html = this.baseTemplate
      .replace("{{{content}}}", content || "")
      .replace("{{currentYear}}", year)
      .replace("{{carIconUrl}}", this.getCarIconUrl());

    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        html = html.replace(new RegExp(`{{${key}}}`, "g"), String(value));
      }
    }

    return html;
  }
}