import type { Request, Response } from 'express';
import { Resend } from 'resend';
import { AppError } from '../utils';
import { ApiKeyModel } from '../models';

const resend = new Resend(process.env.RESEND_API_KEY);

export const generateApiKey = async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  if (!email || email.indexOf('@') === -1) {
    throw new AppError('Invalid email address', 400);
  }

  const today = new Date();
  if (today.getUTCDay() === 1 && today.getUTCHours() > 23 && today.getUTCMinutes() > 55) {
    throw new AppError('The server is about to purge all api keys (try after 12:00 AM)', 422);
  }

  const dayOfWeek = today.getUTCDay();
  const daysToMonday = dayOfWeek > 1 ? 8 - dayOfWeek : 1;

  const utcToday = new Date(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() + daysToMonday,
    Math.abs(today.getHours() - today.getUTCHours()),
    Math.abs(today.getMinutes() - today.getUTCMinutes())
  );

  const result = await ApiKeyModel.create(
    {
      emailAddress: email,
      expiringAt: today.toISOString(),
    },
    { fields: ['emailAddress', 'expiringAt'] }
  );

  const apiKey = result.getDataValue('apiKey');
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(utcToday);
  const formattedTime = new Intl.DateTimeFormat('en-US', {
    timeStyle: 'medium',
  }).format(utcToday);

  const expiringAt = utcToday.toISOString();

  if (process.env.NODE_ENV === 'prod') {
    await resend.emails.send({
      from: 'reelfake_api@resend.dev',
      to: email,
      subject: 'Email test from reelfake api',
      html: `
              <p style="margin-bottom: 2em; font-size: 1.5em;">Welcome to ReelFake API!</p>
              <p>Here is your api key which will expire on ${formattedDate} at ${formattedTime} GMT.</p>
              <p style="margin-bottom: 2em;"><strong>${result.getDataValue('apiKey')}</strong></p>
              <p style="margin-bottom: 2em;">If you encounter any issues in using the api, please submit it on the reelfake website.</p>
              <p>Thank you,</p>
              <p>ReelFake API Developer</p>
          `,
    });
  }

  res.status(201).json({
    apiKey,
    expiringAt,
  });
};
