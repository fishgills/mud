import { Injectable } from '@nestjs/common';
import OpenAIApi from 'openai';

@Injectable()
export class OpenaiService {
  constructor(private readonly openai: OpenAIApi) {
    this.openai = new OpenAIApi({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async getText(prompt: string) {
    const complete = await this.openai.responses.create({
      model: 'gpt-4.1-nano',
      instructions:
        'You are a making up tile descriptions for a fantasy game world. It is 2 dimensional and in x/y coordinates. The world is a fantasy world with magic, monsters, and dungeons. The tiles are 1x1 km in size. The world is procedurally generated and the tiles are generated based on the surrounding tiles.',
      input: prompt,
    });
  }
}
