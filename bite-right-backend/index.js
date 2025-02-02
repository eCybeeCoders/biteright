require('dotenv').config();
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);

const express = require('express');
const cors = require('cors');
const path = require('path'); // For building paths
const OpenAI = require('openai');

const app = express();
const port = 3000;

// Set the frontend path relative to this file (go up one directory)
const frontendPath = path.join(__dirname, '..');
console.log(`🛠 DEBUG: Serving frontend from: ${frontendPath}`);

// Serve static files from the parent folder (your frontend)
app.use(express.static(frontendPath));

// Serve index.html for all routes
app.get('*', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  console.log(`🛠 DEBUG: Attempting to serve ${indexPath}`);

  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("❌ Error serving index.html:", err);
      res.status(500).send("Error loading the site.");
    }
  });
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize the OpenAI class
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Endpoint to generate meal plan
app.post('/api/generate-meal-plan', async (req, res) => {
  try {
    const { date, preferences } = req.body;
    console.log('Generating meal plan for:', date);
    console.log('User Preferences:', preferences);

    const weekStartDate = new Date(); // Or parse from `date` if desired
    const prompt = `
Generate meal plans for the week starting ${weekStartDate.toDateString()}.

You are a meal plan generator. 
Use these preferences:
- Spice tolerance: ${preferences.spiceTolerance}
- Preferred cuisines: ${preferences.preferredCuisines.join(", ")}
- Dietary restrictions: ${preferences.exclusions.join(", ")} (strictly avoid these items and all their derivatives).
- Favorite food: ${preferences.favoriteFood}
- User info: Gender: ${preferences.generalInfo.gender}, Age: ${preferences.generalInfo.age}, Height: ${preferences.generalInfo.height}, Weight: ${preferences.generalInfo.weight}.

IMPORTANT INSTRUCTIONS:
1. STRICTLY exclude all dietary restrictions, including derivatives.
2. Provide exactly 3 unique meals (Breakfast, Lunch, Dinner) with varied ingredients that align with the preferences and restrictions provided.
3. Meals should be different from previous days to keep the user from getting bored, but must remain within their taste preferences.
4. Ensure the meals are nutritionally balanced and suitable for the user's age, gender, and weight.
5. Meals must feel personalized and include culturally or taste-appropriate options based on the preferred cuisines.
6. **Output valid JSON ONLY** with no \`\`\` fences, in this format:
[
  { "type": "", "name": "", "description": "" },
  { "type": "", "name": "", "description": "" },
  { "type": "", "name": "", "description": "" }
]
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a meal plan generator.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const rawContent = response.choices[0]?.message?.content.trim() || '';
    console.log('Raw GPT Content:', rawContent);

    const cleanedContent = rawContent
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    let mealPlan = [];
    try {
      mealPlan = JSON.parse(cleanedContent);
    } catch (err) {
      console.warn('Meal plan not in pure JSON format:', err);
    }

    if (!Array.isArray(mealPlan) || mealPlan.length < 3) {
      console.warn('Received invalid or empty meal plan. Using fallback.');
      mealPlan = [
        {
          type: 'Breakfast',
          name: 'Fallback Oatmeal',
          description: 'A fallback meal generated because GPT output was invalid.'
        },
        {
          type: 'Lunch',
          name: 'Fallback Salad',
          description: 'A fallback meal generated because GPT output was invalid.'
        },
        {
          type: 'Dinner',
          name: 'Fallback Stir Fry',
          description: 'A fallback meal generated because GPT output was invalid.'
        }
      ];
    }

    res.status(200).json({ mealPlan });
  } catch (error) {
    console.error('Error in /api/generate-meal-plan:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    res.status(500).json({ error: 'Failed to generate meal plan.' });
  }
});

// Endpoint for recipes or images
app.post('/api/openai', async (req, res) => {
  try {
    const { prompt, imageGeneration, n = 1, size = '1024x1024' } = req.body;
    if (imageGeneration) {
      const imageResp = await openai.images.generate({
        prompt,
        n,
        size,
      });
      return res.status(200).json(imageResp.data);
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: req.body.maxTokens || 500,
      temperature: req.body.temperature || 0.5,
    });

    res.status(200).json(completion);
  } catch (error) {
    console.error('Error in /api/openai:', error);
    res.status(500).json({ error: 'OpenAI request failed.' });
  }
});

// For local development, start the server if not in production
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

// Export the Express app for Vercel
module.exports = app;
