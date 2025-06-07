import { Injectable } from '@nestjs/common';
import OpenAIApi from 'openai';

@Injectable()
export class OpenaiService {
  private openai: OpenAIApi;
  constructor() {
    this.openai = new OpenAIApi({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async getText(prompt: string) {
    const complete = await this.openai.responses.create({
      model: 'gpt-4.1-nano',
      instructions:
        'You are to describe a location in a fantasy world. The description should be vivid and immersive, providing details about the environment, atmosphere, and any notable features. The description should be suitable for a tabletop role-playing game setting and be on paragraph. Distances should be describe in vague terms.',
      input: prompt,
    });
    return complete;
  }
}
