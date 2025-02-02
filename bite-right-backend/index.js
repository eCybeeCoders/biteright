require('dotenv').config();
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);

const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');  // Ensure this is imported

// Create an instance of OpenAI and ensure it is defined.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const port = 3000;

// ------------------------------
// 1. Define the Public Folder Path
// ------------------------------
const publicPath = path.join(__dirname, 'public');
console.log(`🛠 DEBUG: Serving static files from: ${publicPath}`);

// ------------------------------
// 2. Serve Static Files from the Public Folder
// ------------------------------
app.use(express.static(publicPath, { etag: false, maxAge: 0 }));

// ------------------------------
// 3. Middleware for API Requests
// ------------------------------
app.use(cors());
app.use(express.json());

// ------------------------------
// 4. API Endpoints
// ------------------------------

// Endpoint to generate meal plan
app.post('/api/generate-meal-plan', async (req, res) => {
  try {
    const { date, preferences } = req.body;
    console.log('Generating meal plan for:', date);
    console.log('User Preferences:', preferences);

    const weekStartDate = new Date();
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
2. Provide exactly 3 unique meals (Breakfast, Lunch, Dinner) with varied ingredients that align with the preferences.
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

    // Use the openai instance we created above.
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
    console.error('Error in /api/generate-meal-plan:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Failed to generate meal plan.', details: error.toString() });
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

// ------------------------------
// 5. Catch-all GET Route for SPA Navigation
// ------------------------------
app.get('*', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  console.log(`🛠 DEBUG: Serving index.html for route ${req.url}`);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("❌ Error serving index.html:", err);
      res.status(500).send("Error loading the site.");
    }
  });
});

// ------------------------------
// 6. Local Server Startup & Export for Vercel
// ------------------------------
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

module.exports = app;
