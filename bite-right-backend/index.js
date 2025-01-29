const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');

// Load environment variables
dotenv.config();

const app = express();
const port = 3000;

// ✅ HARDCODE THE FRONTEND PATH
const frontendPath = "C:/Users/neelt/VS CODE/BiteRight";  // <-- Change this if needed
console.log(`🛠 DEBUG: Serving frontend from: ${frontendPath}`);

// ✅ Serve Static Files
app.use(express.static(frontendPath));

// ✅ Serve index.html for all routes
app.get('*', (req, res) => {
    const indexPath = "C:/Users/neelt/VS CODE/BiteRight/index.html";  // <-- Full Path to index.html
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

// ✅ Initialize the new OpenAI class (4.x)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Endpoint to generate meal plan
app.post('/api/generate-meal-plan', async (req, res) => {
  try {
    const { date, preferences } = req.body;
    console.log('Generating meal plan for:', date);
    console.log('User Preferences:', preferences);

    // Construct your prompt (use 'preferences' not 'userPreferences')
    const weekStartDate = new Date(); // Or parse from `date` if you want
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

    // Call the chat-based method
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a meal plan generator.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    // Extract text from the chat response
    const rawContent = response.choices[0]?.message?.content.trim() || '';
    console.log('Raw GPT Content:', rawContent);

    // Remove any code fences
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

    // ✅ Fallback if mealPlan is invalid or empty
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

    // Return to the frontend
    res.status(200).json({ mealPlan });
  } catch (error) {
    console.error('Error in /api/generate-meal-plan:', error);
    res.status(500).json({ error: 'Failed to generate meal plan.' });
  }
});

// Endpoint for recipes or images
app.post('/api/openai', async (req, res) => {
  try {
    const { prompt, imageGeneration, n = 1, size = '1024x1024' } = req.body;

    // If it's an image generation request:
    if (imageGeneration) {
      const imageResp = await openai.images.generate({
        prompt,
        n,
        size,
      });
      return res.status(200).json(imageResp.data);
    }

    // Otherwise, text-based request
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: req.body.maxTokens || 200,
      temperature: req.body.temperature || 0.7,
    });

    res.status(200).json(completion);
  } catch (error) {
    console.error('Error in /api/openai:', error);
    res.status(500).json({ error: 'OpenAI request failed.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
