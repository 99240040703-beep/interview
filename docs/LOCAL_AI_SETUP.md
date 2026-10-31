# SkillPath local AI setup (Ollama)

This option runs the language model on your own Windows computer. It does not require OpenAI or Gemini API credits.

## 1. Install and start Ollama

Install Ollama for Windows, then open PowerShell:

```powershell
ollama pull llama3.2:3b
ollama run llama3.2:3b
```

Wait for the model to load. Test a simple prompt, then exit the chat with `/bye`.

## 2. Keep the local model private

The SkillPath website is hosted on Render, so Render cannot call `127.0.0.1` on your computer. You need a secure tunnel to a small authenticated gateway running on your computer.

- The gateway should listen on `127.0.0.1:11435`.
- It should expose `POST /api/chat` and forward requests to the local Ollama service.
- Protect it with a long random bearer token.
- Create a Cloudflare Tunnel to the gateway, not directly to Ollama's unauthenticated port 11434.
- Do not publish port 11434 to the public internet.

## 3. Configure Render

In the SkillPath Render web service, add:

| Environment variable | Value |
| --- | --- |
| `OLLAMA_BASE_URL` | Your HTTPS Cloudflare Tunnel hostname, without a trailing slash |
| `OLLAMA_API_KEY` | The same bearer token configured in your gateway |
| `OLLAMA_MODEL` | `llama3.2:3b` |

Save and redeploy. Keep the bearer token private.

## 4. How the website uses it

Both `/assistant` and `/project-ai` will use this local Ollama provider whenever `OLLAMA_BASE_URL` is configured. Project AI still sends the selected course, module and topic as its project-specific instructions. Chat histories remain separate per project.

Your computer, Ollama, gateway and tunnel must stay running while you use the hosted website. A 3B model is suitable for basic questions and explanations, but it may be slower or less capable than larger cloud models.
