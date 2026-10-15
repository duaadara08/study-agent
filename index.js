import "dotenv/config"; 
import fs from "fs"; 
import {GoogleGenAI} from "@google/genai";
import readline from "readline/promises";

const ai = new GoogleGenAI ({apiKey: process.env.GEMINI_API_KEY});//creates object ai - we give it our API 

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });


async function generate(request) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await ai.models.generateContent(request);
    } catch (err) {
      if (err.status !== 503 || attempt === 5) throw err;
      console.log(`503, retrying in ${attempt * 3}s (attempt ${attempt})`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
}





function readFile(path) {
    try{
        return fs.readFileSync(path,"utf-8");
    }
    catch(err){
        return `Error reading file: ${err.message}`;

    }
}



function saveNote(filename, content) {
  try {
    fs.writeFileSync(filename, content);
    return `Saved to ${filename}`;
  } catch (err) {
    return `Error: could not save file (${err.message})`;
  }
}


const tools = [
  {
    functionDeclarations: [
      {
        name: "read_file",
        description: "Read the text contents of a file on the user's computer",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "The path to the file to read" },
          },
          required: ["path"],
        },
      },
      {
        name: "save_note",
        description: "Save text to a file on the user's computer. Creates the file, or replaces it if it already exists.",
        parameters: {
          type: "object",
          properties: {
            filename: { type: "string", description: "Name of the file to save to, e.g. summary.txt" },
            content: { type: "string", description: "The text to write into the file" },
          },
          required: ["filename", "content"],
        },
      },
    ],
  },
];





const contents = [];   // memory starts empty, no hardcoded question

while (true) {   // OUTER loop: keeps the chat going until you type "exit"

  const question = await rl.question("You: ");   // wait for you to type
  if (question === "exit") break;                // "exit" ends the chat

  contents.push({ role: "user", parts: [{ text: question }] });   // add your question to memory(pushes into content)

  while (true) {   // INNER loop: runs until the model stops asking for tools

    const response = await generate({
      model: "gemini-3.5-flash-lite",
      contents: contents,
      config: {
        tools,
        systemInstruction:
          "You are a study assistant. Always read a file with read_file before summarizing or quizzing on it, even if you read it earlier, because it may have changed. If a request is outside what your tools can do, say so honestly instead of guessing.",
      },
    });

    if (!response.functionCalls) {
      console.log("Agent:", response.text);   // final answer
      break;                                   // leaves the INNER loop only
    }

    contents.push(response.candidates[0].content);   // save the model's tool request first before we saved the question now we save the tools needed

    const call = response.functionCalls[0];//this is a list for tools like in a question how many tools are are asked for which ones are asked for and call holds one request 
    console.log("Tool called:", call.name);
    //this just shows which tools run 

    let result;
    if (call.name === "read_file") {
      result = readFile(call.args.path);
    } else if (call.name === "save_note") {
      result = saveNote(call.args.filename, call.args.content);
    } else {
      result = `Error: unknown tool ${call.name}`;
    }

    contents.push({//results are pushed into content 
      role: "user",
      parts: [
        {
          functionResponse: {
            name: call.name,
            response: { result: result },
          },
        },
      ],
    });

  }   // end of INNER loop

}   // end of OUTER loop

rl.close();   // close the input so the program can exit

     




/*Summary of code 
START
  |
  v
OUTER LOOP begins
  |
  1. Ask "You:" and wait for you to type
  2. If you typed "exit" -> leave, go to the END
  3. Push your question into contents (memory)
  |
  v
  INNER LOOP begins
    |
    4. Call the model with ALL of contents
    5. Did the model ask for a tool?
         NO  -> print "Agent: ..." and break out of the inner loop
                (go back to step 1 for your next question)
         YES -> continue to step 6
    6. Push the model's tool request into contents
    7. Run the tool you asked for (readFile or saveNote)
    8. Push the tool's result into contents
    9. Go back to step 4 (the model now sees the result)
  |
  v
OUTER LOOP repeats from step 1
  |
  v
END: rl.close() and the program exits
*/