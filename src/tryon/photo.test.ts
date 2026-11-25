import { expect, test } from 'vitest';
import { PHOTO_SIDE, centerSquare } from './photo.ts';

test('the photo is the square in the middle of the camera picture, which is what the customer sees', () => {
  expect(centerSquare(1280, 720)).toEqual({ x: 280, y: 0, side: 720 });
  expect(centerSquare(720, 1280)).toEqual({ x: 0, y: 280, side: 720 });
  expect(centerSquare(480, 480)).toEqual({ x: 0, y: 0, side: 480 });
});

test('photos are sent at the size the picture service keeps the framing of', () => {
  expect(PHOTO_SIDE).toBe(768);
});
