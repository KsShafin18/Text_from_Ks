import { get, put } from "@vercel/blob";

const textPath = "text/current.txt";
const maxTextLength = 100_000;
const storageSetupError =
    "Vercel Blob is not connected. In your Vercel project, open Storage, connect a Blob store, then redeploy.";
const storageAccessError =
    "Could not access Vercel Blob. Confirm the Blob store is connected to this project for the Production environment, then redeploy.";

function hasBlobCredentials() {
    return Boolean(
        process.env.BLOB_READ_WRITE_TOKEN ||
        (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)
    );
}

function jsonResponse(body, status = 200) {
    return Response.json(body, {
        status,
        headers: { "Cache-Control": "no-store" }
    });
}

export default {
    async fetch(request) {
        if (request.method === "GET") {
            if (!hasBlobCredentials()) {
                return jsonResponse({ error: storageSetupError }, 503);
            }

            try {
                const blob = await get(textPath, { access: "private", useCache: false });
                if (!blob || blob.statusCode === 404) {
                    return new Response("", {
                        headers: {
                            "Content-Type": "text/plain; charset=utf-8",
                            "Cache-Control": "no-store",
                            "X-Content-Type-Options": "nosniff"
                        }
                    });
                }

                if (blob.statusCode !== 200 || !blob.stream) {
                    return jsonResponse({ error: "Could not load text." }, 500);
                }

                return new Response(blob.stream, {
                    headers: {
                        "Content-Type": "text/plain; charset=utf-8",
                        "Cache-Control": "no-store",
                        "X-Content-Type-Options": "nosniff"
                    }
                });
            } catch (error) {
                console.error("Could not read the text from Vercel Blob.", error);
                return jsonResponse({ error: storageAccessError }, 503);
            }
        }

        if (request.method !== "POST") {
            return jsonResponse({ error: "Method not allowed." }, 405);
        }

        if (!hasBlobCredentials()) {
            return jsonResponse({ error: storageSetupError }, 503);
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: "Invalid request." }, 400);
        }

        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return jsonResponse({ error: "Invalid request." }, 400);
        }

        if (typeof body.text !== "string") {
            return jsonResponse({ error: "Text must be a string." }, 400);
        }

        if (body.text.length > maxTextLength) {
            return jsonResponse({ error: `Text must be ${maxTextLength} characters or fewer.` }, 413);
        }

        try {
            await put(textPath, body.text, {
                access: "private",
                allowOverwrite: true,
                contentType: "text/plain; charset=utf-8"
            });
            return jsonResponse({ success: true });
        } catch (error) {
            console.error("Could not save the text to Vercel Blob.", error);
            return jsonResponse({ error: storageAccessError }, 503);
        }
    }
};
