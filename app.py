from flask import Flask, request, Response, render_template, stream_with_context, jsonify
from flask_cors import CORS
import json
import os
from dotenv import load_dotenv
load_dotenv()

from groq import Groq

app = Flask(__name__)
CORS(app)

# =========================
# CONFIG
# =========================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY environment variable not set.")

client = Groq(api_key=GROQ_API_KEY)

MODEL_NAME = os.getenv("MODEL_NAME")


# =========================
# ROUTES
# =========================

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = data.get("message", "").strip()
    history = data.get("history", [])

    if not user_message:
        return Response("No message provided", status=400)

    messages = [
        {
            "role": "system",
            "content": (
                "You are DeepKul-AI, a helpful and professional AI assistant. "
                "Answer clearly, accurately, and in a structured way. "
                "Use simple language when needed."
            )
        }
    ]

    # Optional chat history support
    for msg in history[-6:]:
        role = msg.get("role", "")
        content = msg.get("content", "")

        if not content:
            continue

        if role == "bot" or role == "assistant":
            messages.append({"role": "assistant", "content": content})
        elif role == "user":
            messages.append({"role": "user", "content": content})

    messages.append({"role": "user", "content": user_message})

    def generate():
        try:
            response = client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages,
                temperature=0.5,
                max_tokens=2048,
                stream=True
            )

            for chunk in response:
                content = chunk.choices[0].delta.content
                if content:
                    yield f"data: {json.dumps({'token': content})}\n\n"

            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            print("Chat error:", e)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


@app.route("/upload", methods=["POST"])
def upload():
    return jsonify({
        "success": False,
        "message": "File upload/RAG is disabled in online deployment mode."
    }), 400


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "model": MODEL_NAME,
        "mode": "groq-only"
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, threaded=True, debug=False)