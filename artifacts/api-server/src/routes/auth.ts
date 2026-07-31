import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

const router = Router();

// Middleware to verify Supabase JWT token
async function verifyToken(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: "No authorization token provided" });
    return null;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return null;
    }
    return user;
  } catch (err) {
    logger.error({ err }, "Token verification error");
    res.status(401).json({ error: "Token verification failed" });
    return null;
  }
}

// Admin login - sign in with Supabase Auth and return token
router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (error) {
      logger.warn({ email, error: error.message }, "Admin login failed");
      res.status(401).json({ error: error.message || "Invalid credentials" });
      return;
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, email, role")
      .eq("id", data.user.id)
      .single();

    // Return token and user data
    res.json({
      data: {
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: profile?.name || data.user.email?.split('@')[0],
          role: profile?.role || "member",
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "Admin login error");
    res.status(500).json({ error: "Login failed" });
  }
});

// Refresh token endpoint
router.post("/auth/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: "Refresh token is required" });
      return;
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    res.json({
      data: {
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
      },
    });
  } catch (err) {
    logger.error({ err }, "Token refresh error");
    res.status(500).json({ error: "Token refresh failed" });
  }
});

// Complete registration — save all onboarding data to Supabase
router.post("/auth/complete-registration", async (req: Request, res: Response) => {
  try {
    const user = await verifyToken(req, res);
    if (!user) return;

    const {
      name, phone, email,
      gender, date_of_birth, address, state, lga,
      id_type, id_number, staff_id,
      occupation, employer_name, employment_type, employer_staff_id, work_address, years_of_employment,
      monthly_amount, contribution_method, preferred_payment_day,
      nok_name, nok_relationship, nok_phone, nok_address,
      contribution_type, bank_name, bank_code, account_number, account_name, account_type, bvn, nin
    } = req.body;

    // Build profile data
    const profileData: Record<string, any> = {
      id: user.id,
      email: user.email,
      updated_at: new Date().toISOString(),
      registration_completed: true,
      completed_at: new Date().toISOString(),
    };

    // Add optional fields if provided
    if (name) profileData.name = name;
    if (phone) profileData.phone = phone;
    if (gender) profileData.gender = gender;
    if (date_of_birth) profileData.date_of_birth = date_of_birth;
    if (address) profileData.address = address;
    if (state) profileData.state = state;
    if (lga) profileData.lga = lga;
    if (id_type) profileData.id_type = id_type;
    if (id_number) profileData.id_number = id_number;
    if (staff_id) profileData.staff_id = staff_id;
    if (occupation) profileData.occupation = occupation;
    if (employer_name) profileData.employer_name = employer_name;
    if (employment_type) profileData.employment_type = employment_type;
    if (employer_staff_id) profileData.employer_staff_id = employer_staff_id;
    if (work_address) profileData.work_address = work_address;
    if (years_of_employment) profileData.years_of_employment = years_of_employment;
    if (monthly_amount) profileData.monthly_amount = parseFloat(monthly_amount);
    if (contribution_method) profileData.contribution_method = contribution_method;
    if (preferred_payment_day) profileData.preferred_payment_day = parseInt(preferred_payment_day);
    if (nok_name) profileData.nok_name = nok_name;
    if (nok_relationship) profileData.nok_relationship = nok_relationship;
    if (nok_phone) profileData.nok_phone = nok_phone;
    if (nok_address) profileData.nok_address = nok_address;
    if (contribution_type) profileData.contribution_type = contribution_type;
    if (bank_name) profileData.bank_name = bank_name;
    if (bank_code) profileData.bank_code = bank_code;
    if (account_number) profileData.account_number = account_number;
    if (account_name) profileData.account_name = account_name;
    if (account_type) profileData.account_type = account_type;
    if (bvn) profileData.bvn = bvn;
    if (nin) profileData.nin = nin;

    // Upsert to profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' });

    if (profileError) {
      logger.error({ error: profileError.message }, "Failed to save profile");
      res.status(500).json({ error: "Failed to save registration data" });
      return;
    }

    // Save to kyc_submissions table for admin dashboard
    await supabase
      .from('kyc_submissions')
      .insert({
        profile_id: user.id,
        email: user.email,
        data: req.body,
        submitted_at: new Date().toISOString(),
        status: 'pending',
      });

    logger.info({ userId: user.id }, "Registration completed successfully");
    res.json({ 
      success: true, 
      message: "Registration completed successfully",
      data: { completed: true }
    });
  } catch (error) {
    logger.error({ error }, "Complete registration error");
    res.status(500).json({ error: "Failed to complete registration" });
  }
});

// Check registration completion status
router.get("/auth/complete-registration/status", async (req: Request, res: Response) => {
  try {
    const user = await verifyToken(req, res);
    if (!user) return;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('registration_completed, completed_at')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error({ error: error.message }, "Failed to fetch registration status");
      res.status(500).json({ error: "Failed to check registration status" });
      return;
    }

    const completed = profile?.registration_completed === true;
    res.json({
      data: {
        completed,
        completedAt: profile?.completed_at || null
      }
    });
  } catch (error) {
    logger.error({ error }, "Registration status check error");
    res.json({ data: { completed: false } }); // Fail gracefully
  }
});

