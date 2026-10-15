import "dotenv/config"; 
import fs from "fs"; 
import {GoogleGenAI} from "@google/genai";
import readline from "readline/promises";//module in node lets your program read what you type in the terminal one line at a time promises means function work with await so code can pause until u press enter 
import nodePath from "path";//path module in node helps working with file paths such as joining folder and file names 


const ai = new GoogleGenAI ({apiKey: process.env.GEMINI_API_KEY});//creates object ai - we give it our API 

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });//creates connection that actually doe sthe reading listens to keyboard and shows prompt on screen result is stored in rl short for readline


//so basically without the following function the model could go inside index.js file and overwrite it doesnt have any control liek that

const NOTES_DIR=nodePath.resolve("notes");
//resolve turns short name into full address on your computer and we save that as NOTES_DIR
function safePath(filename){
const full=nodePath.resolve(NOTES_DIR,filename);

if(!full.startsWith(NOTES_DIR+nodePath.sep))
    {
        return null;
    }
return full;
}
/*This is the check. startsWith asks: “does the full address begin with the notes folder’s address?” (nodePath.sep is the \ between folders on Windows.)

...\study-agent\notes\notes.txt starts with ...\study-agent\notes\, so it passes.
...\study-agent\index.js does not, so the guard returns null (meaning “refused”).
if it passed the check return full hands back the safe full address  */



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
    }
    catch(err){
        return `Error reading file: ${err.message}`;

    }
}



function saveNote(filename, content) {
      const full=safePath(filename);
      if (!full) return "Error: access denied. Files must be inside the notes folder.";
  try {
    fs.mkdirSync(NOTES_DIR, { recursive: true });   // make notes/ if it doesn't exist
    fs.writeFileSync(full, content)//makes notes if it doesnt exist
    return `Saved to notes/${filename}`;
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
            path: { type: "string", description: "description: Read a text file from the user's notes folder. Give only the filename, e.g. notes.txt" },//more detailed description so it has less room to guess which file we are talking about 

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

    console.log("Result:", result);

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


