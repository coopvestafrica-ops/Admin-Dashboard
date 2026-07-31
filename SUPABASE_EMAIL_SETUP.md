# Supabase Email Configuration Guide

## For Password Reset to Work

### Step 1: Configure Site URL

The password reset needs to know where to redirect after reset.

1. Go to: https://supabase.com/dashboard/project/nyoauzqezpxeonmrxxgi/auth/url-configuration
2. Set:
   - **Site URL**: `https://admin-dashboard-api-server.vercel.app`
   - **Redirect URLs**: `https://admin-dashboard-api-server.vercel.app/*`

### Step 2: Enable Email Provider

1. Go to: https://supabase.com/dashboard/project/nyoauzqezpxeonmrxxgi/auth/providers
2. Find "Email" and ensure it's enabled

### Step 3: Check SMTP Settings (If Needed)

If emails still don't work, configure custom SMTP:

1. Go to: https://supabase.com/dashboard/project/nyoauzqezpxeonmrxxgi/project_settings
2. Find "SMTP Settings" section
3. Configure your email provider (SendGrid, Mailgun, AWS SES, etc.)

## Quick Test

After configuration, test at: https://admin-dashboard-api-server.vercel.app/

Enter email: coopvestafrica@gmail.com
Click "Forgot password?"

The email should arrive within 1-2 minutes.