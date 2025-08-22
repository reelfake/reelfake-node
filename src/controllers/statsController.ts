import type { Request, Response } from 'express';
import { MovieModel, CustomerModel, ActorModel, StaffModel, StoreModel } from '../models';

export async function getStatistics(req: Request, res: Response) {
  const totalMovies = await MovieModel.count();
  const totalActors = await ActorModel.count();
  const totalCustomers = await CustomerModel.count();
  const totalStaff = await StaffModel.count();
  const totalStores = await StoreModel.count();

  res.status(200).json({ totalMovies, totalActors, totalCustomers, totalStaff, totalStores });
}
