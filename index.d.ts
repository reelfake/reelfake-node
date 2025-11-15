import supertest from 'supertest';

declare module 'supertest' {
  interface Test extends SuperTestStatic {
    authenticate(user: any): this;
  }
}