// Sync user profile — called after Supabase auth to ensure profile exists
router.post("/auth/sync", async (req: Request, res: Response) => {
  try {
    const user = await verifyToken(req, res);
    if (!user) return;

    // Get or create profile
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error({ error: fetchError.message }, "Failed to fetch profile");
      res.status(500).json({ error: "Failed to sync user" });
      return;
    }

    // Get user metadata from Supabase Auth
    const meta = user.user_metadata || {};
    
    const profileData = {
      id: user.id,
      email: user.email,
      name: meta.name || existingProfile?.name || user.email?.split('@')[0] || 'User',
      phone: meta.phone || existingProfile?.phone || null,
      created_at: existingProfile?.created_at || user.created_at,
      updated_at: new Date().toISOString(),
      registration_completed: existingProfile?.registration_completed || false,
    };

    // Upsert profile
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' });

    if (upsertError) {
      logger.error({ error: upsertError.message }, "Failed to sync profile");
      // Don't fail the request, just return user data
    }

    // Return user data matching mobile app expectations
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: profileData.name,
        phone: profileData.phone,
        isEmailVerified: user.email_confirmed_at !== null,
        kycStatus: existingProfile?.kyc_status || 'pending',
        registrationCompleted: profileData.registration_completed,
        createdAt: profileData.created_at,
      }
    });
  } catch (error) {
    logger.error({ error }, "Sync error");
    res.status(500).json({ error: "Failed to sync user" });
  }
});

// Get current user profile
router.get("/auth/me", async (req: Request, res: Response) => {
  try {
    const user = await verifyToken(req, res);
    if (!user) return;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error({ error: error.message }, "Failed to fetch profile");
      res.status(500).json({ error: "Failed to get user profile" });
      return;
    }

    const meta = user.user_metadata || {};
    
    res.json({
      id: user.id,
      email: user.email,
      name: profile?.name || meta.name || user.email?.split('@')[0] || 'User',
      phone: profile?.phone || meta.phone || null,
      gender: profile?.gender || null,
      date_of_birth: profile?.date_of_birth || null,
      address: profile?.address || null,
      state: profile?.state || null,
      lga: profile?.lga || null,
      id_type: profile?.id_type || null,
      id_number: profile?.id_number || null,
      occupation: profile?.occupation || null,
      employer_name: profile?.employer_name || null,
      employment_type: profile?.employment_type || null,
      monthly_amount: profile?.monthly_amount || null,
      contribution_type: profile?.contribution_type || null,
      nok_name: profile?.nok_name || null,
      nok_relationship: profile?.nok_relationship || null,
      nok_phone: profile?.nok_phone || null,
      nok_address: profile?.nok_address || null,
      registration_completed: profile?.registration_completed || false,
      kyc_status: profile?.kyc_status || 'pending',
      isEmailVerified: user.email_confirmed_at !== null,
      createdAt: user.created_at,
      updatedAt: profile?.updated_at || user.updated_at,
    });
  } catch (error) {
    logger.error({ error }, "Get user error");
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

// Request password reset — called by mobile app
router.post("/auth/request-password-reset", async (req: Request, res: Response) => {
  try {
    const { email, type } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    // Determine redirect URL based on client type
    // Mobile app: coopvest://reset-password
    // Web dashboard: https://admin-dashboard-api-server.vercel.app/reset-password
    const redirectTo = type === 'mobile' 
      ? "coopvest://reset-password"
      : `${process.env.DASHBOARD_URL || 'https://admin-dashboard-api-server.vercel.app'}/reset-password`;

    // Call Supabase to send the password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      logger.error({ error: error.message, email }, "Password reset request failed");
      // Always return success to prevent email enumeration
      // Even if user doesn't exist, we return success
    }

    // Always return success to prevent email enumeration attacks
    res.json({
      success: true,
      message: "If an account exists with this email, a password reset link has been sent.",
    });
  } catch (error) {
    logger.error({ error }, "Password reset request error");
    // Still return success for security
    res.json({
      success: true,
      message: "If an account exists with this email, a password reset link has been sent.",
    });
  }
});

// Verify OTP for password reset — called by mobile app
router.post("/auth/verify-otp", async (req: Request, res: Response) => {
  try {
    const { token, email, newPassword } = req.body;

    if (!token) {
      res.status(400).json({ error: "Token is required" });
      return;
    }

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    // Verify OTP using Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token,
      type: "recovery",
    });

    if (error) {
      logger.error({ error: error.message }, "OTP verification failed");
      res.status(400).json({ error: "Invalid or expired code" });
      return;
    }

    // If new password provided, update it
    if (newPassword && data.user) {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        logger.error({ error: updateError.message }, "Password update failed");
        res.status(400).json({ error: "Failed to update password" });
        return;
      }
    }

    res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    logger.error({ error }, "OTP verification error");
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;