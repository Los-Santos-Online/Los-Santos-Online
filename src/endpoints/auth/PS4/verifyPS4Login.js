import { prisma, sendLogMessage } from "../../../main.js";
import { generateRandomShit } from "../../../utils/account/createAccount.js";

// Rate limiting - store attempt counts per IP/console ID
const verificationAttempts = new Map();
const MAX_ATTEMPTS = 100; // Maximum attempts per time window
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

/**
 * Track and check verification attempts for rate limiting
 * @param {string} identifier - IP address or console ID to track
 * @returns {boolean} - True if attempts are within limits, false if rate limited
 */
function checkRateLimit(identifier) {
  const now = Date.now();
  
  // Get or create the attempt record
  if (!verificationAttempts.has(identifier)) {
    verificationAttempts.set(identifier, {
      count: 0,
      firstAttempt: now,
      lastAttempt: now
    });
  }
  
  const record = verificationAttempts.get(identifier);
  
  // Reset if outside the window
  if (now - record.firstAttempt > ATTEMPT_WINDOW) {
    record.count = 0;
    record.firstAttempt = now;
  }
  
  // Update the attempt count and timestamp
  record.count++;
  record.lastAttempt = now;
  
  // Check if over the limit
  if (record.count > MAX_ATTEMPTS) {
    return false;
  }
  
  return true;
}

/**
 * Handler for PS4 login verification
 * 
 * Expected request body:
 * - token: User authentication token
 * - consoleId: PS4 user identifier
 * 
 * Response matches C++ LoginResponse struct:
 * - status: "success" or "error"
 * - code: Error code (empty on success)
 * - username: PS4 username
 * - rockstarId: User's Rockstar ID
 * - loginCode: Generated login code
 */
export async function verifyPS4Login(req, res) {
  try {
    const { token, consoleId } = req.body;
    console.log(req.body);
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // Basic validation
    if (!token || !consoleId) {
      return res.status(200).json({
        status: "error",
        code: "INVALID_PARAMETERS",
        username: "",
        rockstarId: 0,
        loginCode: ""
      });
    }
    
    // Check rate limiting by IP and console ID
    if (!checkRateLimit(clientIp) || !checkRateLimit(consoleId)) {
      await sendLogMessage(`Rate limited PS4 login verification attempt from IP: ${clientIp}, Console ID: ${consoleId}`);
      return res.status(200).json({
        status: "error",
        code: "RATE_LIMITED",
        username: "",
        rockstarId: 0,
        loginCode: ""
      });
    }
    
    // Find user by token
    let user = await prisma.user.findFirst({
      where: {
        PS4AccessCode: token
      }
    });

    if (!user) {
      await sendLogMessage(`Failed PS4 login verification attempt with invalid token: ${token.substring(0, 10)}...`);
      return res.status(200).json({
        status: "error",
        code: "INVALID_TOKEN",
        username: "",
        rockstarId: 0,
        loginCode: ""
      });
    }

    // Generate new login code
    user = await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        PS4LoginCode: generateRandomShit(10)
      }
    });
    
    // Check if user is banned
    if (user.banned) {
      await sendLogMessage(`PS4 login verification attempt by banned user ${user.RockstarId}`);
      return res.status(200).json({
        status: "error",
        code: "USER_BANNED",
        username: "",
        rockstarId: 0,
        loginCode: ""
      });
    }
    
    // Check if the console ID is associated with this user
    if (user.PS4ConsoleId && user.PS4ConsoleId !== consoleId) {
      await sendLogMessage(`PS4 login verification attempt with mismatched console ID for user ${user.RockstarId}`);
      return res.status(200).json({
        status: "error",
        code: "CONSOLE_MISMATCH",
        username: "",
        rockstarId: 0,
        loginCode: ""
      });
    }
    
    // Update user's console ID if not set
    if (!user.PS4ConsoleId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { PS4ConsoleId: consoleId }
      });
    }
    
    // Get PS4 Username - use default if not set
    const username = user.PS4Username || `User${user.RockstarId}`;
    
    // Log successful verification
    await sendLogMessage(`Successful PS4 login verification for user ${user.RockstarId} (${username})`);
  
    // Return successful login response
    return res.status(200).json({
      status: "success",
      code: "",
      username: username,
      rockstarId: user.RockstarId,
      loginCode: user.PS4LoginCode
    });
    
  } catch (error) {
    console.error("PS4 login verification error:", error);
    await sendLogMessage(`PS4 login verification error: ${error.message}`);
    
    return res.status(200).json({
      status: "error",
      code: "SERVER_ERROR",
      username: "",
      rockstarId: 0,
      loginCode: ""
    });
  }
}
