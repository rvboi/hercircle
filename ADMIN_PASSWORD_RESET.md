# How to Reset Admin Password

Since you have forgotten the password for `admin@hercircle.com` and the application uses Supabase for authentication, you can reset the password directly through the Supabase Dashboard.

## Option 1: Reset via Supabase Dashboard (Recommended)

1.  **Log in to Supabase**: Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and log in to your account.
2.  **Select Project**: Open the project associated with **HerCircle**.
3.  **Go to Authentication**: Click on the **Authentication** icon in the left sidebar (it looks like a users icon).
4.  **Users List**: You will see a list of all registered users. Find `admin@hercircle.com` in the list.
5.  **Reset Password**:
    *   Click the **three dots (...)** menu on the right side of the user row.
    *   Select **Send password reset** (this sends an email if SMTP is set up).
    *   **OR** (Easier for development): If you just want to set it manually:
        *   There isn't a direct "Set Password" button in the UI for security reasons.
        *   **However**, you can **Delete** the user and sign them up again with a new password from your app (if your app supports admin signup).
        *   **Alternatively**, use the **SQL Editor** to update the password directly (Advanced).

## Option 2: Update Password via SQL (Advanced)

If you are comfortable with SQL, you can force a password update directly in the database.

1.  Go to the **SQL Editor** in your Supabase Dashboard.
2.  Run the following query (Replace `NEW_PASSWORD` with your desired password):

```sql
UPDATE auth.users
SET encrypted_password = crypt('NEW_PASSWORD', gen_salt('bf'))
WHERE email = 'admin@hercircle.com';
```

3.  Click **Run**.
4.  Now try logging in with `admin@hercircle.com` and the new password.

## Option 3: Implement "Forgot Password" in App

If you want to allow users to reset passwords via email in the future:

1.  Ensure you have **SMTP** configured in Supabase (Settings -> Auth -> SMTP Settings).
2.  We can add a "Forgot Password" button in the app that calls:
    ```javascript
    await supabase.auth.resetPasswordForEmail('admin@hercircle.com', {
      redirectTo: 'https://your-app-link/reset-password',
    })
    ```
