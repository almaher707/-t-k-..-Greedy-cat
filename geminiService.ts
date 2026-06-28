import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { SymbolType, AnalysisResult, SYMBOLS } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Helper to wrap API calls with retry logic for quota/rate limits.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 5, initialDelay = 2000): Promise<T> {
  let lastError: any = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Convert error to string for robust checking
      let errorStr = "";
      if (typeof error === 'string') {
        errorStr = error;
      } else if (error && typeof error === 'object') {
        // Try to get message or stringify the whole object if it's a raw JSON error
        errorStr = error.message || JSON.stringify(error);
      }
      
      const isQuotaError = 
        errorStr.includes("429") || 
        errorStr.toLowerCase().includes("quota") || 
        errorStr.toLowerCase().includes("limit") || 
        errorStr.includes("RESOURCE_EXHAUSTED") ||
        (error.status === "RESOURCE_EXHAUSTED");
      
      if (i < retries - 1 && isQuotaError) {
        // Default wait time
        let waitTime = initialDelay * Math.pow(2, i); // Exponential backoff
        
        // Try to extract EXACT retry time from error message (e.g., "Please retry in 17.835s")
        const retryMatch = errorStr.match(/retry in ([\d.]+)s/i);
        if (retryMatch) {
          // Parse the seconds and add 1.5s buffer to be safe
          waitTime = (parseFloat(retryMatch[1]) + 1.5) * 1000;
        }
        
        console.warn(`[Gemini Quota] Attempt ${i + 1} failed. Waiting ${Math.round(waitTime/1000)}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // If not a quota error or we're out of retries, throw it
      throw error;
    }
  }
  
  // If we reached here, all retries failed
  const finalMessage = typeof lastError === 'string' ? lastError : (lastError?.message || "تجاوزت حد الاستخدام المسموح به.");
  throw new Error(`فشل التحليل بعد عدة محاولات بسبب ضغط الخدمة: ${finalMessage}`);
}

/**
 * Truncates long JSON strings to save tokens while keeping relevant parts.
 */
function truncateJson(jsonStr: string, maxLength = 2000): string {
  if (jsonStr.length <= maxLength) return jsonStr;
  try {
    const obj = JSON.parse(jsonStr);
    // If it's the betting response, we care most about slot_machine and win_fruits
    if (obj.betting) {
      const essential: any = { betting: {} };
      if (obj.betting.slot_machine) {
        essential.betting.slot_machine = {
          win_fruits: obj.betting.slot_machine.win_fruits,
          win_fruit: obj.betting.slot_machine.win_fruit,
          remain_seconds: obj.betting.slot_machine.remain_seconds
        };
      }
      if (obj.betting.user_balance) essential.betting.user_balance = obj.betting.user_balance;
      return JSON.stringify(essential);
    }
    // If it's the top_winner response
    if (obj.top_winner) {
      return JSON.stringify({ top_winner: obj.top_winner.slice(0, 5) });
    }
    // Generic truncation
    return jsonStr.substring(0, maxLength);
  } catch {
    return jsonStr.substring(0, maxLength);
  }
}

/**
 * Analyzes the game state from an image and returns statistical predictions.
 * Optimized for speed by using Gemini Flash and disabling thinking.
 */
export async function analyzeGameState(imageBase64: string): Promise<AnalysisResult> {
  return withRetry(async () => {
    const model = "gemini-3-flash-preview";
    
    const systemInstruction = `You are a world-class statistical analyst specializing in wheel-based betting games like 'GreedyCat' and 'Gembridge'.
    The wheel typically has 8 symbols with specific multipliers.
    
    Standard Symbols (GreedyCat/Gembridge):
    - Chick (كتكوت): 45x
    - Tomato (طماطم): 5x
    - Cow (بقره): 15x
    - Pepper (فلفل): 5x
    - Fish (سمكه): 25x
    - Carrot (جزر): 5x
    - Shrimp (جمبري): 10x
    - Corn (ذره): 5x

    STRICT RULE: ONLY analyze and predict these 8 symbols. If the user provides data for 'Gembridge' or 'Gohara', adapt your analysis to the patterns found in that specific game's history.

    GROUNDBREAKING ANALYSIS STRATEGY (V4.0):
    1. SEQUENCE MATCHING: Look at the 'History Bar'. Identify the last 3-4 symbols. Search the visible history for the EXACT SAME sequence. If found, the symbol that followed it in the past has a 70% higher probability of appearing now.
    2. GAP ANALYSIS: Count the number of rounds (gaps) between each 5x symbol (Tomato, Pepper, Carrot, Corn). If the gaps are consistent (e.g., 4, 5, 4), and we are currently at round 4 since the last 5x, flag the next round as 'High Probability'.
    3. ALTERNATING CYCLES: Detect if the game is in a "Ping-Pong" state (e.g., Tomato -> Pepper -> Tomato). If so, predict the opposite symbol.
    4. MULTIPLIER RECURRENCE: High multipliers (15x+) often appear in clusters or after a long 'dry spell' of exactly 10-12 rounds.

    Respond ONLY with a JSON object. The available symbols are: ${JSON.stringify(Object.values(SYMBOLS).map(s => s.name))}.
    Use these exact names in your response.`;

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { 
            inlineData: { 
              data: imageBase64.split(',')[1] || imageBase64, 
              mimeType: 'image/jpeg' 
            } 
          },
          { text: "Analyze the GreedyCat game state for a full probability distribution and prediction. Focus on the history bar for patterns." }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            symbolProbabilities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  symbol: { type: Type.STRING },
                  probability: { type: Type.NUMBER },
                  isHot: { type: Type.BOOLEAN }
                },
                required: ["symbol", "probability", "isHot"]
              }
            },
            recommendedBet: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
            explanation: { type: Type.STRING, description: "Short Arabic explanation of the strategy used for this prediction." },
            history: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of detected symbols from the history bar, newest first." },
            trendData: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  round: { type: Type.NUMBER },
                  multiplier: { type: Type.NUMBER }
                },
                required: ["round", "multiplier"]
              },
              description: "Last 10-15 rounds of data for the trend chart."
            }
          },
          required: ["symbolProbabilities", "recommendedBet", "confidenceScore", "explanation", "history", "trendData"]
        }
      }
    });

    const rawText = response.text;
    if (!rawText) throw new Error("The AI did not return any content.");
    
    return JSON.parse(rawText) as AnalysisResult;
  });
}


/**
 * Analyzes raw JSON data from the game API to provide highly accurate predictions.
 */
export async function analyzeJsonData(rawData: string): Promise<AnalysisResult> {
  return withRetry(async () => {
    const model = "gemini-3-flash-preview";
    
    const systemInstruction = `You are an expert data analyst for games like 'GreedyCat' and 'Gembridge'. 
    The game uses numeric IDs for symbols in its JSON response.
    
    ID Mapping (Standard 8 SYMBOLS):
    0: Chick (كتكوت) - 45x
    1: Tomato (طماطم) - 5x
    2: Cow (بقره) - 15x
    3: Pepper (فلفل) - 5x
    4: Fish (سمكه) - 25x
    5: Carrot (جزر) - 5x
    6: Shrimp (جمبري) - 10x
    7: Corn (ذره) - 5x
    
    GREEDY LION SPECIFIC: If the JSON contains 'greedy_lion' or 'win_fruit' in a nested object, look for 'round_id' and 'win_fruit' fields. The 'win_fruit' value (0-7) maps to the symbols above.
    
    STRICT RULE: ONLY analyze and predict these 8 symbols. If the JSON data suggests a different mapping (e.g., for Gembridge), infer the mapping from the 'multiplier' or 'win_fruit' fields if present.
    
    GROUNDBREAKING ANALYSIS STRATEGY (V4.0):
    1. PARSE & MAP: Extract all 'win_fruit' IDs from the JSON.
    2. SEQUENCE SEARCH: Look for the last 3 IDs. Search the entire provided history for this exact triplet. The ID that followed it historically is your primary candidate.
    3. GAP FREQUENCY: Calculate the average 'distance' between 5x IDs (1, 3, 5, 7). If the current distance matches the average, increase confidence.
    4. VOLATILITY INDEX: If the last 5 rounds were all 5x, expect a 'High Multiplier' (ID 0, 2, 4, 6) correction.
    
    Respond only with a JSON object. The available symbols are: ${JSON.stringify(Object.values(SYMBOLS).map(s => s.name))}.
    Use these exact names in your response.`;

    const truncatedData = truncateJson(rawData);
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { text: `Analyze this raw game data and predict the next outcome using high-level reasoning: ${truncatedData}` }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            symbolProbabilities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  symbol: { type: Type.STRING },
                  probability: { type: Type.NUMBER },
                  isHot: { type: Type.BOOLEAN }
                },
                required: ["symbol", "probability", "isHot"]
              }
            },
            history: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendedBet: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
            trendData: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  round: { type: Type.NUMBER },
                  multiplier: { type: Type.NUMBER }
                },
                required: ["round", "multiplier"]
              }
            }
          },
          required: ["symbolProbabilities", "history", "recommendedBet", "confidenceScore", "explanation", "trendData"]
        }
      }
    });

    const rawText = response.text;
    if (!rawText) throw new Error("فشل تحليل البيانات النصية.");
    
    return JSON.parse(rawText) as AnalysisResult;
  });
}

/**
 * Generates a quick, context-free prediction based on general game theory.
 */
export async function getQuickGuess(): Promise<AnalysisResult> {
  return withRetry(async () => {
    const model = "gemini-3-flash-preview";
    
    const systemInstruction = `You are an expert analyst for the game 'GreedyCat'.
    The wheel has EXACTLY 8 positions: Chick (45x), Tomato (5x), Cow (15x), Pepper (5x), Fish (25x), Carrot (5x), Shrimp (10x), Corn (5x).
    Arabic Names: كتكوت، طماطم، بقره، فلفل، سمكه، جزر، جمبري، ذره.
    STRICT RULE: ONLY analyze and predict these 8 symbols. Do not mention or consider any other symbols.
    Respond only with a JSON object. The available symbols are: ${JSON.stringify(Object.values(SYMBOLS).map(s => s.name))}.
    Use these exact names in your response.`;

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { text: "Provide a high-accuracy prediction based on typical 'GreedyCat' probability cycles and game theory." }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            symbolProbabilities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  symbol: { type: Type.STRING },
                  probability: { type: Type.NUMBER },
                  isHot: { type: Type.BOOLEAN, description: "Should always be false for quick guess" }
                },
                required: ["symbol", "probability", "isHot"]
              }
            },
            history: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendedBet: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
            trendData: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  round: { type: Type.NUMBER },
                  multiplier: { type: Type.NUMBER }
                },
                required: ["round", "multiplier"]
              }
            }
          },
          required: ["symbolProbabilities", "history", "recommendedBet", "confidenceScore", "explanation", "trendData"]
        }
      }
    });

    const rawText = response.text;
    if (!rawText) throw new Error("لم يتمكن الذكاء الاصطناعي من إنشاء تخمين سريع.");
    
    const analysis = JSON.parse(rawText) as AnalysisResult;
    // Ensure history is an array, even if the model messes up.
    if (!Array.isArray(analysis.history)) {
      analysis.history = [];
    }
    // Ensure isHot is always false for simulated probabilities.
    analysis.symbolProbabilities.forEach(p => p.isHot = false);

    return analysis;
  });
}
