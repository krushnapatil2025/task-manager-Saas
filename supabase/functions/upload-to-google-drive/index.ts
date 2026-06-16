// supabase/functions/upload-to-google-drive/index.ts
// Secure Edge Function to upload files to a centralized Google Drive folder.
// Uses Google Service Account JWT auth.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Load Service Account JSON from Environment Secret
    const serviceAccountKeyStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
    const parentFolderId = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID')

    if (!serviceAccountKeyStr) {
      return new Response(JSON.stringify({
        error: 'GOOGLE_SERVICE_ACCOUNT_KEY env secret is not configured in Supabase.',
        simulated: true
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const serviceAccount = JSON.parse(serviceAccountKeyStr)

    // 1. Generate Google Auth Access Token using JWT
    const jwtHeader = { alg: 'RS256', typ: 'JWT' }
    const now = Math.floor(Date.now() / 1000)
    const jwtClaim = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    }

    // Sign JWT using the RS256 algorithm and the Service Account Private Key
    // (In standard Deno, we use Web Crypto API to import and sign RS256)
    const privateKeyPEM = serviceAccount.private_key.replace(/\\n/g, '\n')
    const token = await signJWT(jwtHeader, jwtClaim, privateKeyPEM)

    // 2. Fetch OAuth Token from Google
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token
      })
    })

    const tokenData = await tokenRes.json()
    if (tokenData.error) {
      throw new Error(`Google Auth error: ${tokenData.error_description || tokenData.error}`)
    }

    const accessToken = tokenData.access_token

    // 3. Upload File to Google Drive
    // Metadata including filename and folder
    const metadata: Record<string, any> = {
      name: file.name,
      mimeType: file.type
    }
    if (parentFolderId) {
      metadata.parents = [parentFolderId]
    }

    // Multipart upload request
    const uploadBoundary = 'foo_bar_boundary'
    const multipartBody = new Uint8Array([
      ...new TextEncoder().encode(`--${uploadBoundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${uploadBoundary}\r\nContent-Type: ${file.type}\r\n\r\n`),
      new Uint8Array(await file.arrayBuffer()),
      ...new TextEncoder().encode(`\r\n--${uploadBoundary}--`)
    ])

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${uploadBoundary}`
      },
      body: multipartBody
    })

    const uploadData = await uploadRes.json()
    if (uploadData.error) {
      throw new Error(`Google Drive Upload failed: ${uploadData.error.message}`)
    }

    const fileId = uploadData.id

    // 4. Update File Permissions to Reader for Anyone With Link
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    })

    // Return direct web view & download links
    return new Response(JSON.stringify({
      fileId,
      name: file.name,
      webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
      webContentLink: `https://drive.google.com/uc?id=${fileId}&export=download`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Helper to sign JWT using RS256 in Deno (Web Crypto API)
async function signJWT(header: any, payload: any, pem: string): Promise<string> {
  const enc = new TextEncoder()
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const content = `${encodedHeader}.${encodedPayload}`

  // Parse private key PEM
  const pemHeader = "-----BEGIN PRIVATE KEY-----"
  const pemFooter = "-----END PRIVATE KEY-----"
  const pemContents = pem.substring(pemHeader.length, pem.length - pemFooter.length).replace(/\s/g, "")
  const binaryDerString = atob(pemContents)
  const binaryDer = new Uint8Array(binaryDerString.length)
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i)
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(content)
  )

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  return `${content}.${encodedSignature}`
}
