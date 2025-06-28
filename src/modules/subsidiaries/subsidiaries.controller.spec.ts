import { Test, TestingModule } from '@nestjs/testing';
import { SubsidiariesController } from './subsidiaries.controller';

describe('SubsidiariesController', () => {
  let controller: SubsidiariesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubsidiariesController],
    }).compile();

    controller = module.get<SubsidiariesController>(SubsidiariesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
