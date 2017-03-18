import { expect } from 'chai';
import * as app from '../../app/scripts/app';

describe('#printHello', () => {
  it('always returns \'Hello World\'', () => {
    expect(app.printHello()).to.equal('Hello World!');
  });
});
