import { timingSafeEqual } from "node:crypto";
import { get, put } from "@vercel/blob";

const textPath = "text/current.txt";
const maxTextLength = 100_000;

function jsonResponse(body, status = 200) {
    return Response.json(body, {
        status,
        headers: { "Cache-Control": "no-store" }
    });
}

function passwordMatches(password, expectedPassword) {
    const actual = Buffer.from(password);
    const expected = Buffer.from(expectedPassword);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export default {
    async fetch(request) {
        if (request.method === "GET") {
            try {
                const blob = await get(textPath, { access: "private", useCache: false });
                if (!blob || blob.statusCode === 404) {
                    return jsonResponse({ text: "" });
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
                return jsonResponse({ error: "Could not load text." }, 500);
            }
        }

        if (request.method !== "POST") {
            return jsonResponse({ error: "Method not allowed." }, 405);
        }

        const expectedPassword = process.env.SET_TEXT_PASSWORD;
        if (!expectedPassword) {
            return jsonResponse({ error: "Set the SET_TEXT_PASSWORD environment variable." }, 503);
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

        if (typeof body.password !== "string" || !passwordMatches(body.password, expectedPassword)) {
            return jsonResponse({ error: "Incorrect password." }, 401);
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
            return jsonResponse({ error: "Could not save text. Check the Vercel Blob setup." }, 500);
        }
    }
};
