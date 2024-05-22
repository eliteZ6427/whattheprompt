const fs = require('fs');
const axios = require('axios');
const { measureMemory } = require('vm');
require('dotenv').config();

const data = {
    "prompt": "kung fu panda",
    "negative_prompt": "",
    "styles": [
        ""
    ],
    "seed": -1,
    "subseed": -1,
    "subseed_strength": 0,
    "seed_resize_from_h": -1,
    "seed_resize_from_w": -1,
    "sampler_name": "",
    "batch_size": 1,
    "n_iter": 1,
    "steps": 50,
    "cfg_scale": 7,
    "width": 500,
    "height": 500,
    "restore_faces": true,
    "tiling": false,
    "do_not_save_samples": false,
    "do_not_save_grid": false,
    "eta": 0,
    "denoising_strength": 0,
    "s_min_uncond": 0,
    "s_churn": 0,
    "s_tmax": 0,
    "s_tmin": 0,
    "s_noise": 0,
    "override_settings": {},
    "override_settings_restore_afterwards": true,
    "refiner_checkpoint": "",
    "refiner_switch_at": 0,
    "disable_extra_networks": false,
    "comments": {},
    "enable_hr": false,
    "firstphase_width": 0,
    "firstphase_height": 0,
    "hr_scale": 2,
    "hr_upscaler": "",
    "hr_second_pass_steps": 0,
    "hr_resize_x": 0,
    "hr_resize_y": 0,
    "hr_checkpoint_name": "",
    "hr_sampler_name": "",
    "hr_prompt": "",
    "hr_negative_prompt": "",
    "sampler_index": "Euler",
    "script_name": "",
    "script_args": [],
    "send_images": true,
    "save_images": false,
    "alwayson_scripts": {}
};

const llamaData = {
    "model": "game-host:latest",
    "messages": [
      {
        "role": "user",
        "content": "create a random prompt about an animal, or a celebrity, or an object, or an item, and an adjective, the prompt must less than 8 words, it can be funny, imaginary, or something that defy logic. Only the prompt"
      }
    ]
};


// Function to read banned words from a file
function readBannedWordsFromFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        // Split the file content into an array of words
        return data.trim().split('\n');
    } catch (error) {
        console.error('Error reading file:', error);
        return [];
    }
}

const bannedWords = readBannedWordsFromFile("scripts/words/banned_words.txt");

// Function to check if a string contains any banned words
function containsBannedWords(input) {
    if (bannedWords.length === 0) {
        console.log('No banned words found.');
        return false;
    }

    for (const word of bannedWords) {
        if (input.includes(word)) {
            return true;
        }
    }
    return false;
}

const generateImage = async (prompt, nsfwMode, imageEngine) => {
    if(!nsfwMode)
        if(containsBannedWords(prompt))
            return {status: "failed", message: "Your prompt includes banned words."};
    // let result = fs.readFileSync(`./images/${prompt}.txt`, 'utf-8');
    // return {status: "success", image: result, prompt: prompt};
    if(!nsfwMode) {
        data.refiner_checkpoint = "v1-5-pruned.ckpt [e1441589a6]";
    } else {
        data.refiner_checkpoint = "Uber_Realistic_Porn_Merge_V1.3.ckpt [ce9f23b047]";
    }
    data.prompt = prompt;
    let response = await axios.post(process.env.IMAGE_GENERATE_URL, data);
    
    let image = response.data.images[0];
    // const buffer = Buffer.from(image, 'base64');
    // fs.writeFile(`./images/${prompt}.png`, buffer, () => {});
    // fs.writeFile(`./images/${prompt}.txt`, image, () => {});
    return {status: "success", image: image, prompt: prompt};
};

const generatePrompt = async () => {    
    // let samples = ["a strong man", "a man with computer", "a really lovely cute cat", "a man with glass", "a man with woman", "kung fu panda", "no muscle man", "gentle man"]
    // samples.sort(() => Math.random() - 0.5);
    // return samples[0];
    let config = {
        url: process.env.OLLAMA_URL,
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': 'Bearer ' + process.env.AUTH_TOKEN
        },
        data: llamaData // Assuming llamadata contains the request body
    };
    
    try {
        let response = await axios.post(config.url, config.data, { headers: config.headers });
        const jsonArray = response.data
        .trim() // Remove leading and trailing whitespace
        .split('\n') // Split the string into lines
        .map(line => JSON.parse(line)); // Parse each line as JSON
        let message = [];
        for(let i = 0; i < jsonArray.length; i++) {
            message.push(jsonArray[i].message.content);
        }
        return message.join('').replace(/"/g, ''); // Join message array into a single string
    } catch (error) {
        console.error('Error:', error);
        throw error; // Rethrow the error to be handled by the caller
    }
}

module.exports.generateImage = generateImage;
module.exports.generatePrompt = generatePrompt;
module.exports.containsBannedWords = containsBannedWords;