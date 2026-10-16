import "dotenv/config"; 
import fs from "fs"; 
import {GoogleGenAI} from "@google/genai";
import readline from "readline/promises";
import nodePath from "path";

const ai = new GoogleGenAI ({apiKey: process.env.GEMINI_API_KEY});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });


const NOTES_DIR=nodePath.resolve("notes");


function safePath(filename){
const full=nodePath.resolve(NOTES_DIR,filename);

if(!full.startsWith(NOTES_DIR+nodePath.sep))
    {
        return null;
    }
return full;
}



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





function readFile(filename) {
    const full=safePath(filename);
     if (!full) return "Error: access denied. Files must be inside the notes folder.";
    try{
        return fs.readFileSync(full,"utf-8");
        } catch (err) {
    console.log("DEBUG:", err.message);   // you see the full error here
    return `Error: could not find or read "${filename}" in the notes folder.`;   // model gets this
  }
}



function saveNote(filename, content) {
      const full=safePath(filename);
      if (!full) return "Error: access denied. Files must be inside the notes folder.";
  try {
    fs.mkdirSync(NOTES_DIR, { recursive: true });   
    fs.writeFileSync(full, content)
    return `Saved to notes/${filename}`;
   } catch (err) {
    console.log("DEBUG:", err.message);   // you see the full error here
    return `Error: could not find or read "${filename}" in the notes folder.`;   
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
            path: { type: "string", description: "Read a text file from the user's notes folder. Give only the filename, e.g. notes.txt" },//more detailed description so it has less room to guess which file we are talking about 

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
            filename: { type: "string", description: "Save text to a file in the user's notes folder. Creates the file, or replaces it if it exists. Give only the filename, e.g. summary.txt" },
            content: { type: "string", description: "The text to write into the file" },
          },
          required: ["filename", "content"],
        },
      },
    ],
  },
];





const contents = [];  
const MAX_STEPS=8;//most laps allowed for one question explanation below  

while (true) {   

  const question = await rl.question("You: ");   
  if (question === "exit") break;               

  contents.push({ role: "user", parts: [{ text: question }] }); 

  let finished= false;//loop assumes not finished yet 
  for( let step=0 ; step<MAX_STEPS ; step++ ) {   

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
      console.log("Agent:", response.text);   
      finished=true;//finished answer found basically
      break;                                  
    }

    contents.push(response.candidates[0].content);   

    const responseParts = [];//empty list as we run each tool.we'll put its result on th e tray 


    //response.functionCalls is a list of tool requests. This line means: “go through the list one item at a time, and call the current item call.” If the model asked for 8 files, the code inside the braces runs 8 times, and call is a different request each time. Before, you only grabbed [0] (the first one) and ignored the rest. Now you handle every one.
    for (const call of response.functionCalls) {
      console.log("Tool called:", call.name, call.args);

      let result;
      if (call.name === "read_file") {
        result = readFile(call.args.path);
      } else if (call.name === "save_note") {
        result = saveNote(call.args.filename, call.args.content);
      } else {
        result = `Error: unknown tool ${call.name}`;
      }

      console.log("Result:", result);

      responseParts.push({
        functionResponse: { name: call.name, response: { result: result } },//this i sthe answer it shows which tool this one answers andanswer itself so if i ask for 8 files read itll read one file at a time and save it each time first one file then the other and then the second 
      });
    }

    contents.push({ role: "user", parts: responseParts });//this part will take the response like the wholeee answer like for al 8 files and save it in contents 

  }   

if(!finished){
  console.log("Agent: I stopped because I hit the step limit. Try rephrasing your question.");
  
}
}   

rl.close();   




/*Remember: one lap = one call to the model. The loop ends early with break when the model gives a final answer.

Example 1: simple question (1 lap)

You: hello

Lap 1: model replies with text, no tool. It prints and breaks.
Total: 1 lap. The cap never matters.

Example 2: read a file (2 laps)

You: summarise notes.txt

Lap 1: model asks for read_file. Your code runs it.
Lap 2: model sees the text and writes the summary. break.
Total: 2 laps.

Example 3: read and save (3 laps)

You: read notes.txt, summarise it, and save it

Lap 1: model asks for read_file.
Lap 2: model asks for save_note.
Lap 3: model says “Done, I saved it.” break.
Total: 3 laps. This is what you saw earlier, with two Tool called: lines.

Example 4: a question that needs many steps (cap matters)

Say you had 10 note files and typed: read notes1.txt to notes10.txt and summarise each one

Laps 1 to 8: model asks for one file per lap, if it asks for one at a time.
The cap of 8 hits. The loop stops before the model writes its final answer.
You’d see the warning message instead of a summary.

This is the “too many tools” case I mentioned. For this project it’s rare, and you can raise the cap if you need to.

Example 5: the model gets stuck (cap saves you)

You: read the file called banana.txt

Lap 1: model asks for read_file with banana.txt. Result: file not found.
Lap 2: model tries banana.text. Not found.
Lap 3: tries Banana.txt. Not found.
Lap 4 to 8: keeps guessing.
Without a cap, it could go on forever. With MAX_STEPS = 8, it stops at lap 8. That’s the seatbelt doing its job.

Example 6: several questions in a row (counter resets)

You: hello                   -> 1 lap   (counter: 0)
You: summarise notes.txt     -> 2 laps  (counter resets to 0)
You: save it                 -> 2 laps  (counter resets to 0)

Each question starts the counter fresh, so asking many questions never triggers the cap. */
/*

finished is a flag: a yes/no note that answers one question: “did the model actually finish answering this question?”

Why we need it

After the inner loop ends, your code can’t tell why it ended. There are two possible reasons:

The model gave its final answer, and break stopped the loop. (Good.)
The loop ran out of laps (hit MAX_STEPS) before the model answered. (Bad.)

From the outside, both look the same: the loop is over. finished is how you tell them apart.*/