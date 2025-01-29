const { Configuration, OpenAIApi } = require('openai');
const dotenv = require('dotenv');
dotenv.config();

console.log('Configuration:', Configuration);
console.log('OpenAIApi:', OpenAIApi);

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('Configuration instance created:', configuration);

const openai = new OpenAIApi(configuration);
console.log('OpenAIApi instance created:', openai);