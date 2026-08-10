# Email Template Assets

This directory contains assets used in email templates.

## Car Icon

The `car-icon.svg` file is used in the base email template header. For this icon to display properly in all email clients (including Gmail, Outlook, etc.), it **must** be hosted on a public URL.

### Why not inline SVG?

Many email clients, including Gmail, block inline SVGs and data URIs for security reasons. Therefore, the icon must be hosted externally.

### Deployment Steps

#### Option 1: Using AWS S3 (Recommended)

1. Upload `car-icon.svg` to your S3 bucket:
   ```bash
   aws s3 cp car-icon.svg s3://your-bucket-name/assets/car-icon.svg
   ```

2. Make the file publicly accessible:
   ```bash
   aws s3api put-object-acl --bucket your-bucket-name --key assets/car-icon.svg --acl public-read
   ```

3. Set the environment variable in your `.env` file:
   ```
   EMAIL_CAR_ICON_URL=https://your-bucket-name.s3.your-region.amazonaws.com/assets/car-icon.svg
   ```

#### Option 2: Using Your Web Server

1. Upload `car-icon.svg` to your web server's public directory (e.g., `/public/assets/`)

2. Set the environment variable:
   ```
   EMAIL_CAR_ICON_URL=https://yourdomain.com/assets/car-icon.svg
   ```

#### Option 3: Using a CDN

Upload the file to any CDN service (Cloudflare, CloudFront, etc.) and set the `EMAIL_CAR_ICON_URL` environment variable.

### Configuration Priority

The system will use the car icon URL in this order:

1. `EMAIL_CAR_ICON_URL` environment variable (highest priority)
2. S3 URL (if `S3_BUCKET_NAME` and `AWS_REGION` are configured)
3. Production URL (if `PRODUCTION_URL` is configured)
4. Empty string (will show broken image, but won't crash)

### Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_CAR_ICON_URL` | Direct URL to the car icon | `https://example.com/car-icon.svg` |
| `S3_BUCKET_NAME` | AWS S3 bucket name | `my-email-assets` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `PRODUCTION_URL` | Production website URL | `https://wegoo.com` |

### Testing

After configuration, send a test email and verify:
- The car icon appears in the header
- The image is not blocked by email clients
- The image loads correctly in Gmail, Outlook, and other major email clients