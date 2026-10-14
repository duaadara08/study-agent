import "dotenv/config"; // reads my env file 
import fs from "fs"; //lets code read files on my computer
import {GoogleGenAI} from "@google/genai";//brings library thta knows how to talk to Gemini API

const ai = new GoogleGenAI ({apikey: process.env.GEMINI_API_KEY});//creates object ai - we give it our API key -Use ai whenever we want to talk to our model 

//incase the model is busy we can retry a few times before giving up

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



function readFile(path) {//takes a file path, tries to read that file as text, and returns the contents
    try{
        return fs.readFileSync(path,"utf-8");
    }
    catch(err){
        return `Error reading file: ${err.message}`;

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
          },                    // properties closes here
          required: ["path"],   // required sits next to properties
        },
      },
    ],
  },
];


//okay so basically its for the model it doenst run this part this just helps the model understand what it can do and how to do it. like the name read file and the description and the parameters it needs to run it.and one input which is path it is mandatory (ALL OF THIS IS BASICALLY JUST DATA NOT ANYTHIGN TO RUN )
//this can have multiple things like our first is read file the second could be search web third could be save note 

//The model itself remembers nothing. The list is the memory, and you carry it for the model.It’s a list stored on your computer, and it holds the conversation so far. At the start it has one entry, your question:

const contents = [
    {role:"user",parts:[{text:"Summarize my notes in notes.txt"}]},
];
//Turn the two calls into a loop. One generate call inside a while loop that repeats until the model stops asking for tools. This lets the agent make as many tool calls as it needs.
//so we have a loop because we dont want to run the model once but multiple times where the user can ask multiple questions so  what we changes is we added a while loop that keeps on running till no tool request each loop it sends the whole contents list ,so the model can see evrything happened so far on lap 1 its just my question on seocnd lap its my question plus the models tool request plus the text file 
while(true){
    const response = await generate({
        model:"gemini-3.5-flash-lite",
        contents:contents,
        config:{tools},
    });
// no tool request means the model is done: print the answer and stop 
//If the condition is true (no tool request): run the code inside the braces. Print the answer, then break leaves the loop and the program ends.
//If the condition is false (there is a tool request): skip everything inside the braces and continue to the lines below, which run the tool and add the result to contents. Then the loop goes back to the top for another lap.
    if(!response.functionCalls){
        console.log(response.text);
        break;}

    

    //model wants the tool:save the original reply like we did previously 

     contents.push(response.candidates[0].content);

     //we take the models request and run the ral function with the path it gave 
const call=response.functionCalls[0];
const fileText=readFile(call.args.path);


contents.push({ role:"user",
    parts:[
        {
            functionResponse:{
                name:call.name,
                response:{result:fileText},
            },
        },
    ],
});
}