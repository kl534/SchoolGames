import { handle, type Env } from './app';
import { createD1Repo } from './d1';

export default {
  fetch: (req: Request, env: Env): Promise<Response> => handle(req, env, createD1Repo(env.DB)),
};
