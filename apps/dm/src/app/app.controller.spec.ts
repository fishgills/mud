import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  it('should return the same message as the service', () => {
    const appService = new AppService();
    const appController = new AppController(appService);

    expect(appController.getData()).toEqual({ message: 'Hello API' });
  });
});
