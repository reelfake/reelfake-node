import { UserModel } from './models';

export default async function () {
  await UserModel.truncate();
}
