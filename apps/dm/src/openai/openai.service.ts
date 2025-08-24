import { Injectable, Logger } from '@nestjs/common';
import OpenAIApi from 'openai';

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);

  private openai: OpenAIApi;
  constructor() {
    this.openai = new OpenAIApi({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async getText(prompt: string) {
    this.logger.log(
      `OpenAI being called with prompt: ${prompt.substring(0, 100)}...`,
    );

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      this.logger.warn(
        'OpenAI API key not configured, returning mock response',
      );
      return {
        output_text: this.generateMockResponse(prompt),
      };
    }

    try {
      const systemMessage = `You describe locations in a fantasy world.
        - Output MUST be plain text, no code blocks or Slack formatting.
        - Focus on the environment only; do NOT mention dynamic entities like players or monsters.
        - Be vivid and cohesive with nearby context; keep to 1-3 sentences.
        - Temperature, Height, and Moisture are 0-1 scales (0 cold/low/dry, 1 hot/high/wet).
        - Use general terms for distance (near/far), avoid specific numbers.
        - Each x/y coordinate is a tile in a grid, with each tile representing a 100m x 100m area. If a distance is '28', it refers to 28 tiles (2800m).
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        // temperature: 0.9,
      });

      this.logger.log(`OpenAI response received`);
      const content =
        response.choices[0]?.message?.content || 'No description generated.';

      return {
        output_text: content,
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error calling OpenAI: ${error.message}`);
        this.logger.debug(error);
        // Return a fallback response instead of throwing
        return {
          output_text: this.generateMockResponse(prompt),
        };
      } else {
        this.logger.error(`Error calling OpenAI: Unknown error`);
        return {
          output_text: this.generateMockResponse(prompt),
        };
      }
    }
  }

  private generateMockResponse(prompt: string): string {
    // Generate a basic response based on the prompt content
    if (prompt.includes('players')) {
      return 'You sense other adventurers nearby, their presence adding life to this area.';
    }

    if (prompt.includes('Alpine')) {
      return 'The crisp mountain air fills your lungs as you stand among towering peaks dusted with snow. Hardy alpine plants cling to rocky outcroppings, and the view stretches for miles across the rugged landscape.';
    }

    if (prompt.includes('grassland')) {
      return 'Rolling green hills stretch before you, dotted with wildflowers swaying in the gentle breeze. The grass whispers softly underfoot as you move through this peaceful meadow.';
    }

    return 'You find yourself in a mysterious landscape, filled with unknown wonders waiting to be discovered.';
  }
}
