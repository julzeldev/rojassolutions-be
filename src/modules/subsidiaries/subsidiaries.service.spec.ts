import { Test, TestingModule } from '@nestjs/testing';
import { SubsidiariesService } from './subsidiaries.service';

describe('SubsidiariesService', () => {
  let service: SubsidiariesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubsidiariesService],
    }).compile();

    service = module.get<SubsidiariesService>(SubsidiariesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
