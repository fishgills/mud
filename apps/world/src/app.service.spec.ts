import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(() => {
    service = new AppService();
  });

  it('should return the hello message', () => {
    expect(service.getHello()).toBe('Hello World!');
  });
});
