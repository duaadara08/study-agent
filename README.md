# Study Agent

A terminal-based AI study assistant built **from scratch in Node.js, with no agent frameworks**. It uses the Gemini API with tool calling to read and save notes, and I wrote the agent loop myself to learn how agents actually work.

> Learning project. Not a production system.

## What it does

You chat with it in the terminal. It can:

- **Read** a note file from the `notes/` folder and summarize it or quiz you on it
- **Save** text (like a summary) to a new file in `notes/`
- **Remember** the conversation, so follow-ups like "now quiz me on that" work
- Say honestly when a request is outside what its tools can do

## How it works

The model never touches your files. It only *asks* for a tool, and my code does the work.

```
You type a question
        |
        v
Question is added to `contents` (the conversation memory)
        |
        v
  +---> Send the whole `contents` list to Gemini (with tools + system prompt)
  |             |
  |             v
  |     Did the model ask for tools?
  |        NO  -> print the answer, ask for your next question
  |        YES -> run each requested tool (read_file / save_note),
  |               add the results to `contents`
  |             |
  +-------------+   (repeat, up to MAX_STEPS laps)
```

Key ideas:

- **Agent loop:** call the model, run any tools it asks for, send the results back, repeat until it answers in plain text.
- **Memory:** the model remembers nothing between calls, so the full `contents` list is resent every time.
- **Tools are described as data:** each tool has a name, description, and input schema. The model picks from that menu; my code runs the real function.

## Safety and reliability features

- **Sandboxed files:** `safePath()` resolves every filename and refuses anything outside the `notes/` folder (including `../` tricks), so the model can't read `.env` or overwrite code.
- **Step limit:** `MAX_STEPS` caps how many model calls one question can use, so a confused model can't loop forever and burn API quota.
- **Multiple tool calls:** every tool request in a reply is run and answered, so the model never has to guess results.
- **Retry on 503:** if the API is busy, it retries with increasing delays.
- **Safe errors:** tool errors returned to the model are short and don't expose local file paths.

## Tech

- Node.js (ES modules)
- [`@google/genai`](https://www.npmjs.com/package/@google/genai) (Gemini API)
- `dotenv` for the API key

## Setup

**Requirements:** Node.js 18 or higher and a Gemini API key from [Google AI Studio](https://aistudio.google.com).

1. Clone the repo and install dependencies:

   ```bash
   git clone https://github.com/duaadara08/study-agent.git
   cd study-agent
   npm install
   ```

2. Create a file named `.env` in the project folder:

   ```
   GEMINI_API_KEY=your-key-here
   ```

   The `.env` file is in `.gitignore`, so your key is never committed.

3. Put some text files in the `notes/` folder (for example `notes/notes.txt`).

4. Run it:

   ```bash
   node index.js
   ```

Type `exit` to quit.

## Example session

```
You: summarise notes.txt
Tool called: read_file { path: 'notes.txt' }
Agent: Binary search works on sorted arrays and runs in O(log n)...
You: save it
Tool called: save_note { filename: 'summary.txt', ... }
Agent: I saved the summary to summary.txt.
```

  ![Study Agent terminal demo](images/Screenshot%202026-10-16%20014039.png)

## What I learned

- How the agent loop works: the model asks, my code acts, results go back into the conversation.
- Why prompts are suggestions and code is a guarantee (the system prompt can be ignored, the `MAX_STEPS` cap and `safePath` fence cannot).
- The model can claim things that didn't happen, so I log every tool call and result to check what really ran.
- Debugging real API errors: 400 (bad request), 404 (model name), 429 (quota), 503 (busy).

## Roadmap

- [ ] Auto-save summaries to a separate file without overwriting the original
- [ ] Express API so the agent can be called over HTTP
- [ ] React chat UI with file upload
- [ ] Per-user notes folders and conversations
- [ ] Deploy (Render/Vercel, then AWS)

## Project structure

```
study-agent/
├── index.js        # agent loop, tools, safety checks
├── notes/          # the only folder the agent can read and write
├── package.json
└── .env            # your API key (not committed)
```
