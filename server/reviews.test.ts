import { expect, test } from 'vitest';
import request from 'supertest';
import { makeApp } from './testkit.ts';

test('no reviews yet', async () => {
  expect((await request(makeApp()).get('/api/reviews')).body).toEqual({ average: null, count: 0, reviews: [] });
});

test('a guest can post a review without a session', async () => {
  const app = makeApp();
  expect((await request(app).post('/api/reviews').send({ rating: 5, comment: ' Great cut ', name: 'Rafi' })).status).toBe(201);
  await request(app).post('/api/reviews').send({ rating: 4 });
  const res = await request(app).get('/api/reviews');
  expect(res.body.average).toBe(4.5);
  expect(res.body.count).toBe(2);
  expect(res.body.reviews[0]).toMatchObject({ rating: 4, comment: '', name: '' });
  expect(res.body.reviews[1]).toMatchObject({ rating: 5, comment: 'Great cut', name: 'Rafi' });
  expect(res.body.reviews[0].createdAt).toEqual(expect.any(String));
});

test('rating must be a whole number from 1 to 5', async () => {
  for (const rating of [0, 6, 3.5, '5', null, undefined])
    expect((await request(makeApp()).post('/api/reviews').send({ rating })).status).toBe(400);
});

test('comment and name limits', async () => {
  const app = makeApp();
  expect((await request(app).post('/api/reviews').send({ rating: 5, comment: 'x'.repeat(501) })).status).toBe(400);
  expect((await request(app).post('/api/reviews').send({ rating: 5, comment: 'x'.repeat(500) })).status).toBe(201);
  expect((await request(app).post('/api/reviews').send({ rating: 5, name: 'x'.repeat(41) })).status).toBe(400);
  expect((await request(app).post('/api/reviews').send({ rating: 5, comment: 7 })).status).toBe(400);
});

test('only the latest 20 are listed but all are counted', async () => {
  const app = makeApp();
  for (let i = 0; i < 21; i++) await request(app).post('/api/reviews').send({ rating: 3, comment: `c${i}` });
  const res = await request(app).get('/api/reviews');
  expect(res.body.reviews).toHaveLength(20);
  expect(res.body.count).toBe(21);
  expect(res.body.reviews[0].comment).toBe('c20');
});

test('html in a comment is stored as plain text', async () => {
  const app = makeApp();
  await request(app).post('/api/reviews').send({ rating: 1, comment: '<script>alert(1)</script>' });
  expect((await request(app).get('/api/reviews')).body.reviews[0].comment).toBe('<script>alert(1)</script>');
});
