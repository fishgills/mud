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
      const systemMessage =
        `You are to describe a location in a fantasy world. ` +
        `The description should be vivid and immersive, providing details about the environment, atmosphere, and any notable features. ` +
        `Temperature is a scale between 0 and 1, where 0 is freezing and 1 is very hot. ` +
        `Height is a scale of 0 to 1, where 0 is sea level and 1 is the highest mountain peak. ` +
        `Moisture is a scale of 0 to 1, where 0 is desert and 1 is a rainforest. ` +
        `Distance units are expressed in 100 meters but should be expressed in general terms like 'far' or 'near'. Never use specific numbers. Each tile of the map is equivalent to 100 square meters.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
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
        temperature: 0.7,
        max_tokens: 300,
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
