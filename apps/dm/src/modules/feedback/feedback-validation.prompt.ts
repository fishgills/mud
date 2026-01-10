export const FEEDBACK_VALIDATION_SYSTEM_PROMPT = `You are a game feedback moderator for a fantasy MUD (Multi-User Dungeon) game. Your job is to analyze player feedback and determine if it is genuine, actionable feedback about the game.

You MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON.`;

export function buildFeedbackValidationPrompt(
  feedback: string,
  type: string,
): string {
  return `Analyze the following player feedback and respond in JSON format.

Feedback: "${feedback}"
Feedback Type (player-selected): ${type}

Respond with this exact JSON structure:
{
  "isValid": boolean,
  "rejectionReason": string | null,
  "category": "bug" | "feature" | "balance" | "ux" | "question" | "praise",
  "priority": "low" | "medium" | "high",
  "summary": string,
  "tags": string[]
}

Field descriptions:
- isValid: true if this is genuine game feedback (not spam, harassment, gibberish, or unrelated to the game)
- rejectionReason: if invalid, a brief reason (e.g., "not game-related", "inappropriate content", "spam"). null if valid.
- category: classify the feedback type:
  - "bug": something is broken or not working as expected
  - "feature": a new feature request or suggestion
  - "balance": feedback about game balance (combat, economy, difficulty)
  - "ux": user experience, interface, or usability feedback
  - "question": player is asking a question (still valid feedback)
  - "praise": positive feedback about the game
- priority: based on severity/impact:
  - "high": game-breaking bugs, major issues affecting playability
  - "medium": significant issues or valuable suggestions
  - "low": minor issues, nice-to-haves, or general comments
- summary: a concise issue title (under 80 characters) that captures the essence of the feedback
- tags: relevant tags like ["combat", "inventory", "ui", "tutorial", "movement", "monsters", "items", "gold", "party", "exploration"]

Rules:
- Reject feedback containing personal attacks, harassment, real-world issues, or nonsensical text
- Accept even brief feedback if genuine (e.g., "combat is too hard" is valid)
- Be generous—players may not articulate perfectly
- For the summary, write it as if it's a GitHub issue title`;
}

export function parseFeedbackValidationResponse(response: string): {
  isValid: boolean;
  rejectionReason: string | null;
  category: 'bug' | 'feature' | 'balance' | 'ux' | 'question' | 'praise';
  priority: 'low' | 'medium' | 'high';
  summary: string;
  tags: string[];
} | null {
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (typeof parsed.isValid !== 'boolean') return null;
    if (typeof parsed.summary !== 'string') return null;
    if (!Array.isArray(parsed.tags)) return null;

    // Normalize category
    const validCategories = [
      'bug',
      'feature',
      'balance',
      'ux',
      'question',
      'praise',
    ];
    const category = validCategories.includes(parsed.category)
      ? parsed.category
      : 'feature';

    // Normalize priority
    const validPriorities = ['low', 'medium', 'high'];
    const priority = validPriorities.includes(parsed.priority)
      ? parsed.priority
      : 'medium';

    return {
      isValid: parsed.isValid,
      rejectionReason: parsed.rejectionReason ?? null,
      category,
      priority,
      summary: parsed.summary.substring(0, 80), // Ensure max length
      tags: parsed.tags.filter((t: unknown) => typeof t === 'string'),
    };
  } catch {
    return null;
  }
}
