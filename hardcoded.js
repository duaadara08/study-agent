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











/*const response = await generate({
    model: "gemini-3.5-flash-lite",
    contents:"Summarize my notes in notes.txt",
    config:{tools},
});
// so when the person is chatting with the ai model and asks for summarising the notes so when config tools is run it goes to tools checks which one matches what the user asked for closest is rrad notes so it asks for that if someone says look up what lillies are it will go to search web tool 
//await basically waits for the response back cuz if we dont have await the program will go to the next line without wiaitng for th e answer


const call = response.functionCalls[0];//grabs the first request the model made

if (call.name === "read_file") {//checks which tool it asked for then runs your real readFile with the path model gave
  const fileText = readFile(call.args.path);
//sends the whole conversation so far:your question,the model tools request and the file contects as the tools result.the mdoel has nomemeory between calls so u have to resend each time
  const secondResponse = await generate({
    model: "gemini-3.5-flash-lite",
    contents: [
      { role: "user", parts: [{ text: "Summarize my notes in notes.txt" }] },
     response.candidates[0].content,
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: call.name,
              response: { result: fileText },
            },
          },
        ],
      },
    ],
    config: { tools },
  });

  console.log(secondResponse.text);//actual summary
}


*/

//so the (line 37) it goes to check the tools which one matches what the user asked and waits for google gemini response when the response is back it will be stored in the VARIABLE response the response will basically be "please run read_file with notes.txt".
//(line 46)grabs the model request so the first request the model made is stored in the variable call.which is basically again { name: 'read_file', args: { path: 'notes.txt' } } what the reponse said 
//(line 48) checks which tool it asked for then runs your real readFile with the path model gave

//NOTE:the model does not remember what it was aksed for cuz the repsonse is not stored in model it is local on your computer so you have to define a few things again and why are we writing the model again we just have to everytime we ask fro something 

//(line 49)now the code has read the file and has the text if u  only sent the file tetc the model would have no idea why we are sending it so you hand it the information again that basically containsthe whole thinh what the user originally asked summarise the notes what the model said it wanted which is run read_file on notes.txt  and what came back the actual text from the file

//(line 60)function response:is basically "i ran it here's the result" the model cant run tools so u speak for the tool thats why call.name and repsonse 

//(line 70) so basically this is the actual response from the call one rigth which was saved in response instead of typing out role: "model", parts: [{ functionCall: call }]  we use the response.candidates[0].content which is the same thing but shorter and easier to read and it conatins a signature like a code that google gemini understands 