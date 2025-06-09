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
    this.logger.log(`OpenAI being called`);
    try {
      const response = await this.openai.responses.create({
        model: 'gpt-4.1-nano',
        store: false,
        temperature: 0.7,
        instructions:
          `You are to describe a location in a fantasy world.` +
          `The description should be vivid and immersive, providing details about the environment, atmosphere, and any notable features.` +
          `The description should be suitable for a tabletop role-playing game setting and be one paragraph.` +
          `Temperature is a scale between 0 and 1, where 0 is freezing and 1 is very hot.` +
          `Height is is a scale of 0 to 1, where 0 is sea level and 1 is the highest mountain peak.` +
          `Moisture is a scale of 0 to 1, where 0 is desert and 1 is a rainforest.` +
          `Distance units are expressed in 100 meters but should be expressed in general terms like 'far' or near. Never use specific numbers. Each tile of the map is equivalent to 100 square meters.`,
        input: prompt,
      });
      this.logger.log(`OpenAI Called`);
      return response;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error calling OpenAI: ${error.message}`);
        throw new Error(`Failed to get text from OpenAI: ${error.message}`);
      } else {
        this.logger.error(`Error calling OpenAI: Unknown error`);
        throw new Error(`Failed to get text from OpenAI: Unknown error`);
      }
    }
  }
}
