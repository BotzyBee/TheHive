import crypto from 'crypto';
import dotenv from 'dotenv';
import axios from 'axios';
import { Ok, Err } from './helperFunctions.js';

/**
 * Generates a Google Access Token using Service Account Credentials
 */
export async function getGoogleAccessToken() {
    dotenv.config({ path: '.env' });
    const clientEmail = process.env.G_CLIENT_EMAIL;
    // Replace literal '\n' strings with actual newlines if stored in ENV
    const privateKey = process.env.G_PRIVATE_KEY.replace(/\\n/g, '\n');
    
    const oauthUrl = "https://oauth2.googleapis.com/token";

    // 1. Create the JWT Header
    const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
    const encodedHeader = Buffer.from(header).toString('base64url');

    // 2. Create the Claim Set (Payload)
    const now = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
        iss: clientEmail,
        scope: "https://www.googleapis.com/auth/calendar",
        aud: oauthUrl,
        exp: now + 3600, // Token expires in 1 hour
        iat: now
    });
    const encodedPayload = Buffer.from(payload).toString('base64url');

    // 3. Sign the JWT using RS256
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${encodedHeader}.${encodedPayload}`);
    const signature = signer.sign(privateKey, 'base64url');

    const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;

    // 4. Exchange JWT for Access Token via Axios
    try {
        const response = await axios({
            method: 'POST',
            url: oauthUrl,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
        });

        return Ok(response.data.access_token);
    } catch (error) {
        const errorDetail = error.response?.data?.error_description || error.message;
        return Err(`Error (getGoogleAccessToken) : Failed to exchange JWT for token: ${errorDetail}`);
    }
}