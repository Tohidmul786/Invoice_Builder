import { useState } from "react";

const SYSTEM_PROMPT = `You are an invoice data extraction assistant. 
The user will describe an invoice in natural language (in English, Hindi, or Hinglish).
Extract the invoice details and return ONLY a valid JSON object with no extra text, no markdown, no explanation.

The JSON must follow this exact structure:
{
  "client": {
    "name": "string or null",
    "email": "string or null", 
    "phone": "string or null",
    "address": "string or null"
  },
  "items": [
    {
      "description": "string",
      "quantity": number,
      "unit_price": number
    }
  ],
  "meta": {
    "invoiceNo": "string or null",
    "notes": "string or null",
    "dueDate": "YYYY-MM-DD or null"
  }
}

Rules:
- All prices should be numbers only (no ₹ or Rs symbol)
- If quantity is not mentioned, default to 1
- If due date is mentioned as "15 days" or "next week", calculate from today
- If a field is not mentioned, set it to null
- Items must always be an array, even if only one item
- Return ONLY the JSON, nothing else`;

export default function AIAssistant({ onFill }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || "";

      // Strip any accidental markdown fences
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      onFill({
        client: parsed.client || null,
        items: parsed.items?.map((item) => ({
          id: crypto.randomUUID(),
          description: item.description || "",
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
        })) || null,
        meta: parsed.meta || null,
      });

      setSuccess(true);
      setPrompt("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError("Couldn't understand that. Try being more specific, e.g. 'Invoice for Rahul, web design ₹15000'");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  }

  return (
    <div className="rounded-xl border-2 border-brand-100 bg-brand-50 p-5">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-brand-700">AI Auto-fill</p>
          <p className="text-xs text-brand-500">Describe the invoice in one line — AI fills the form</p>
        </div>
      </div>

      {/* Example prompts */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[
          "Rahul Sharma, 9876543210, web design ₹15000, hosting ₹2000",
          "VIDUSHI WIRES, courier ₹200, fuel hose pipe ₹1300",
          "Client: ABC Ltd, 3 units logo design at 5000 each, due in 15 days",
        ].map((example) => (
          <button
            key={example}
            onClick={() => setPrompt(example)}
            className="rounded-full border border-brand-200 bg-white px-2.5 py-0.5 text-xs text-brand-600 hover:bg-brand-100"
          >
            {example.length > 40 ? example.slice(0, 40) + "…" : example}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          className="input-field flex-1 resize-none"
          rows={2}
          placeholder="e.g. Invoice for Priya Telecom, phone 9876543210, 2 units of network setup at ₹8000 each, payment due in 7 days"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="btn-primary self-end px-5"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Filling…
            </span>
          ) : "Fill →"}
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
      {success && (
        <p className="mt-2 text-xs font-medium text-emerald-600">
          ✓ Form filled! Review the details below and make any changes.
        </p>
      )}

      <p className="mt-2 text-xs text-brand-400">
        Works in English, Hindi, or Hinglish. Press Enter to submit.
      </p>
    </div>
  );
}
