import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  it('should delegate to the service', () => {
    const appService = new AppService();
    const appController = new AppController(appService);

    expect(appController.getHello()).toBe('Hello World!');
  });
});
