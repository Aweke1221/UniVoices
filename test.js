import { GoogleGenAI } from "@google/genai";

async function run() {
    try {
        const res = await fetch("http://localhost:3000/api/system/categories");
        const text = await res.text();
        console.log("Categories:", res.status, text.substring(0, 500));
    } catch (e) {
        console.error(e);
    }
}
run();
