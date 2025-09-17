import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';

describe('Employees (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let adminToken: string;
  let employeeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwt = app.get(JwtService);

    // Create an admin JWT payload bypassing login (for e2e simplicity)
    // Payload should match JwtStrategy.validate shape expectations
    adminToken = jwt.sign({
      userId: '000000000000000000000000',
      email: 'admin@test.local',
      role: 'admin',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create an employee', async () => {
    const res = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Maria',
        lastName: 'Solis',
        dob: '1990/05/10',
        dateOfHire: '2020/01/15',
        documentId: '123456789',
      })
      .expect(201);
    const body = res.body as { _id: string };
    expect(body).toHaveProperty('_id');
    employeeId = body._id;
  });

  it('should list employees with pagination', async () => {
    const res = await request(app.getHttpServer())
      .get('/employees?limit=10&offset=0')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = res.body as { items: unknown[]; total: number };
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('should add a salary (CRC) and get current salary', async () => {
    await request(app.getHttpServer())
      .post(`/employees/${employeeId}/salaries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amountCents: 75000000,
        currency: 'CRC',
        schedule: 'monthly',
        effectiveFrom: '2024/01/01',
        note: 'Initial',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/employees/${employeeId}/salary`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('amountCents', 75000000);
    expect(res.body).toHaveProperty('currency', 'CRC');
  });

  it('should update salary with new effectiveFrom and close previous', async () => {
    await request(app.getHttpServer())
      .post(`/employees/${employeeId}/salaries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amountCents: 80000000,
        currency: 'CRC',
        schedule: 'monthly',
        effectiveFrom: '2024/06/01',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/employees/${employeeId}/salaries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = res.body as {
      items: Array<{ amountCents: number }>;
      total: number;
    };
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.items[0]).toHaveProperty('amountCents');
  });
});
