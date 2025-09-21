import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(() => {
    service = new AppService();
  });

  it('should return the expected welcome message', () => {
    expect(service.getData()).toEqual({ message: 'Hello API' });
  });
});
