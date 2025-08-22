import { execQuery } from './tests/testUtil';

export default async function () {
  await execQuery('DELETE FROM public.user');
}
